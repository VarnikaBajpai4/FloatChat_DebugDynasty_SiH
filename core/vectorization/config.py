import os
from dotenv import load_dotenv

load_dotenv()

PG_DSN  = os.environ["PG_DSN"]
BASE_DIR = os.path.dirname(__file__)
PERSIST = os.path.join(BASE_DIR, "chroma_data")
MODEL   = os.environ.get("EMB_MODEL", "intfloat/e5-small-v2")
