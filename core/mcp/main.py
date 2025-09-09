from fastapi import FastAPI
from fastmcp import FastMCP
from tools.sql_query import sql_query, SqlQueryInput
from db.postgres import postgres_db
from dotenv import load_dotenv

load_dotenv()


app = FastAPI()

mcp = FastMCP.from_fastapi(app=app, name="FloatChat MCP")

@mcp.tool()
async def sql_query_tool(query: str):
    if not postgres_db.pool:
        await postgres_db.connect()
    params = SqlQueryInput(query=query)
    result = await sql_query(params)
    return result

if __name__ == "__main__":
    mcp.run(transport="http", port=8000)
