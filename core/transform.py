import os
import re
import json
import numpy as np
import psycopg2
from psycopg2.extras import execute_values, Json
from netCDF4 import Dataset, num2date
from datetime import datetime, timezone

NC_RE = re.compile(
    r'(?P<prefix>[A-Za-z]*)(?P<wmo>\d{6,10})_(?P<cycle>\d+[A-Za-z]?)\.nc$'
)


def _first_finite_scalar(var):
    """Return first finite float from a NetCDF var (handles masked arrays), else None."""
    if var is None:
        return None
    try:
        arr = np.array(var[:], dtype=float)  # converts masked to ndarray with mask -> nan
    except Exception:
        return None
    arr = arr.reshape(-1)                # flatten
    for x in arr:
        if np.isfinite(x):
            return float(x)
    return None


def _latlon(ds):
    """Prefer adjusted coords if present; fall back to raw; return (lat, lon) or (None, None)."""
    lat = _first_finite_scalar(ds.variables.get("LATITUDE_ADJUSTED")) \
          or _first_finite_scalar(ds.variables.get("LATITUDE"))
    lon = _first_finite_scalar(ds.variables.get("LONGITUDE_ADJUSTED")) \
          or _first_finite_scalar(ds.variables.get("LONGITUDE"))
    return lat, lon


