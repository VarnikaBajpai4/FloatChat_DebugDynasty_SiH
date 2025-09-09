# file: time_series_api.py
from pydantic import BaseModel
from typing import Optional, Literal
from .timeseries_plot import create_time_series_plot  # replace with your module path

class TimeSeriesPayload(BaseModel):
    """
    Pydantic model for validating time-series plot requests.
    """
    payload: dict  # JSON/dict from API, file, or any source
    time_key: Optional[str] = None
    value_key: Optional[str] = None
    series_key: Optional[str] = None
    title: Optional[str] = None
    resample_rule: Optional[str] = None
    show_qc_color: Optional[bool] = True
    output: Literal["html", "fig"] = "html"
    template: Optional[str] = "plotly_white"


async def generate_time_series(params: TimeSeriesPayload):
    """
    Async function that takes a validated payload and returns the plot.

    Returns:
        dict with a single key "plot" containing the HTML string or Plotly figure.
    """
    if not params.payload:
        raise ValueError("Empty payload provided.")
    
    result = create_time_series_plot(
        data_payload=params.payload,
        time_key=params.time_key,
        value_key=params.value_key,
        series_key=params.series_key,
        title=params.title,
        resample_rule=params.resample_rule,
        show_qc_color=params.show_qc_color,
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

    # Example JSON payload (can be fetched from API)
    json_response = {
        "structuredContent": {
            "results": [
                {"time": "2025-09-10T00:00:00Z", "avg_temp": 22.5},
                {"time": "2025-09-10T01:00:00Z", "avg_temp": 23.0},
                {"time": "2025-09-10T02:00:00Z", "avg_temp": 21.8}
            ]
        }
    }

    payload_model = TimeSeriesPayload(
        payload=json_response,
        output="html",
        title="Temperature over time"
    )

    # Run async function
    html_result = asyncio.run(generate_time_series(payload_model))

    # Write to file for testing
    with open("output_plot.html", "w", encoding="utf-8") as f:
        f.write(html_result["plot"])

    print("Plot HTML saved to output_plot.html")
