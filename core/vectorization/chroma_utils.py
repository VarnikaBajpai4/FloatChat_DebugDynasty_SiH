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
    """
    Upsert data into ChromaDB collection with automatic batch handling.
    ChromaDB has a maximum batch size limit, so this function splits large batches.
    """
    # Maximum batch size allowed by ChromaDB
    MAX_BATCH_SIZE = 5461
    
    # Get the total number of items
    total_items = len(ids)
    
    if total_items <= MAX_BATCH_SIZE:
        # If within the limit, upsert all at once
        col.upsert(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
    else:
        # If over the limit, split into batches
        print(f"Splitting {total_items} items into batches of max {MAX_BATCH_SIZE}")
        
        # Calculate number of batches
        num_batches = (total_items + MAX_BATCH_SIZE - 1) // MAX_BATCH_SIZE
        
        for i in range(num_batches):
            # Calculate batch boundaries
            start_idx = i * MAX_BATCH_SIZE
            end_idx = min((i + 1) * MAX_BATCH_SIZE, total_items)
            
            # Extract batch data
            batch_ids = ids[start_idx:end_idx]
            batch_docs = docs[start_idx:end_idx]
            batch_metas = metas[start_idx:end_idx]
            batch_embeddings = embeddings[start_idx:end_idx]
            
            # Upsert batch
            print(f"Upserting batch {i+1}/{num_batches} ({len(batch_ids)} items)")
            col.upsert(ids=batch_ids, documents=batch_docs, metadatas=batch_metas, embeddings=batch_embeddings)
