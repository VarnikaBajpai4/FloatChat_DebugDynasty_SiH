# core/embedding.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

load_dotenv()

# --- Config ---
PG_DSN  = os.environ["PG_DSN"]
PERSIST = os.environ.get("CHROMA_DIR", "./chroma_data")
MODEL   = os.environ.get("EMB_MODEL", "intfloat/e5-small-v2")  # same default as before

# --- Static knowledge (unchanged content; concise on purpose) ---
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

# --- Postgres ---
def connect_pg():
    return psycopg2.connect(PG_DSN)

def fetch_profiles(conn, batch=50000):
    """
    Pull profile rows with joined wmo/cycle_number + BGC presence flags, in ID order.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            WITH vars AS (
              SELECT p.id AS profile_id,
                     BOOL_OR(lb.doxy IS NOT NULL) AS has_doxy,
                     BOOL_OR(lb.chla IS NOT NULL) AS has_chla
              FROM profiles p
              LEFT JOIN levels_bgc lb ON lb.profile_id = p.id
              GROUP BY p.id
            )
            SELECT
                p.id,
                fc.wmo,
                fc.cycle_number,
                p.modality,
                p.data_mode,
                p.juld_time,
                p.latitude,
                p.longitude,
                p.file_type,
                p.has_adjusted_core,
                p.max_pres,
                COALESCE(v.has_doxy,false) AS has_doxy,
                COALESCE(v.has_chla,false) AS has_chla
            FROM profiles p
            JOIN float_cycles fc ON fc.id = p.cycle_id
            JOIN floats f ON f.wmo = fc.wmo
            LEFT JOIN vars v ON v.profile_id = p.id
            ORDER BY p.id
            LIMIT %s;
        """, (batch,))
        return cur.fetchall()

def fetch_floats(conn):
    """
    Aggregate per-float stats from profiles joined through float_cycles.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            WITH prof AS (
              SELECT
                p.id, p.juld_time, p.latitude, p.longitude, p.max_pres, fc.wmo
              FROM profiles p
              JOIN float_cycles fc ON fc.id = p.cycle_id
            ),
            agg AS (
              SELECT
                wmo,
                MIN(juld_time) AS first_t,
                MAX(juld_time) AS last_t,
                COUNT(*) AS n_profiles,
                MAX(max_pres) AS max_pres_ever
              FROM prof
              GROUP BY wmo
            ),
            lastpos AS (
              SELECT DISTINCT ON (wmo)
                wmo, latitude AS last_lat, longitude AS last_lon, juld_time AS last_t
              FROM prof
              ORDER BY wmo, juld_time DESC
            )
            SELECT
              f.wmo, f.dac,
              a.n_profiles, a.first_t, a.last_t,
              lp.last_lat, lp.last_lon,
              a.max_pres_ever
            FROM floats f
            JOIN agg a ON a.wmo = f.wmo
            LEFT JOIN lastpos lp ON lp.wmo = f.wmo
            ORDER BY f.wmo;
        """)
        return cur.fetchall()

# --- Document builders ---
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
    _id = f"profile:{r['id']}"
    return _id, text, meta

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
    _id = f"wmo:{r['wmo']}"
    return _id, text, meta

# --- Chroma upsert ---
def upsert_chroma(col, ids, docs, metas, embeddings):
    col.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)

# --- Main ---
def main():
    print("Using Chroma path:", PERSIST)
    client = chromadb.PersistentClient(path=PERSIST, settings=Settings(anonymized_telemetry=False))
    kb_col       = client.get_or_create_collection("argo_kb",      metadata={"hnsw:space":"cosine"})
    profiles_col = client.get_or_create_collection("argo_profiles", metadata={"hnsw:space":"cosine"})
    floats_col   = client.get_or_create_collection("argo_floats",   metadata={"hnsw:space":"cosine"})
    model = SentenceTransformer(MODEL)

    # --- Static docs ---
    static_items = []
    for k, key, txt in (SCHEMA_DOCS + COOKBOOK_DOCS + RULE_DOCS + VOCAB_DOCS + ROUTING_DOCS):
        static_items.append((f"{k}:{key}", txt, {"kind": k, "key": key}))
    if static_items:
        ids   = [i for (i, _, _) in static_items]
        docs  = [t for (_, t, _) in static_items]
        metas = [m for (_, _, m) in static_items]
        embs  = model.encode(["passage: " + t for t in docs],
                             normalize_embeddings=True, batch_size=64, show_progress_bar=True)
        upsert_chroma(kb_col, ids, docs, metas, embs)

    # --- Dynamic: profiles + floats ---
    with connect_pg() as conn:
        # Profiles
        rows = fetch_profiles(conn)
        if rows:
            ids, docs, metas = [], [], []
            texts = []
            for r in rows:
                _id, text, meta = profile_doc_meta(r)
                ids.append(_id); docs.append(text); metas.append(meta)
                texts.append("passage: " + text)
            embs = model.encode(texts, normalize_embeddings=True, batch_size=64, show_progress_bar=True)
            upsert_chroma(profiles_col, ids, docs, metas, embs)

        # Floats
        frows = fetch_floats(conn)
        if frows:
            ids, docs, metas = [], [], []
            texts = []
            for r in frows:
                _id, text, meta = float_doc_meta(r)
                ids.append(_id); docs.append(text); metas.append(meta)
                texts.append("passage: " + text)
            embs = model.encode(texts, normalize_embeddings=True, batch_size=64, show_progress_bar=True)
            upsert_chroma(floats_col, ids, docs, metas, embs)

    # --- Verify ---
    print("Chroma embeddings upsert complete.")
    print("Collections:", [col.name for col in client.list_collections()])
    print("Profiles count:", profiles_col.count())
    print("Floats count:",   floats_col.count())
    print("KB count:",       kb_col.count())

if __name__ == "__main__":
    main()