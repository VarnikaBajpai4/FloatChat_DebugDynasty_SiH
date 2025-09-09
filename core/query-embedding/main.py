from sentence_transformers import SentenceTransformer
import os

def get_query_embedding(query: str) -> list:
    MODEL = os.environ.get("EMB_MODEL", "intfloat/e5-small-v2")
    model = SentenceTransformer(MODEL)
    query_emb = model.encode("query: " + query, normalize_embeddings=True)
    return query_emb

if __name__ == "__main__":
    query = input("Enter your query: ")
    embedding = get_query_embedding(query)
    print("Embedding as string:", embedding)
