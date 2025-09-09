# file: time_series_compare_api.py
from pydantic import BaseModel
from typing import Optional, Literal
from timeseries_compare_plot import create_compare_time_series_plot

class CompareTimeSeriesPayload(BaseModel):
    """
    Pydantic model for validating compare time-series plot requests.
    """
    payload: dict  # JSON/dict from API, file, or any source
    time_key: Optional[str] = None
    value_key: Optional[str] = None
    float_id_key: Optional[str] = None
    title: Optional[str] = None
    resample_rule: Optional[str] = None
    output: Literal["html", "fig"] = "html"
    template: Optional[str] = "plotly_white"

async def generate_compare_time_series(params: CompareTimeSeriesPayload):
    """
    Async function that takes a validated payload and returns the comparison plot.

    Returns:
        dict with a single key "plot" containing the HTML string or Plotly figure.
    """
    if not params.payload:
        raise ValueError("Empty payload provided.")
    result = create_compare_time_series_plot(
        data_payload=params.payload,
        time_key=params.time_key,
        value_key=params.value_key,
        float_id_key=params.float_id_key,
        title=params.title,
        resample_rule=params.resample_rule,
        output=params.output,
        template=params.template,
    )
    return {"plot": result}

# --------------------------
# Optional CLI test block
# --------------------------
if __name__ == "__main__":
    import asyncio
    import json

    # Example JSON payload with two floats
    json_response = {
        "structuredContent": {
            "results": [
                {"time": "2025-09-10T00:00:00Z", "TEMP": 22.5, "WMO": "floatA"},
                {"time": "2025-09-10T01:00:00Z", "TEMP": 23.0, "WMO": "floatA"},
                {"time": "2025-09-10T02:00:00Z", "TEMP": 21.8, "WMO": "floatA"},
                {"time": "2025-09-10T00:00:00Z", "TEMP": 21.0, "WMO": "floatB"},
                {"time": "2025-09-10T01:00:00Z", "TEMP": 21.5, "WMO": "floatB"},
                {"time": "2025-09-10T02:00:00Z", "TEMP": 20.8, "WMO": "floatB"}
            ]
        }
    }

    payload_model = CompareTimeSeriesPayload(
        payload=json_response,
        value_key="TEMP",
        float_id_key="WMO",
        output="html",
        title="Temperature comparison between floats"
    )

    # Run async function
    html_result = asyncio.run(generate_compare_time_series(payload_model))

    # Write to file for testing
    with open("output_compare_plot.html", "w", encoding="utf-8") as f:
        f.write(html_result["plot"])

    print("Comparison plot HTML saved to output_compare_plot.html")
