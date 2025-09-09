from sentence_transformers import SentenceTransformer
from config import MODEL
from static_docs import SCHEMA_DOCS, COOKBOOK_DOCS, RULE_DOCS, VOCAB_DOCS, ROUTING_DOCS
from postgres_utils import connect_pg, fetch_profiles, fetch_floats
from doc_builders import profile_doc_meta, float_doc_meta
from chroma_utils import get_chroma_client, get_collections, upsert_chroma

def main():
    print("Starting embedding pipeline...")
    client = get_chroma_client()
    kb_col, profiles_col, floats_col = get_collections(client)
    model = SentenceTransformer(MODEL)

    # --- Static docs ---
    static_items = [(f"{k}:{key}", txt, {"kind": k, "key": key})
                    for k, key, txt in (SCHEMA_DOCS + COOKBOOK_DOCS + RULE_DOCS + VOCAB_DOCS + ROUTING_DOCS)]
    if static_items:
        ids   = [i for (i, _, _) in static_items]
        docs  = [t for (_, t, _) in static_items]
        metas = [m for (_, _, m) in static_items]
        embs  = model.encode(["passage: " + t for t in docs],
                             normalize_embeddings=True, batch_size=64, show_progress_bar=True)
        upsert_chroma(kb_col, ids, docs, metas, embs)

    # --- Profiles + Floats ---
    with connect_pg() as conn:
        # Profiles
        rows = fetch_profiles(conn)
        if rows:
            ids, docs, metas, texts = [], [], [], []
            for r in rows:
                _id, text, meta = profile_doc_meta(r)
                ids.append(_id); docs.append(text); metas.append(meta); texts.append("passage: " + text)
            embs = model.encode(texts, normalize_embeddings=True, batch_size=64, show_progress_bar=True)
            upsert_chroma(profiles_col, ids, docs, metas, embs)

        # Floats
        frows = fetch_floats(conn)
        if frows:
            ids, docs, metas, texts = [], [], [], []
            for r in frows:
                _id, text, meta = float_doc_meta(r)
                ids.append(_id); docs.append(text); metas.append(meta); texts.append("passage: " + text)
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
