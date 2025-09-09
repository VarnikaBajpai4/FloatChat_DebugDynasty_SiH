import os
import re
import json
import numpy as np
import psycopg2
from psycopg2.extras import execute_values, Json
from netCDF4 import Dataset, num2date
from datetime import datetime, timezone
from netCDF4 import Dataset, num2date, chartostring


NC_RE = re.compile(
    r'(?P<prefix>[A-Za-z]*)(?P<wmo>\d{6,10})_(?P<cycle>\d+[A-Za-z]?)\.nc$'
)

# ---------- Small helpers ----------

def _first_finite_scalar(var):
    """Return first finite float from a NetCDF var (handles masked arrays), else None."""
    if var is None:
        return None
    try:
        arr = np.array(var[:], dtype=float)
    except Exception:
        return None
    arr = arr.reshape(-1)
    for x in arr:
        if np.isfinite(x):
            return float(x)
    return None

def _as1d(v):
    if v is None:
        return None
    try:
        a = np.array(v[:])
    except Exception:
        return None
    return a.reshape(-1)

def _as2d(v):
    """Return 2D ndarray or None; ensures shape (N_PROF, N_LEVELS) when applicable."""
    if v is None:
        return None
    try:
        a = np.array(v[:])
    except Exception:
        return None
    if a.ndim == 1:
        # promote to (N_PROF, N_LEVELS=len) if needed by wrapping later per index
        return a.reshape(1, -1)
    return a

def _decode_bytes(x):
    if x is None:
        return None
    if isinstance(x, (bytes, np.bytes_)):
        return x.decode(errors="ignore").strip()
    if isinstance(x, (np.ndarray,)):
        # handle char arrays
        try:
            s = "".join(x.astype(str).tolist()).strip()
            return s
        except Exception:
            pass
    return str(x).strip()

def _good(q):
    """Accept Argo QC flags 1 or 2 as good."""
    if q is None:
        return False
    if isinstance(q, (bytes, np.bytes_)):
        q = q.decode(errors="ignore")
    return str(q).strip() in ("1", "2")

def _qc_counts(qarr_row):
    """Counts QC flags for a single profile's QC array row (1D)."""
    out = {}
    if qarr_row is None:
        return out
    flat = np.ravel(qarr_row)
    for q in flat:
        if isinstance(q, (bytes, np.bytes_)):
            q = q.decode(errors="ignore")
        q = str(q).strip()
        if q and q != ' ':
            out[q] = out.get(q, 0) + 1
    return out

def _first_time_at_index(ds, i):
    """Return a timezone-aware datetime for JULD/TIME for profile index i."""
    j = ds.variables.get("JULD") or ds.variables.get("TIME")
    if j is None:
        return None
    cal = getattr(j, "calendar", "standard")
    try:
        t = num2date(j[i], units=j.units, calendar=cal, only_use_cftime_datetimes=False)
    except Exception:
        try:
            t = num2date(j[i], units=j.units, calendar=cal, only_use_cftime_datetimes=True)
        except Exception:
            return None
    if isinstance(t, datetime):
        return t if t.tzinfo else t.replace(tzinfo=timezone.utc)
    # cftime fallback
    return datetime(
        int(t.year), int(t.month), int(t.day),
        int(getattr(t, "hour", 0)), int(getattr(t, "minute", 0)),
        int(getattr(t, "second", 0)), int(getattr(t, "microsecond", 0))
    ).replace(tzinfo=timezone.utc)

def _latlon_by_prof(ds, i):
    """Prefer adjusted LAT/LON if present; otherwise raw; pick element i."""
    def pick(varname):
        v = ds.variables.get(varname)
        if v is None:
            return None
        arr = np.array(v[:]).reshape(-1)
        if i < len(arr) and np.isfinite(arr[i]):
            return float(arr[i])
        # fallback to first finite (rare)
        return _first_finite_scalar(v)

    lat = pick("LATITUDE_ADJUSTED")
    lon = pick("LONGITUDE_ADJUSTED")
    if lat is None or lon is None:
        lat = lat if lat is not None else pick("LATITUDE")
        lon = lon if lon is not None else pick("LONGITUDE")
    return lat, lon

def _global_attrs(ds):
    ga = {}
    for k in ds.ncattrs():
        try:
            v = getattr(ds, k)
            if isinstance(v, bytes):
                v = v.decode(errors="ignore")
            try:
                json.dumps(v)
                ga[k] = v
            except Exception:
                ga[k] = str(v)
        except Exception:
            pass
    return ga

