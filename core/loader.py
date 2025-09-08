import os
import psycopg2
import traceback
from dotenv import load_dotenv
from transform import ingest_file

load_dotenv()  # take environment variables from .env.
ROOT = "./argo_nc"    # same --dest you used in extract.py
DSN  = os.environ.get("PG_DSN")  # e.g., "dbname=argo user=argo password=... host=127.0.0.1"

if not DSN:
    raise RuntimeError("Please set PG_DSN environment variable (e.g., export PG_DSN='dbname=argo user=argo ...')")

def walk_and_ingest():
    with psycopg2.connect(DSN) as conn:
        for dirpath, _, files in os.walk(os.path.join(ROOT, "dac")):
            for name in files:
                if not name.lower().endswith(".nc"):
                    continue
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, os.path.join(ROOT, "dac")).replace("\\","/")
                try:
                    print(f"[INGEST] {rel} ...")
                    ingest_file(full, rel, conn)
                except Exception as e:
                    # print the error and move on to next file
                    print(f"[ERROR] ingest failed for {rel}: {e}")
                    traceback.print_exc()

if __name__ == "__main__":
    walk_and_ingest()
