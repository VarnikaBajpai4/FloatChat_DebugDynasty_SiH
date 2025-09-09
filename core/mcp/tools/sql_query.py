from pydantic import BaseModel
from db.postgres import postgres_db

class SqlQueryInput(BaseModel):
    query: str

async def sql_query(params: SqlQueryInput):
    if not params.query.strip().lower().startswith("select"):
        raise ValueError("Only SELECT queries are allowed.")
    results = await postgres_db.fetch(params.query)
    
    return {"results": results}
