# core/chroma_quick_search.py
import chromadb
from sentence_transformers import SentenceTransformer
c = chromadb.PersistentClient(path="./chroma_data")
profiles = c.get_collection("argo_profiles")
kb = c.get_collection("argo_kb")
m = SentenceTransformer("intfloat/e5-small-v2")
q = "salinity profiles near the equator last month"
qv = m.encode(["query: "+q], normalize_embeddings=True)[0]
print(kb.query(query_embeddings=[qv], n_results=3))
print(profiles.query(query_embeddings=[qv], n_results=3, where={"has_psal": True}))