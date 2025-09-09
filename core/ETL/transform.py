import re
import json
import numpy as np
import psycopg2
from psycopg2.extras import execute_values, Json
from netCDF4 import Dataset, num2date, chartostring
from datetime import datetime, timezone

NC_RE = re.compile(r'(?P<prefix>[A-Za-z]*)(?P<wmo>\d{6,10})_(?P<cycle>\d+[A-Za-z]?)\.nc$')

PHYS_RANGES = {
    "pres": (0.0, 12000.0),  # dbar
    "temp": (-3.0, 45.0),    # °C
    "psal": (0.0, 45.0),     # PSS-78
    "doxy": (0.0, 500.0),    # µmol/kg
    "chla": (0.0, 100.0),    # mg/m^3
}

# Extra guardrails to null-out bogus placeholders like 999, -999, 1e20, 9.96921e36, etc.
SENTINEL_VALUES = {
    999.0, 9999.0, 99999.0, -999.0, -9999.0, -99999.0,
    1e20, -1e20, 1e35, -1e35, 9.96921e36, -9.96921e36
}
SENTINEL_ABS_THRESHOLD = 1e19  # anything this large in magnitude is not a real ocean value

def _first_finite_scalar(var):
    if var is None:
        return None
    try:
        arr = np.array(var[:], dtype=float).reshape(-1)
    except Exception:
        return None
    for x in arr:
        if np.isfinite(x):
            return float(x)
    return None

def _as2d(v):
    if v is None:
        return None
    try:
        a = np.array(v[:])
    except Exception:
        return None
    if a.ndim == 1:
        return a.reshape(1, -1)
    return a

def _decode_bytes(x):
    if x is None:
        return None
    if isinstance(x, (bytes, np.bytes_)):
        return x.decode(errors="ignore").strip()
    if isinstance(x, np.ndarray):
        try:
            return "".join(x.astype(str).tolist()).strip()
        except Exception:
            pass
    return str(x).strip()

def _good(q):
    if q is None:
        return False
    if isinstance(q, (bytes, np.bytes_)):
        q = q.decode(errors="ignore")
    return str(q).strip() in ("1", "2")

def _qc_counts(qarr_row):
    out = {}
    if qarr_row is None:
        return out
    for q in np.ravel(qarr_row):
        if isinstance(q, (bytes, np.bytes_)):
            q = q.decode(errors="ignore")
        q = str(q).strip()
        if q and q != ' ':
            out[q] = out.get(q, 0) + 1
    return out

def _first_time_at_index(ds, i):
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
    return datetime(int(t.year), int(t.month), int(t.day),
                    int(getattr(t, "hour", 0)), int(getattr(t, "minute", 0)),
                    int(getattr(t, "second", 0)), int(getattr(t, "microsecond", 0))).replace(tzinfo=timezone.utc)

def _latlon_by_prof(ds, i):
    def pick(varname):
        v = ds.variables.get(varname)
        if v is None:
            return None
        arr = np.array(v[:]).reshape(-1)
        if i < len(arr) and np.isfinite(arr[i]):
            return float(arr[i])
        return _first_finite_scalar(v)
    lat = pick("LATITUDE_ADJUSTED"); lon = pick("LONGITUDE_ADJUSTED")
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
            json.dumps(v)
            ga[k] = v
        except Exception:
            ga[k] = str(v)
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
    parts = rel_path.replace("\\", "/").strip("/").split("/")
    if len(parts) < 3:
        raise ValueError(f"Bad rel_path: {rel_path}")
    dac = parts[0]; source_file = parts[-1]
    m = NC_RE.search(source_file)
    if not m:
        raise ValueError(f"Cannot parse WMO/cycle from {source_file}")
    wmo = int(m.group("wmo"))
    cycle_match = re.match(r"(\d+)", m.group("cycle"))
    if not cycle_match:
        raise ValueError(f"Cannot parse numeric cycle from {source_file}")
    cycle_number = int(cycle_match.group(1))
    prefix = (m.group("prefix") or "").upper()
    file_type = "bgc_sprof" if prefix.startswith("S") or "sprof" in rel_path.lower() else "core_profile"
    return dac, wmo, cycle_number, file_type, source_file

