#this file has a fastapi endpoint named /query. this is the orchestration layer for ALL the operations

from fastapi import FastAPI
import json

from dotenv import load_dotenv
load_dotenv()
from openai import OpenAI
import os

from models import QueryRequest, QueryResponse
from constants import ORCHESTRATION_PROMPT, SQL_PROMPT, SYSTEM_PROMPT, GATEKEEPER_PROMPT

import asyncio
from mcp_calls import run_query, fetch_schema
app = FastAPI()

llm_client = OpenAI(
    base_url = "https://openrouter.ai/api/v1",
    api_key = os.getenv("API_KEY")
)

print("Using model:", os.getenv("MODEL_NAME"))
@app.post("/query")
async def query_endpoint(payload: QueryRequest):
    # payload.message is the user message, payload.history is the chat history,
    # payload.role is the user role (which can be "Default", "Policy-Maker", "Researcher", "Student")
    #first, the llm client has the gatekeep check
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": GATEKEEPER_PROMPT},
        *[{"role": msg.role, "content": msg.content} for msg in payload.history],
        {"role": "user", "content": payload.message}
    ]
    response = llm_client.chat.completions.create(
        model=os.getenv("MODEL_NAME"),
        messages=messages,
        max_tokens=500,
        temperature=0.2,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0,
        stop=None
    )
    parsed_response = json.loads(response.choices[0].message.content)
    
    if parsed_response["label"] != "proceed":
        return {
            "text": parsed_response["question"] if parsed_response["label"] == "needs_more_info" else "Your query is irrelevant or off-topic. Please ask a relevant question about ARGO float data.",
            "links": None,
            "QC": None
        }
    #let us assume for now, that all the queries will result in the formation of a plot. let us continue
    #now, we need to have the orchestrator layer. this will decide which plot there is goint to be
    #to do this, we will need to have RAG retrieved, as well as establish a connection the the MCP server running on port 8000
    #lets connect mcp first
    schema = await fetch_schema()
    print("Schema fetched")
    first_item = schema[0]
    json_str = first_item.text  # This is a JSON string
    parsed_schema = json.loads(json_str)  # now parsed_schema is a Python dict


    # If you want to embed this in a prompt, you can serialize it again:
    schema_content_json = json.dumps(parsed_schema)


    #skipping RAG for now
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": ORCHESTRATION_PROMPT},
        {"role": "system", "content": f"Here is the database schema: {schema_content_json}"},
        *[{"role": msg.role, "content": msg.content} for msg in payload.history],
        {"role": "user", "content": payload.message}
    ]
    response = llm_client.chat.completions.create(
        model=os.getenv("MODEL_NAME"),
        messages=messages,
        temperature=0.2,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0,
        stop=None
    )
    orchestration_decision = json.loads(response.choices[0].message.content)
    print("Orchestration decision:", orchestration_decision)
    if orchestration_decision.get("missing_detail") != '':
        return {
            "text": orchestration_decision["missing_detail"],
            "links": None,
            "QC": None
        }
    
    #now, we have the orchestration decision. we need to now form the SQL query for each of the visualizations
    #another llm call to make the sql query
    messages =[
        {"role": "system", "content": SYSTEM_PROMPT},
        *[{"role": msg.role, "content": msg.content} for msg in payload.history],
        {"role": "system", "content": f"Here is the database schema: {schema_content_json}"},
        {"role": "system", "content": f"Here is visualization data: {json.dumps(orchestration_decision)}"},
        {"role": "system", "content": SQL_PROMPT},
        {"role": "user", "content": payload.message}
    ]
    response = llm_client.chat.completions.create(
        model=os.getenv("MODEL_NAME"),
        messages=messages,
        temperature=0.2,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0,
        stop=None
    )
    print("SQL generation response:", response.choices[0].message.content)
    sql_query_data = json.loads(response.choices[0].message.content)
    print("Generated SQL query:", sql_query_data)
    queries= []
    for item in sql_query_data["visualizations"]:
        queries.append(item["sql"])
    
    #now, we have the sql queries. we need to run them on the MCP server
    query_results = await asyncio.gather(*(run_query(query) for query in queries))
    print("Query results:", query_results)

    
    return {
        "text": "Your query has been accepted and is being processed.",
        "links": None,
        "QC": None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, port = 7500)