def parse_rel(rel_path: str):
    """
    rel_path like: 'aoml/1901839/profiles/R1901839_325.nc'
    returns: dac (str), wmo (int), cycle_number (int), file_type (str), source_file (str)
    - cycle_number is integer (leading digits of cycle)
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
    # Extract leading integer portion for cycle_number (handles '325' and '325A' -> 325)
    cycle_match = re.match(r"(\d+)", cycle_raw)
    if not cycle_match:
        raise ValueError(f"Cannot parse numeric cycle from {cycle_raw} in {source_file}")
    cycle_number = int(cycle_match.group(1))
    prefix = (m.group("prefix") or "").upper()
    file_type = "bgc_sprof" if prefix.startswith("S") or "sprof" in rel_path.lower() else "core_profile"
    return dac, wmo, cycle_number, file_type, source_file


def _as1d(v):
    if v is None:
        return None
    try:
        a = np.array(v[:])
    except Exception:
        return None
    return a.reshape(-1)


def _good(q):
    # accept '1' and '2' as good
    if q is None:
        return False
    if isinstance(q, (bytes, np.bytes_)):
        q = q.decode(errors="ignore")
    return str(q) in ("1", "2")


def _qc_counts(qarr):
    out = {}
    if qarr is None:
        return out
    flat = [(x.decode() if isinstance(x, (bytes, np.bytes_)) else str(x)) for x in np.ravel(qarr)]
    for q in flat:
        if q and q != ' ':
            out[q] = out.get(q, 0) + 1
    return out


def _first_time(ds):
    """
    Return a Python datetime with UTC tzinfo from JULD/TIME.
    Handles cftime objects safely.
    """
    j = ds.variables.get("JULD") or ds.variables.get("TIME")
    if j is None:
        return None

    cal = getattr(j, "calendar", "standard")
    try:
        t = num2date(j[:], units=j.units, calendar=cal, only_use_cftime_datetimes=False)
    except Exception:
        try:
            t = num2date(j[:], units=j.units, calendar=cal, only_use_cftime_datetimes=True)
        except Exception:
            return None

    if hasattr(t, "tolist"):
        t = t.tolist()
    if isinstance(t, (list, np.ndarray)):
        if len(t) == 0:
            return None
        t = t[0]

    if isinstance(t, datetime):
        return t if t.tzinfo else t.replace(tzinfo=timezone.utc)

    # cftime object fallback:
    return datetime(
        int(t.year), int(t.month), int(t.day),
        int(getattr(t, "hour", 0)), int(getattr(t, "minute", 0)),
        int(getattr(t, "second", 0)), int(getattr(t, "microsecond", 0))
    ).replace(tzinfo=timezone.utc)


def _str_or_none(x):
    if x is None:
        return None
    if isinstance(x, (bytes, np.bytes_)):
        return x.decode(errors="ignore")
    return str(x)


def _global_attrs(ds):
    ga = {}
    for k in ds.ncattrs():
        try:
            v = getattr(ds, k)
            if isinstance(v, bytes):
                v = v.decode(errors="ignore")
            # try to JSON-serialize basic types; otherwise convert to str
            try:
                json.dumps(v)
                ga[k] = v
            except Exception:
                ga[k] = str(v)
        except Exception:
            pass
    return ga


def _has_adjusted(var_adj, var_adj_qc):
    v = _as1d(var_adj); q = _as1d(var_adj_qc)
    if v is None or q is None:
        return False
    n = min(len(v), len(q))
    for i in range(n):
        if v[i] is not None and _good(q[i]):
            return True
    return False


def _safe_len(arr):
    return len(arr) if arr is not None else 0


def ingest_file(nc_path: str, rel_path: str, conn):
    """
    nc_path: absolute path to downloaded .nc
    rel_path: path relative to 'dac/' root used by extract.py (e.g., 'aoml/1901839/profiles/R1901839_325.nc')
    conn: psycopg2 connection
    """
    dac, wmo, cycle_number, file_type, source_file = parse_rel(rel_path)
    source_path = rel_path

    ds = None
    try:
        ds = Dataset(nc_path, "r")

        # --- Floats minimal upsert (ensure a row exists)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO floats (wmo, dac)
                VALUES (%s, %s)
                ON CONFLICT (wmo) DO UPDATE SET dac = EXCLUDED.dac, updated_at = now();
            """, (wmo, dac))

        # --- Profile basics
        t_utc = _first_time(ds)
        lat, lon = _latlon(ds)

        # data_mode (best-effort)
        data_mode = None
        # DATA_MODE may be variable or global attribute; try both
        if "DATA_MODE" in ds.variables:
            try:
                data_mode = "".join(ds.variables["DATA_MODE"][:].astype(str)).strip() or None
            except Exception:
                data_mode = None
        else:
            # global attribute fallback
            data_mode = getattr(ds, "DATA_MODE", None) or getattr(ds, "DATAMODE", None)

        # QC counts for core
        temp_qc = ds.variables.get("TEMP_QC") or ds.variables.get("TEMP_ADJUSTED_QC")
        psal_qc = ds.variables.get("PSAL_QC") or ds.variables.get("PSAL_ADJUSTED_QC")
        qc_summary = {
            "temp_qc": _qc_counts(temp_qc),
            "psal_qc": _qc_counts(psal_qc),
        }

        # has_adjusted_core flag
        has_adj_core = _has_adjusted(ds.variables.get("TEMP_ADJUSTED"), ds.variables.get("TEMP_ADJUSTED_QC")) \
                       or _has_adjusted(ds.variables.get("PSAL_ADJUSTED"), ds.variables.get("PSAL_ADJUSTED_QC"))

        global_attrs = _global_attrs(ds)

        # --- Upsert profile, get id
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO profiles
                  (wmo, cycle_number, data_mode, juld_time, latitude, longitude,
                   file_type, source_file, source_path, global_attrs, has_adjusted_core, qc_summary)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (wmo, cycle_number) DO UPDATE
                  SET data_mode=EXCLUDED.data_mode,
                      juld_time=EXCLUDED.juld_time,
                      latitude=EXCLUDED.latitude,
                      longitude=EXCLUDED.longitude,
                      file_type=EXCLUDED.file_type,
                      source_file=EXCLUDED.source_file,
                      source_path=EXCLUDED.source_path,
                      global_attrs=EXCLUDED.global_attrs,
                      has_adjusted_core=EXCLUDED.has_adjusted_core,
                      qc_summary=EXCLUDED.qc_summary,
                      updated_at=now()
                RETURNING id;
            """, (wmo, cycle_number, data_mode, t_utc, lat, lon,
                  file_type, source_file, source_path, Json(global_attrs), has_adj_core, Json(qc_summary)))
            profile_id = cur.fetchone()[0]

        # Update floats first/last profile times and meta_json
        with conn.cursor() as cur:
            # Use LEAST/GREATEST and JSONB merge (existing_meta || new_meta)
            cur.execute("""
                UPDATE floats
                SET
                  first_profile_time = LEAST(COALESCE(first_profile_time, %s), %s),
                  last_profile_time  = GREATEST(COALESCE(last_profile_time, %s), %s),
                  meta_json = COALESCE(meta_json, '{}'::jsonb) || %s,
                  updated_at = now()
                WHERE wmo = %s
            """, (t_utc, t_utc, t_utc, t_utc, Json(global_attrs), wmo))

        # --- CORE LEVELS (TEMP/PSAL/PRES)
        pres = _as1d(ds.variables.get("PRES"))
        pres_qc = _as1d(ds.variables.get("PRES_QC") or ds.variables.get("PRES_ADJUSTED_QC"))
        temp = _as1d(ds.variables.get("TEMP"))
        psal = _as1d(ds.variables.get("PSAL"))
        t_qc = _as1d(ds.variables.get("TEMP_QC"))
        s_qc = _as1d(ds.variables.get("PSAL_QC"))
        t_adj = _as1d(ds.variables.get("TEMP_ADJUSTED"))
        s_adj = _as1d(ds.variables.get("PSAL_ADJUSTED"))
        t_adj_qc = _as1d(ds.variables.get("TEMP_ADJUSTED_QC"))
        s_adj_qc = _as1d(ds.variables.get("PSAL_ADJUSTED_QC"))

        n_core = max(_safe_len(pres), _safe_len(temp), _safe_len(psal))

        core_rows = []
        for i in range(n_core):
            P  = float(pres[i]) if (pres is not None and i < len(pres) and np.isfinite(pres[i])) else None
            PQ = pres_qc[i] if (pres_qc is not None and i < len(pres_qc)) else None

            T  = float(temp[i]) if (temp is not None and i < len(temp) and np.isfinite(temp[i])) else None
            TQ = t_qc[i]  if (t_qc is not None and i < len(t_qc)) else None
            TA = float(t_adj[i]) if (t_adj is not None and i < len(t_adj) and np.isfinite(t_adj[i])) else None
            TAQ = t_adj_qc[i] if (t_adj_qc is not None and i < len(t_adj_qc)) else None

            S  = float(psal[i]) if (psal is not None and i < len(psal) and np.isfinite(psal[i])) else None
            SQ = s_qc[i]  if (s_qc is not None and i < len(s_qc)) else None
            SA = float(s_adj[i]) if (s_adj is not None and i < len(s_adj) and np.isfinite(s_adj[i])) else None
            SAQ = s_adj_qc[i] if (s_adj_qc is not None and i < len(s_adj_qc)) else None

            best_temp = TA if (TA is not None and _good(TAQ)) else (T if (T is not None and _good(TQ)) else None)
            best_psal = SA if (SA is not None and _good(SAQ)) else (S if (S is not None and _good(SQ)) else None)

            core_rows.append((
                profile_id, i,
                P, _str_or_none(PQ),
                T, _str_or_none(TQ), TA, _str_or_none(TAQ), best_temp,
                S, _str_or_none(SQ), SA, _str_or_none(SAQ), best_psal
            ))

        with conn.cursor() as cur:
            # replace levels_core for that profile_id
            cur.execute("DELETE FROM levels_core WHERE profile_id=%s", (profile_id,))
            if core_rows:
                execute_values(cur, """
                    INSERT INTO levels_core
                    (profile_id, level_index, pres, pres_qc,
                     temp, temp_qc, temp_adjusted, temp_adjusted_qc, best_temp,
                     psal, psal_qc, psal_adjusted, psal_adjusted_qc, best_psal)
                    VALUES %s
                """, core_rows)

        # --- BGC LEVELS (optional, only if present)
        bgc_rows = []
        doxy = _as1d(ds.variables.get("DOXY"))
        doxy_qc = _as1d(ds.variables.get("DOXY_QC"))
        doxy_adj = _as1d(ds.variables.get("DOXY_ADJUSTED"))
        doxy_adj_qc = _as1d(ds.variables.get("DOXY_ADJUSTED_QC"))

        chla = _as1d(ds.variables.get("CHLA"))
        chla_qc = _as1d(ds.variables.get("CHLA_QC"))
        chla_adj = _as1d(ds.variables.get("CHLA_ADJUSTED"))
        chla_adj_qc = _as1d(ds.variables.get("CHLA_ADJUSTED_QC"))

        pres_bgc = None
        if ds.variables.get("PRES_ADJUSTED") is not None:
            pres_bgc = _as1d(ds.variables["PRES_ADJUSTED"])
        elif ds.variables.get("PRES") is not None:
            pres_bgc = _as1d(ds.variables["PRES"])
        elif pres is not None:
            pres_bgc = pres

        if any(v is not None for v in (doxy, chla)):
            n_bgc = max(_safe_len(pres_bgc), _safe_len(doxy), _safe_len(chla))
            for i in range(n_bgc):
                P  = float(pres_bgc[i]) if (pres_bgc is not None and i < len(pres_bgc) and np.isfinite(pres_bgc[i])) else None

                DO  = float(doxy[i]) if (doxy is not None and i < len(doxy) and np.isfinite(doxy[i])) else None
                DOQ = doxy_qc[i] if (doxy_qc is not None and i < len(doxy_qc)) else None
                DOA = float(doxy_adj[i]) if (doxy_adj is not None and i < len(doxy_adj) and np.isfinite(doxy_adj[i])) else None
                DOAQ= doxy_adj_qc[i] if (doxy_adj_qc is not None and i < len(doxy_adj_qc)) else None

                CH  = float(chla[i]) if (chla is not None and i < len(chla) and np.isfinite(chla[i])) else None
                CHQ = chla_qc[i] if (chla_qc is not None and i < len(chla_qc)) else None
                CHA = float(chla_adj[i]) if (chla_adj is not None and i < len(chla_adj) and np.isfinite(chla_adj[i])) else None
                CHAQ= chla_adj_qc[i] if (chla_adj_qc is not None and i < len(chla_adj_qc)) else None

                bgc_rows.append((
                    profile_id, i, P,
                    DO, _str_or_none(DOQ), DOA, _str_or_none(DOAQ),
                    CH, _str_or_none(CHQ), CHA, _str_or_none(CHAQ)
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

    except Exception as e:
        # raise to caller after making sure dataset is closed
        raise
    finally:
        if ds is not None:
            try:
                ds.close()
            except Exception:
                pass