def _decode_text_var(var, index=None):
    if var is None:
        return None
    try:
        arr = chartostring(var[:])
        if index is None:
            return str(arr.reshape(-1)[0]).strip() if arr.ndim else str(arr.item()).strip()
        flat = arr.reshape(-1)
        return str(flat[index]).strip() if index < flat.size else None
    except Exception:
        try:
            x = var[:] if index is None else var[index]
        except Exception:
            return None
        if isinstance(x, (bytes, np.bytes_)):
            return x.decode(errors="ignore").strip()
        if isinstance(x, str):
            return x.strip()
        try:
            a = np.array(x)
            if a.dtype.kind in ("S", "U"):
                return "".join(a.astype(str).tolist()).strip()
        except Exception:
            pass
        return str(x).strip()

def _get_fill_and_valid(var):
    if var is None:
        return (None, None, None)
    _fill = getattr(var, "_FillValue", None)
    vmin = getattr(var, "valid_min", None)
    vmax = getattr(var, "valid_max", None)
    def _sc(x):
        if x is None:
            return None
        try:
            return float(np.array(x).reshape(-1)[0]) if hasattr(x, "shape") else float(x)
        except Exception:
            return None
    return (_sc(_fill), _sc(vmin), _sc(vmax))

def _is_sentinelish(xf):
    if not np.isfinite(xf):
        return True
    if abs(xf) >= SENTINEL_ABS_THRESHOLD:
        return True
    try:
        for s in SENTINEL_VALUES:
            if np.isclose(xf, s, rtol=0.0, atol=1e-6):
                return True
    except Exception:
        pass
    return False

def _clean_val(x, *, _fill=None, vmin=None, vmax=None, phys_key=None):
    if x is None:
        return None
    try:
        xf = float(x)
    except Exception:
        return None
    if _fill is not None:
        try:
            if np.isfinite(_fill) and np.isclose(xf, float(_fill)):
                return None
        except Exception:
            pass
    if _is_sentinelish(xf):
        return None
    if vmin is not None and xf < float(vmin):
        return None
    if vmax is not None and xf > float(vmax):
        return None
    if phys_key and phys_key in PHYS_RANGES:
        pmin, pmax = PHYS_RANGES[phys_key]
        if xf < pmin or xf > pmax:
            return None
    return xf

