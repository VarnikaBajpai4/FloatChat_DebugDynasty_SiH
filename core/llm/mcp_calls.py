from fastmcp import Client

# Connect to the MCP server running at port 8000
mcp_client = Client("http://localhost:8000/mcp")

async def run_query(query):
    async with mcp_client:
        result = await mcp_client.call_tool("sql_query_tool", {"query": query})
        return result

async def fetch_schema():
    async with mcp_client:
        schema = await mcp_client.read_resource("data://knowledge_base/sql_schema_json")
        return schema
async def generate_time_series_plot(params):
    async with mcp_client:
        result = await mcp_client.call_tool("generate_time_series_tool", {"payload": params})
        return result
    
async def generate_heatmap_plot(params):
    async with mcp_client:
        result = await mcp_client.call_tool("generate_heatmap_tool", {"payload": params})
        return result

async def generate_map_points_plot(params):
    async with mcp_client:
        result = await mcp_client.call_tool("generate_map_points_tool", {"payload": params})
        return result

async def generate_time_series_compare_plot(params):
    async with mcp_client:
        result = await mcp_client.call_tool("generate_time_series_compare_tool", {"payload": params})
        return result
