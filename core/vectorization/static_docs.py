SCHEMA_DOCS = [
    ("schema", "floats",       "One row per instrument (float). Columns: wmo (PK), dac, first/last_profile_time, meta_json."),
    ("schema", "float_cycles", "One row per cycle per float. Columns: id (PK), wmo (FK->floats), cycle_number, inserted/updated."),
    ("schema", "profiles",     "One row per profile. FK: cycle_id->float_cycles.id. Includes time/lat/lon, file_type, modality, QC."),
    ("schema", "levels_core",  "Per-profile core levels: PRES/TEMP/PSAL (+adjusted, best_*). PK(profile_id, level_index)."),
    ("schema", "levels_bgc",   "Per-profile BGC levels: PRES, DOXY, CHLA (+adjusted). PK(profile_id, level_index)."),
]
COOKBOOK_DOCS = [
    ("cookbook", "latest_in_box", "Latest profile per WMO within region/time (use juld_time desc + ST/box filter)."),
]
RULE_DOCS = [
    ("rule", "data_mode_qc", "DATA_MODE R/A/D. QC 1/2 good, 3/4 suspect, 9 missing. Prefer adjusted if QC good."),
]
VOCAB_DOCS = [
    ("vocab", "aliases", "salinity->PSAL; temperature->TEMP; oxygen->DOXY; chlorophyll->CHLA."),
]
ROUTING_DOCS = [
    ("routing", "planner", "Filter profiles by time/region; join cycles for wmo/cycle_number; levels_* for variables."),
]
