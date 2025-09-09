import os
from dotenv import load_dotenv

load_dotenv()

PG_DSN  = os.environ["PG_DSN"]
PERSIST = './chroma_data'
MODEL   = os.environ.get("EMB_MODEL", "intfloat/e5-small-v2")
