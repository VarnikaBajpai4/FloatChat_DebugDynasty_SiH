#this file has a fastapi endpoint named /query. this is the orchestration layer for ALL the operations

from fastapi import FastAPI
import json
import re

from dotenv import load_dotenv
load_dotenv()
from openai import OpenAI
import os

from models import QueryRequest, QueryResponse
from constants import ORCHESTRATION_PROMPT, SQL_PROMPT, SYSTEM_PROMPT, GATEKEEPER_PROMPT, SUMMARY_PROMPT

import asyncio
from mcp_calls import generate_time_series_plot,generate_time_series_compare_plot,generate_map_points_plot, generate_heatmap_plot, run_query, fetch_schema
app = FastAPI()

def strip_code_fences(text: str) -> str:
    """
    Remove Markdown code fences from a string if present.

    Handles:
    - ```json\n{...}\n```
    - ```\n{...}\n```
    - ```{...}```
    - Single backtick wrapping: `{...}`

    Returns the inner content trimmed; returns input unchanged if no fences found.
    """
    if not isinstance(text, str):
        return text
    s = text.strip()

    # Handle fenced code blocks like ```json\n{...}\n```
    if s.startswith("```"):
        # Remove opening fence with optional language hint, with optional newline
        m = re.match(r"^```[a-zA-Z0-9_-]*\s*\n?", s, flags=re.IGNORECASE)
        if m:
            s = s[m.end():]
        else:
            # Fallback: drop the first three backticks
            s = s[3:]
        # Remove trailing closing fence if present
        if s.endswith("```"):
            s = s[:-3]
        s = s.strip()

    # In case single backticks were used around the whole payload
    if s.startswith("`") and s.endswith("`") and len(s) >= 2:
        s = s[1:-1].strip()

    return s

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
    print("Gatekeeper response:", response.choices[0].message.content)
    parsed_response = json.loads(strip_code_fences(response.choices[0].message.content))
    
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
    orchestration_decision = json.loads(strip_code_fences(response.choices[0].message.content))
    print("Orchestration decision:", orchestration_decision)
    if orchestration_decision.get("missing_detail") != '':
        return {
            "text": orchestration_decision["missing_detail"],
            "links": None,
            "QC": None
        }
    visualization_name = orchestration_decision["chosen_visualizations"][0]["op"]
    print("Chosen visualization:", visualization_name)
    #now, we have the orchestration decision. we need to now form the SQL query for each of the visualizations
    #another llm call to make the sql query
    messages =[
        {"role": "system", "content": SYSTEM_PROMPT},
        *[{"role": msg.role, "content": msg.content} for msg in payload.history],
        {"role": "system", "content": f"Here is visualization data: {json.dumps(orchestration_decision)}"},
        {"role": "system", "content": SQL_PROMPT},
        {"role": "user", "content": payload.message},
        {"role": "system", "content": f"Here is the database schema. THIS IS THE MOST IMPORTANT PART, DO NOT HALLUCINATE : {schema_content_json}"},
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
    sql_query_data = json.loads(strip_code_fences(response.choices[0].message.content))
    print("Generated SQL query:", sql_query_data)
    query= sql_query_data["visualizations"][0]["sql"]
    #now, we have the sql queries. we need to run them on the MCP server
    query_results = await run_query(query)
    print("Query results:", query_results)
    #the model is hallucinating af. leaving it be for now
    #continue the chain to get the final response
    #next, we need to pass it to the mcp server to generate the visualization from the result of the sql query
    plot_url = ""
    if visualization_name == "timeseries_line":
        params = {"structuredContent": query_results.structured_content}
        result = await generate_time_series_plot(params)
        print("Time series generation result:", result)
        #return the plot url
        plot_url = result.structured_content["plot_url"]
    elif visualization_name == "timeseries_compare":
        params = {"structuredContent": query_results.structured_content}
        result = await generate_time_series_compare_plot(params)
        print("Time series Comparison generation result:", result)
        #return the plot url
        plot_url = result.structured_content["plot_url"]
    elif visualization_name == "heatmap_grid":
        params = {"structuredContent": query_results.structured_content}
        result = await generate_heatmap_plot(params)
        print("Heatmap generation result:", result)
        #return the plot url
        plot_url = result.structured_content["plot_url"]
    elif visualization_name == "map_points":
        params = {"structuredContent": query_results.structured_content}
        result = await generate_map_points_plot(params)
        print("Map points generation result:", result)
        #return the plot url
        plot_url = result.structured_content["plot_url"]
    #all the data has been received, now we need to make one final call to the llm to generate the final summary
    messages =[
        {"role": "system", "content": SYSTEM_PROMPT},
        *[{"role": msg.role, "content": msg.content} for msg in payload.history],
        {"role": "system", "content": f"Here is visualization data: {json.dumps(orchestration_decision)}"},
        {"role": "system", "content": f"Here is the SQL query: {query}"},
        {"role": "user", "content": payload.message},
        {"role": "system", "content": f"Here is the database schema: {schema_content_json}"},
        {"role": "system", "content": SUMMARY_PROMPT},
        {"role": "system", "content": f"The role of the user to which you are responding is: {payload.role}"},
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
    print("Final summary response:", response.choices[0].message.content)
    summary_data = json.loads(strip_code_fences(response.choices[0].message.content))
    text = summary_data["summary"]
    return {
        "text": text,
        "links": plot_url,
        "QC": 1
    }

from fastapi.staticfiles import StaticFiles

PLOT_DIR = "plots/"
os.makedirs(PLOT_DIR, exist_ok=True)

app.mount("/plots", StaticFiles(directory=PLOT_DIR), name="plots")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, port = 7500)