def _has_adjusted_pair(v_adj_row, v_adj_qc_row):
    if v_adj_row is None or v_adj_qc_row is None:
        return False
    n = min(len(v_adj_row), len(v_adj_qc_row))
    for i in range(n):
        if v_adj_row[i] is not None and _good(v_adj_qc_row[i]):
            return True
    return False

def _safe_len(arr):
    return len(arr) if arr is not None else 0

def parse_rel(rel_path: str):
    """
    rel_path like: 'aoml/1901839/profiles/R1901839_325.nc'
    returns: dac, wmo, cycle_number, file_type, source_file
    """
    parts = rel_path.replace("\\", "/").strip("/").split("/")
    if len(parts) < 3:
        raise ValueError(f"Bad rel_path: {rel_path}")
    dac = parts[0]
    source_file = parts[-1]
    m = NC_RE.search(source_file)
    if not m:
        raise ValueError(f"Cannot parse WMO/cycle from {source_file}")
    wmo = int(m.group("wmo"))
    cycle_raw = m.group("cycle")
    cycle_match = re.match(r"(\d+)", cycle_raw)
    if not cycle_match:
        raise ValueError(f"Cannot parse numeric cycle from {cycle_raw} in {source_file}")
    cycle_number = int(cycle_match.group(1))
    prefix = (m.group("prefix") or "").upper()
    file_type = "bgc_sprof" if prefix.startswith("S") or "sprof" in rel_path.lower() else "core_profile"
    return dac, wmo, cycle_number, file_type, source_file

def _decode_text_var(var, index=None):
    """
    Robustly decode NetCDF text/char/byte variables to a Python str.
    - Works for scalar bytes, 1D/2D char arrays (S1), and object bytes.
    - If index is given (per-profile), returns that element decoded.
    """
    if var is None:
        return None
    try:
        # Try fast path: chartostring converts char arrays (S1) to string array
        arr = chartostring(var[:])  # may return np.ndarray of dtype '<U...'
        if index is None:
            # If the var is scalar-like after chartostring
            if arr.ndim == 0:
                return str(arr.item()).strip()
            # Return first by default
            return str(arr.reshape(-1)[0]).strip()
        else:
            flat = arr.reshape(-1)
            if index < flat.size:
                return str(flat[index]).strip()
            return None
    except Exception:
        # Fallbacks for non-char arrays / scalars
        try:
            if index is None:
                x = var[:]
            else:
                x = var[index]
        except Exception:
            return None

        # x could be bytes, np.bytes_, or an array of bytes/chars
        import numpy as np
        if isinstance(x, (bytes, np.bytes_)):
            return x.decode(errors="ignore").strip()
        if isinstance(x, str):
            return x.strip()
        try:
            a = np.array(x)
            if a.dtype.kind in ("S", "U"):
                # Join element-wise and strip
                return "".join(a.astype(str).tolist()).strip()
        except Exception:
            pass
        # Last resort
        return str(x).strip()


# ---------- Main ingest ----------