def ingest_file(nc_path: str, rel_path: str, conn):
    dac, wmo, cycle_number, file_type, source_file = parse_rel(rel_path)
    ds = None
    try:
        ds = Dataset(nc_path, "r")

        # floats + cycle
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO floats (wmo, dac)
                VALUES (%s, %s)
                ON CONFLICT (wmo) DO UPDATE
                  SET dac = EXCLUDED.dac, updated_at = now();
            """, (wmo, dac))
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO float_cycles (wmo, cycle_number)
                VALUES (%s, %s)
                ON CONFLICT (wmo, cycle_number) DO UPDATE
                  SET updated_at = now()
                RETURNING id;
            """, (wmo, cycle_number))
            cycle_id = cur.fetchone()[0]

        # dims/vars
        n_prof = len(ds.dimensions.get("N_PROF")) if "N_PROF" in ds.dimensions else 1

        direction_arr = ds.variables.get("DIRECTION")
        vss_arr       = ds.variables.get("VERTICAL_SAMPLING_SCHEME")
        data_mode_arr = ds.variables.get("DATA_MODE")

        global_attrs = _global_attrs(ds)

        PRES        = _as2d(ds.variables.get("PRES"))
        PRES_QC     = _as2d(ds.variables.get("PRES_QC") or ds.variables.get("PRES_ADJUSTED_QC"))

        TEMP        = _as2d(ds.variables.get("TEMP"))
        TEMP_QC     = _as2d(ds.variables.get("TEMP_QC"))
        TEMP_ADJ    = _as2d(ds.variables.get("TEMP_ADJUSTED"))
        TEMP_ADJ_QC = _as2d(ds.variables.get("TEMP_ADJUSTED_QC"))

        PSAL        = _as2d(ds.variables.get("PSAL"))
        PSAL_QC     = _as2d(ds.variables.get("PSAL_QC"))
        PSAL_ADJ    = _as2d(ds.variables.get("PSAL_ADJUSTED"))
        PSAL_ADJ_QC = _as2d(ds.variables.get("PSAL_ADJUSTED_QC"))

        DOXY        = _as2d(ds.variables.get("DOXY"))
        DOXY_QC     = _as2d(ds.variables.get("DOXY_QC"))
        DOXY_ADJ    = _as2d(ds.variables.get("DOXY_ADJUSTED"))
        DOXY_ADJ_QC = _as2d(ds.variables.get("DOXY_ADJUSTED_QC"))

        CHLA        = _as2d(ds.variables.get("CHLA"))
        CHLA_QC     = _as2d(ds.variables.get("CHLA_QC"))
        CHLA_ADJ    = _as2d(ds.variables.get("CHLA_ADJUSTED"))
        CHLA_ADJ_QC = _as2d(ds.variables.get("CHLA_ADJUSTED_QC"))

        PRES_fill, PRES_vmin, PRES_vmax = _get_fill_and_valid(ds.variables.get("PRES"))
        TEMP_fill, TEMP_vmin, TEMP_vmax = _get_fill_and_valid(ds.variables.get("TEMP"))
        PSAL_fill, PSAL_vmin, PSAL_vmax = _get_fill_and_valid(ds.variables.get("PSAL"))
        DOXY_fill, DOXY_vmin, DOXY_vmax = _get_fill_and_valid(ds.variables.get("DOXY"))
        CHLA_fill, CHLA_vmin, CHLA_vmax = _get_fill_and_valid(ds.variables.get("CHLA"))

        TEMP_A_fill, _, _ = _get_fill_and_valid(ds.variables.get("TEMP_ADJUSTED"))
        PSAL_A_fill, _, _ = _get_fill_and_valid(ds.variables.get("PSAL_ADJUSTED"))
        DOXY_A_fill, _, _ = _get_fill_and_valid(ds.variables.get("DOXY_ADJUSTED"))
        CHLA_A_fill, _, _ = _get_fill_and_valid(ds.variables.get("CHLA_ADJUSTED"))
        PRES_A_fill, _, _ = _get_fill_and_valid(ds.variables.get("PRES_ADJUSTED"))

        for pidx in range(n_prof):
            # time/loc
            t_utc = _first_time_at_index(ds, pidx)
            lat, lon = _latlon_by_prof(ds, pidx)

            direction = _decode_text_var(direction_arr, index=pidx)
            vertical_sampling_scheme = _decode_text_var(vss_arr, index=pidx)

            if data_mode_arr is not None:
                try:
                    data_mode = _decode_bytes(data_mode_arr[pidx])
                except Exception:
                    data_mode = _decode_bytes(getattr(ds, "DATA_MODE", None) or getattr(ds, "DATAMODE", None))
            else:
                data_mode = _decode_bytes(getattr(ds, "DATA_MODE", None) or getattr(ds, "DATAMODE", None))

            # core slices
            pres_row         = PRES[pidx] if PRES is not None else None
            pres_qc_row      = PRES_QC[pidx] if PRES_QC is not None else None

            temp_row         = TEMP[pidx] if TEMP is not None else None
            temp_qc_row      = TEMP_QC[pidx] if TEMP_QC is not None else None
            temp_adj_row     = TEMP_ADJ[pidx] if TEMP_ADJ is not None else None
            temp_adj_qc_row  = TEMP_ADJ_QC[pidx] if TEMP_ADJ_QC is not None else None

            psal_row         = PSAL[pidx] if PSAL is not None else None
            psal_qc_row      = PSAL_QC[pidx] if PSAL_QC is not None else None
            psal_adj_row     = PSAL_ADJ[pidx] if PSAL_ADJ is not None else None
            psal_adj_qc_row  = PSAL_ADJ_QC[pidx] if PSAL_ADJ_QC is not None else None

            qc_summary = {"temp_qc": _qc_counts(temp_qc_row), "psal_qc": _qc_counts(psal_qc_row)}
            has_adj_core = _has_adjusted_pair(temp_adj_row, temp_adj_qc_row) or _has_adjusted_pair(psal_adj_row, psal_adj_qc_row)

            # core stats
            n_core_levels = 0; max_pres = None
            if pres_row is not None:
                cleaned_pres = np.array([
                    _clean_val(pres_row[i], _fill=PRES_fill, vmin=PRES_vmin, vmax=PRES_vmax, phys_key="pres")
                    for i in range(len(pres_row))
                ], dtype=object)
                pres_valid = np.array([x is not None for x in cleaned_pres])
                n_core_levels = int(np.sum(pres_valid))
                if n_core_levels > 0:
                    max_pres = float(np.nanmax([x for x in cleaned_pres if x is not None]))

            modality = 'bgc' if file_type == 'bgc_sprof' else 'core'

            # profile record
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
                """, (cycle_id, data_mode, t_utc, lat, lon,
                      file_type, source_file, rel_path, Json(global_attrs), has_adj_core, Json(qc_summary),
                      direction, vertical_sampling_scheme, pidx, n_core_levels, max_pres, modality))
                profile_id = cur.fetchone()[0]

            # keep floats times
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE floats
                    SET first_profile_time = LEAST(COALESCE(first_profile_time, %s), %s),
                        last_profile_time  = GREATEST(COALESCE(last_profile_time, %s), %s),
                        meta_json = COALESCE(meta_json, '{}'::jsonb) || %s,
                        updated_at = now()
                    WHERE wmo = %s
                """, (t_utc, t_utc, t_utc, t_utc, Json(global_attrs), wmo))

            # ---------- CORE LEVELS ----------
            core_rows = []
            n_core = max(_safe_len(pres_row), _safe_len(temp_row), _safe_len(psal_row))
            for i in range(n_core):
                P  = _clean_val(pres_row[i] if (pres_row is not None and i < len(pres_row)) else None,
                                 _fill=PRES_fill, vmin=PRES_vmin, vmax=PRES_vmax, phys_key="pres")
                PQ = pres_qc_row[i] if (pres_qc_row is not None and i < len(pres_qc_row)) else None

                T  = _clean_val(temp_row[i] if (temp_row is not None and i < len(temp_row)) else None,
                                 _fill=TEMP_fill, vmin=TEMP_vmin, vmax=TEMP_vmax, phys_key="temp")
                TQ = temp_qc_row[i] if (temp_qc_row is not None and i < len(temp_qc_row)) else None

                TA = _clean_val(temp_adj_row[i] if (temp_adj_row is not None and i < len(temp_adj_row)) else None,
                                 _fill=TEMP_A_fill, vmin=TEMP_vmin, vmax=TEMP_vmax, phys_key="temp")
                TAQ = temp_adj_qc_row[i] if (temp_adj_qc_row is not None and i < len(temp_adj_qc_row)) else None

                S  = _clean_val(psal_row[i] if (psal_row is not None and i < len(psal_row)) else None,
                                 _fill=PSAL_fill, vmin=PSAL_vmin, vmax=PSAL_vmax, phys_key="psal")
                SQ = psal_qc_row[i] if (psal_qc_row is not None and i < len(psal_qc_row)) else None

                SA = _clean_val(psal_adj_row[i] if (psal_adj_row is not None and i < len(psal_adj_row)) else None,
                                 _fill=PSAL_A_fill, vmin=PSAL_vmin, vmax=PSAL_vmax, phys_key="psal")
                SAQ = psal_adj_qc_row[i] if (psal_adj_qc_row is not None and i < len(psal_adj_qc_row)) else None

                best_temp = TA if (TA is not None and _good(TAQ)) else (T if (T is not None and _good(TQ)) else None)
                best_psal = SA if (SA is not None and _good(SAQ)) else (S if (S is not None and _good(SQ)) else None)

                core_rows.append((profile_id, i, P, _decode_bytes(PQ) if PQ is not None else None,
                                  T, _decode_bytes(TQ) if TQ is not None else None,
                                  TA, _decode_bytes(TAQ) if TAQ is not None else None,
                                  best_temp,
                                  S, _decode_bytes(SQ) if SQ is not None else None,
                                  SA, _decode_bytes(SAQ) if SAQ is not None else None,
                                  best_psal))
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

            # ---------- BGC LEVELS ----------
            # Per-profile slices
            doxy_row         = DOXY[pidx]        if DOXY is not None else None
            doxy_qc_row      = DOXY_QC[pidx]     if DOXY_QC is not None else None
            doxy_adj_row     = DOXY_ADJ[pidx]    if DOXY_ADJ is not None else None
            doxy_adj_qc_row  = DOXY_ADJ_QC[pidx] if DOXY_ADJ_QC is not None else None

            chla_row         = CHLA[pidx]        if CHLA is not None else None
            chla_qc_row      = CHLA_QC[pidx]     if CHLA_QC is not None else None
            chla_adj_row     = CHLA_ADJ[pidx]    if CHLA_ADJ is not None else None
            chla_adj_qc_row  = CHLA_ADJ_QC[pidx] if CHLA_ADJ_QC is not None else None

            # pick pressure for BGC
            pres_bgc_row = None
            if ds.variables.get("PRES_ADJUSTED") is not None:
                pres_bgc_row = np.array(ds.variables["PRES_ADJUSTED"][pidx])
            elif PRES is not None:
                pres_bgc_row = pres_row

            # ---- guard 1: skip this profile if no BGC signal at all ----
            def _row_has_signal(row, fill, phys):
                if row is None:
                    return False
                try:
                    a = np.array(row, dtype=float).reshape(-1)
                except Exception:
                    return False
                # valid if any finite value that's not equal to fill and within physical range
                for v in a:
                    vv = _clean_val(v, _fill=fill, phys_key=phys)
                    if vv is not None:
                        return True
                return False

            has_any_bgc = any([
                _row_has_signal(doxy_row, DOXY_fill, "doxy"),
                _row_has_signal(doxy_adj_row, DOXY_A_fill, "doxy"),
                _row_has_signal(chla_row, CHLA_fill, "chla"),
                _row_has_signal(chla_adj_row, CHLA_A_fill, "chla"),
            ])

            if not has_any_bgc:
                # no BGC for this pidx – ensure table is clean for this profile_id and move on
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM levels_bgc WHERE profile_id=%s", (profile_id,))
                continue  # next profile

            # iterate by pressure length; if missing, fall back to BGC length
            n_bgc = _safe_len(pres_bgc_row)
            if n_bgc == 0:
                n_bgc = max(_safe_len(doxy_row), _safe_len(chla_row))  # last resort

            bgc_rows = []
            for i in range(n_bgc):
                P = _clean_val(
                    pres_bgc_row[i] if (pres_bgc_row is not None and i < len(pres_bgc_row)) else None,
                    _fill=(PRES_A_fill if ds.variables.get("PRES_ADJUSTED") is not None else PRES_fill),
                    vmin=PRES_vmin, vmax=PRES_vmax, phys_key="pres"
                )

                DO  = _clean_val(doxy_row[i] if (doxy_row is not None and i < len(doxy_row)) else None,
                                  _fill=DOXY_fill, vmin=DOXY_vmin, vmax=DOXY_vmax, phys_key="doxy")
                DOQ = doxy_qc_row[i] if (doxy_qc_row is not None and i < len(doxy_qc_row)) else None

                DOA = _clean_val(doxy_adj_row[i] if (doxy_adj_row is not None and i < len(doxy_adj_row)) else None,
                                  _fill=DOXY_A_fill, vmin=DOXY_vmin, vmax=DOXY_vmax, phys_key="doxy")
                DOAQ= doxy_adj_qc_row[i] if (doxy_adj_qc_row is not None and i < len(doxy_adj_qc_row)) else None

                CH  = _clean_val(chla_row[i] if (chla_row is not None and i < len(chla_row)) else None,
                                  _fill=CHLA_fill, vmin=CHLA_vmin, vmax=CHLA_vmax, phys_key="chla")
                CHQ = chla_qc_row[i] if (chla_qc_row is not None and i < len(chla_qc_row)) else None

                CHA = _clean_val(chla_adj_row[i] if (chla_adj_row is not None and i < len(chla_adj_row)) else None,
                                  _fill=CHLA_A_fill, vmin=CHLA_vmin, vmax=CHLA_vmax, phys_key="chla")
                CHAQ= chla_adj_qc_row[i] if (chla_adj_qc_row is not None and i < len(chla_adj_qc_row)) else None

                # ---- guard 2: skip levels with no pressure or no BGC payload ----
                if P is None:
                    continue
                if DO is None and DOA is None and CH is None and CHA is None:
                    continue

                bgc_rows.append((
                    profile_id, i, P,
                    DO, _decode_bytes(DOQ) if DOQ is not None else None,
                    DOA, _decode_bytes(DOAQ) if DOAQ is not None else None,
                    CH, _decode_bytes(CHQ) if CHQ is not None else None,
                    CHA, _decode_bytes(CHAQ) if CHAQ is not None else None
                ))

            with conn.cursor() as cur:
                cur.execute("DELETE FROM levels_bgc WHERE profile_id=%s", (profile_id,))
                if bgc_rows:
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

