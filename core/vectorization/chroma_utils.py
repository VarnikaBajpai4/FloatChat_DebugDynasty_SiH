import chromadb
from chromadb.config import Settings
from config import PERSIST

def get_chroma_client():
    return chromadb.PersistentClient(path=PERSIST, settings=Settings(anonymized_telemetry=False))

def get_collections(client):
    kb_col       = client.get_or_create_collection("argo_kb",      metadata={"hnsw:space":"cosine"})
    profiles_col = client.get_or_create_collection("argo_profiles", metadata={"hnsw:space":"cosine"})
    floats_col   = client.get_or_create_collection("argo_floats",   metadata={"hnsw:space":"cosine"})
    return kb_col, profiles_col, floats_col

def upsert_chroma(col, ids, docs, metas, embeddings):
    col.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
