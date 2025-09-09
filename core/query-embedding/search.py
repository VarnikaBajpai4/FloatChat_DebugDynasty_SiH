# search.py
import os
import sys
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings

# --- Import config from vectorization ---
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "vectorization"))
from config import PERSIST  # <- same persist path as vectorization

# --- Setup Chroma client ---
client = chromadb.PersistentClient(path=PERSIST, settings=Settings(anonymized_telemetry=False))

# --- Embedding model ---
MODEL = os.environ.get("EMB_MODEL", "intfloat/e5-small-v2")
model = SentenceTransformer(MODEL)

def get_query_embedding(query: str):
    return model.encode("query: " + query, normalize_embeddings=True)

def search_in_collections(query_emb, top_k=5):
    results = {}
    for col_name in [c.name for c in client.list_collections()]:
        col = client.get_collection(col_name)

        print(f"\n=== {col_name} ===")
        try:
            res = col.query(
                query_embeddings=[query_emb],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],  # ✅ fixed
            )
            results[col_name] = res
            if res and res.get("documents"):
                for doc, meta, dist in zip(
                    res["documents"][0],
                    res["metadatas"][0],
                    res["distances"][0]
                ):
                    print(f"- {doc[:100]}... | {meta} | score={1-dist:.4f}")
            else:
                print("  (no results)")
        except Exception as e:
            print(f"  [ERROR] {e}")
    return results

if __name__ == "__main__":
    query = input("Enter your query: ")
    q_emb = get_query_embedding(query)

    print("\n[DEBUG] Collections available:")
    for c in client.list_collections():
        print(f" - {c.name}: {c.count()} docs")

    out = search_in_collections(q_emb, top_k=10)