def ingest_file(nc_path: str, rel_path: str, conn):
    """
    nc_path: absolute path to downloaded .nc
    rel_path: path relative to 'dac/' root (e.g., 'aoml/1901839/profiles/R1901839_325.nc')
    conn: psycopg2 connection
    """
    dac, wmo, cycle_number, file_type, source_file = parse_rel(rel_path)
    source_path = rel_path

    ds = None
    try:
        ds = Dataset(nc_path, "r")

        # --- Ensure float row exists
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO floats (wmo, dac)
                VALUES (%s, %s)
                ON CONFLICT (wmo) DO UPDATE
                  SET dac = EXCLUDED.dac,
                      updated_at = now();
            """, (wmo, dac))

        # --- Ensure float_cycle row exists, grab id
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO float_cycles (wmo, cycle_number)
                VALUES (%s, %s)
                ON CONFLICT (wmo, cycle_number) DO UPDATE
                  SET updated_at = now()
                RETURNING id;
            """, (wmo, cycle_number))
            cycle_id = cur.fetchone()[0]

        # Determine number of profiles in file
        n_prof = len(ds.dimensions.get("N_PROF")) if "N_PROF" in ds.dimensions else 1

        # Pull per-profile metadata arrays
        direction_arr = ds.variables.get("DIRECTION")
        vss_arr = ds.variables.get("VERTICAL_SAMPLING_SCHEME")
        data_mode_arr = ds.variables.get("DATA_MODE")  # may be 1D char array or per-prof

        # Global attrs
        global_attrs = _global_attrs(ds)

        # 2D core arrays (N_PROF, N_LEVELS)
        PRES = _as2d(ds.variables.get("PRES"))
        PRES_QC = _as2d(ds.variables.get("PRES_QC") or ds.variables.get("PRES_ADJUSTED_QC"))

        TEMP = _as2d(ds.variables.get("TEMP"))
        TEMP_QC = _as2d(ds.variables.get("TEMP_QC"))
        TEMP_ADJ = _as2d(ds.variables.get("TEMP_ADJUSTED"))
        TEMP_ADJ_QC = _as2d(ds.variables.get("TEMP_ADJUSTED_QC"))

        PSAL = _as2d(ds.variables.get("PSAL"))
        PSAL_QC = _as2d(ds.variables.get("PSAL_QC"))
        PSAL_ADJ = _as2d(ds.variables.get("PSAL_ADJUSTED"))
        PSAL_ADJ_QC = _as2d(ds.variables.get("PSAL_ADJUSTED_QC"))

        # Optional BGC
        DOXY = _as2d(ds.variables.get("DOXY"))
        DOXY_QC = _as2d(ds.variables.get("DOXY_QC"))
        DOXY_ADJ = _as2d(ds.variables.get("DOXY_ADJUSTED"))
        DOXY_ADJ_QC = _as2d(ds.variables.get("DOXY_ADJUSTED_QC"))

        CHLA = _as2d(ds.variables.get("CHLA"))
        CHLA_QC = _as2d(ds.variables.get("CHLA_QC"))
        CHLA_ADJ = _as2d(ds.variables.get("CHLA_ADJUSTED"))
        CHLA_ADJ_QC = _as2d(ds.variables.get("CHLA_ADJUSTED_QC"))

        # Iterate per profile
        for pidx in range(n_prof):
            # Per-profile time and location
            t_utc = _first_time_at_index(ds, pidx)
            lat, lon = _latlon_by_prof(ds, pidx)

            # Per-profile direction & VSS (robust decode)
            direction = _decode_text_var(direction_arr, index=pidx)
            vertical_sampling_scheme = _decode_text_var(vss_arr, index=pidx)

            # Data mode (per-profile if available)
            data_mode = None
            if data_mode_arr is not None:
                try:
                    # Commonly a 1D char array or per-prof char string
                    dm = data_mode_arr[pidx]
                    data_mode = _decode_bytes(dm)
                except Exception:
                    # fallback to global attr
                    data_mode = _decode_bytes(getattr(ds, "DATA_MODE", None) or getattr(ds, "DATAMODE", None))
            else:
                data_mode = _decode_bytes(getattr(ds, "DATA_MODE", None) or getattr(ds, "DATAMODE", None))

            # Per-profile slices (1D rows)
            pres_row      = PRES[pidx]      if PRES is not None else None
            pres_qc_row   = PRES_QC[pidx]   if PRES_QC is not None else None
            temp_row      = TEMP[pidx]      if TEMP is not None else None
            temp_qc_row   = TEMP_QC[pidx]   if TEMP_QC is not None else None
            temp_adj_row  = TEMP_ADJ[pidx]  if TEMP_ADJ is not None else None
            temp_adj_qc_row = TEMP_ADJ_QC[pidx] if TEMP_ADJ_QC is not None else None
            psal_row      = PSAL[pidx]      if PSAL is not None else None
            psal_qc_row   = PSAL_QC[pidx]   if PSAL_QC is not None else None
            psal_adj_row  = PSAL_ADJ[pidx]  if PSAL_ADJ is not None else None
            psal_adj_qc_row = PSAL_ADJ_QC[pidx] if PSAL_ADJ_QC is not None else None

            # QC summary per-profile
            qc_summary = {
                "temp_qc": _qc_counts(temp_qc_row),
                "psal_qc": _qc_counts(psal_qc_row),
            }

            # has_adjusted_core per-profile
            has_adj_core = _has_adjusted_pair(temp_adj_row, temp_adj_qc_row) or \
                           _has_adjusted_pair(psal_adj_row, psal_adj_qc_row)

            # Compute n_core_levels and max_pres (valid only)
            n_core_levels = 0
            max_pres = None
            if pres_row is not None:
                valid_mask = np.isfinite(pres_row)
                n_core_levels = int(np.sum(valid_mask))
                if n_core_levels > 0:
                    max_pres = float(np.nanmax(pres_row[valid_mask]))

            # Insert profile row
            modality = 'bgc' if file_type == 'bgc_sprof' else 'core'

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO profiles
                    (cycle_id, data_mode, juld_time, latitude, longitude,
                    file_type, source_file, source_path, global_attrs, has_adjusted_core, qc_summary,
                    direction, vertical_sampling_scheme, profile_index, n_core_levels, max_pres, modality)
                    VALUES (%s,%s,%s,%s,%s,
                            %s,%s,%s,%s,%s,%s,
                            %s,%s,%s,%s,%s,%s)
                    ON CONFLICT (cycle_id, modality, profile_index) DO UPDATE
                    SET data_mode = EXCLUDED.data_mode,
                        juld_time = EXCLUDED.juld_time,
                        latitude  = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        file_type = EXCLUDED.file_type,
                        source_file = EXCLUDED.source_file,
                        source_path = EXCLUDED.source_path,
                        global_attrs = EXCLUDED.global_attrs,
                        has_adjusted_core = EXCLUDED.has_adjusted_core,
                        qc_summary = EXCLUDED.qc_summary,
                        direction  = EXCLUDED.direction,
                        vertical_sampling_scheme = EXCLUDED.vertical_sampling_scheme,
                        n_core_levels = EXCLUDED.n_core_levels,
                        max_pres = EXCLUDED.max_pres,
                        modality = EXCLUDED.modality,
                        updated_at = now()
                    RETURNING id;
                """, (
                    cycle_id, data_mode, t_utc, lat, lon,
                    file_type, source_file, source_path, Json(global_attrs), has_adj_core, Json(qc_summary),
                    direction, vertical_sampling_scheme, pidx, n_core_levels, max_pres, modality
                ))
                profile_id = cur.fetchone()[0]


            # Update floats first/last profile times and meta_json
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE floats
                    SET
                      first_profile_time = LEAST(COALESCE(first_profile_time, %s), %s),
                      last_profile_time  = GREATEST(COALESCE(last_profile_time, %s), %s),
                      meta_json = COALESCE(meta_json, '{}'::jsonb) || %s,
                      updated_at = now()
                    WHERE wmo = %s
                """, (t_utc, t_utc, t_utc, t_utc, Json(global_attrs), wmo))

            # ---------- CORE LEVELS ----------
            core_rows = []
            # choose a consistent loop bound across available core vars
            n_core = max(
                _safe_len(pres_row),
                _safe_len(temp_row),
                _safe_len(psal_row)
            )

            for i in range(n_core):
                P  = float(pres_row[i]) if (pres_row is not None and i < len(pres_row) and np.isfinite(pres_row[i])) else None
                PQ = pres_qc_row[i] if (pres_qc_row is not None and i < len(pres_qc_row)) else None

                T  = float(temp_row[i]) if (temp_row is not None and i < len(temp_row) and np.isfinite(temp_row[i])) else None
                TQ = temp_qc_row[i] if (temp_qc_row is not None and i < len(temp_qc_row)) else None
                TA = float(temp_adj_row[i]) if (temp_adj_row is not None and i < len(temp_adj_row) and np.isfinite(temp_adj_row[i])) else None
                TAQ = temp_adj_qc_row[i] if (temp_adj_qc_row is not None and i < len(temp_adj_qc_row)) else None

                S  = float(psal_row[i]) if (psal_row is not None and i < len(psal_row) and np.isfinite(psal_row[i])) else None
                SQ = psal_qc_row[i] if (psal_qc_row is not None and i < len(psal_qc_row)) else None
                SA = float(psal_adj_row[i]) if (psal_adj_row is not None and i < len(psal_adj_row) and np.isfinite(psal_adj_row[i])) else None
                SAQ = psal_adj_qc_row[i] if (psal_adj_qc_row is not None and i < len(psal_adj_qc_row)) else None

                best_temp = TA if (TA is not None and _good(TAQ)) else (T if (T is not None and _good(TQ)) else None)
                best_psal = SA if (SA is not None and _good(SAQ)) else (S if (S is not None and _good(SQ)) else None)

                core_rows.append((
                    profile_id, i,
                    P, _decode_bytes(PQ) if PQ is not None else None,
                    T, _decode_bytes(TQ) if TQ is not None else None,
                    TA, _decode_bytes(TAQ) if TAQ is not None else None,
                    best_temp,
                    S, _decode_bytes(SQ) if SQ is not None else None,
                    SA, _decode_bytes(SAQ) if SAQ is not None else None,
                    best_psal
                ))

            with conn.cursor() as cur:
                cur.execute("DELETE FROM levels_core WHERE profile_id=%s", (profile_id,))
                if core_rows:
                    execute_values(cur, """
                        INSERT INTO levels_core
                        (profile_id, level_index, pres, pres_qc,
                         temp, temp_qc, temp_adjusted, temp_adjusted_qc, best_temp,
                         psal, psal_qc, psal_adjusted, psal_adjusted_qc, best_psal)
                        VALUES %s
                    """, core_rows)

            # ---------- BGC LEVELS (optional) ----------
            bgc_rows = []
            have_bgc = any(v is not None for v in (DOXY, CHLA))
            print(f"[BGC] file={source_file} has_DOXY={DOXY is not None} has_CHLA={CHLA is not None} -> have_bgc={have_bgc}")

            if have_bgc:
                doxy_row      = DOXY[pidx]        if DOXY is not None else None
                doxy_qc_row   = DOXY_QC[pidx]     if DOXY_QC is not None else None
                doxy_adj_row  = DOXY_ADJ[pidx]    if DOXY_ADJ is not None else None
                doxy_adj_qc_row = DOXY_ADJ_QC[pidx] if DOXY_ADJ_QC is not None else None

                chla_row      = CHLA[pidx]        if CHLA is not None else None
                chla_qc_row   = CHLA_QC[pidx]     if CHLA_QC is not None else None
                chla_adj_row  = CHLA_ADJ[pidx]    if CHLA_ADJ is not None else None
                chla_adj_qc_row = CHLA_ADJ_QC[pidx] if CHLA_ADJ_QC is not None else None

                # Prefer adjusted PRES if exists; else raw
                pres_bgc_row = None
                if ds.variables.get("PRES_ADJUSTED") is not None:
                    pres_bgc_row = np.array(ds.variables["PRES_ADJUSTED"][pidx])
                elif PRES is not None:
                    pres_bgc_row = pres_row

                n_bgc = max(
                    _safe_len(pres_bgc_row),
                    _safe_len(doxy_row),
                    _safe_len(chla_row)
                )

                for i in range(n_bgc):
                    P  = float(pres_bgc_row[i]) if (pres_bgc_row is not None and i < len(pres_bgc_row) and np.isfinite(pres_bgc_row[i])) else None

                    DO  = float(doxy_row[i]) if (doxy_row is not None and i < len(doxy_row) and np.isfinite(doxy_row[i])) else None
                    DOQ = doxy_qc_row[i] if (doxy_qc_row is not None and i < len(doxy_qc_row)) else None
                    DOA = float(doxy_adj_row[i]) if (doxy_adj_row is not None and i < len(doxy_adj_row) and np.isfinite(doxy_adj_row[i])) else None
                    DOAQ= doxy_adj_qc_row[i] if (doxy_adj_qc_row is not None and i < len(doxy_adj_qc_row)) else None

                    CH  = float(chla_row[i]) if (chla_row is not None and i < len(chla_row) and np.isfinite(chla_row[i])) else None
                    CHQ = chla_qc_row[i] if (chla_qc_row is not None and i < len(chla_qc_row)) else None
                    CHA = float(chla_adj_row[i]) if (chla_adj_row is not None and i < len(chla_adj_row) and np.isfinite(chla_adj_row[i])) else None
                    CHAQ= chla_adj_qc_row[i] if (chla_adj_qc_row is not None and i < len(chla_adj_qc_row)) else None

                    bgc_rows.append((
                        profile_id, i, P,
                        DO, _decode_bytes(DOQ) if DOQ is not None else None,
                        DOA, _decode_bytes(DOAQ) if DOAQ is not None else None,
                        CH, _decode_bytes(CHQ) if CHQ is not None else None,
                        CHA, _decode_bytes(CHAQ) if CHAQ is not None else None
                    ))

                if bgc_rows:
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM levels_bgc WHERE profile_id=%s", (profile_id,))
                        execute_values(cur, """
                            INSERT INTO levels_bgc
                            (profile_id, level_index, pres,
                             doxy, doxy_qc, doxy_adjusted, doxy_adjusted_qc,
                             chla, chla_qc, chla_adjusted, chla_adjusted_qc)
                            VALUES %s
                        """, bgc_rows)

        conn.commit()

    finally:
        if ds is not None:
            try:
                ds.close()
            except Exception:
                pass