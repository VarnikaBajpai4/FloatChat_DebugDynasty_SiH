def profile_doc_meta(r):
    t_iso = r["juld_time"].strftime("%Y-%m-%dT%H:%M:%SZ") if r["juld_time"] else None
    vars_present = ["TEMP", "PSAL"]
    if r["has_doxy"]: vars_present.append("DOXY")
    if r["has_chla"]: vars_present.append("CHLA")

    text = (
        f"ARGO profile wmo={r['wmo']} cycle={r['cycle_number']} modality={r.get('modality') or 'core'} "
        f"time={t_iso or 'na'} lat={r['latitude']:.4f} lon={r['longitude']:.4f} "
        f"file_type={r['file_type']} vars={','.join(vars_present)} "
        f"adjusted_core={'true' if r['has_adjusted_core'] else 'false'} "
        f"max_pres={r['max_pres'] if r['max_pres'] is not None else 'na'}"
    )
    meta = {
        "kind": "profile",
        "profile_id": r["id"],
        "wmo": r["wmo"],
        "cycle_number": r["cycle_number"],
        "modality": r.get("modality"),
        "time_iso": t_iso,
        "lat": float(r["latitude"]) if r["latitude"] is not None else None,
        "lon": float(r["longitude"]) if r["longitude"] is not None else None,
        "file_type": r["file_type"],
        "has_adjusted_core": bool(r["has_adjusted_core"]),
        "has_psal": True,
        "has_temp": True,
        "has_doxy": bool(r["has_doxy"]),
        "has_chla": bool(r["has_chla"]),
        "vars_present": ",".join(vars_present),
        "max_pres": float(r["max_pres"]) if r["max_pres"] is not None else None,
    }
    return f"profile:{r['id']}", text, meta

def float_doc_meta(r):
    first_iso = r["first_t"].strftime("%Y-%m-%dT%H:%M:%SZ") if r["first_t"] else None
    last_iso  = r["last_t"].strftime("%Y-%m-%dT%H:%M:%SZ")  if r["last_t"] else None
    text = (
      f"Float WMO={r['wmo']} (DAC={r['dac']}). Profiles={r['n_profiles']}. "
      f"First={first_iso or 'na'} Last={last_iso or 'na'} "
      f"Last_pos lat={(r['last_lat'] if r['last_lat'] is not None else 'na')} "
      f"lon={(r['last_lon'] if r['last_lon'] is not None else 'na')} "
      f"max_pres_ever={(r['max_pres_ever'] if r['max_pres_ever'] is not None else 'na')}"
    )
    meta = {
        "kind": "float",
        "wmo": r["wmo"],
        "dac": r["dac"],
        "profiles_count": r["n_profiles"],
        "first_time_iso": first_iso,
        "last_time_iso": last_iso,
        "last_lat": float(r["last_lat"]) if r["last_lat"] is not None else None,
        "last_lon": float(r["last_lon"]) if r["last_lon"] is not None else None,
        "max_pres_ever": float(r["max_pres_ever"]) if r["max_pres_ever"] is not None else None,
    }
    return f"wmo:{r['wmo']}", text, meta
