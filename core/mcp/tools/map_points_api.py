# file: map_points_api.py
from pydantic import BaseModel
from typing import Optional, Literal
from .map_points_plot import create_map_points_plot  # same-dir import, mirrors time_series_api.py style


class MapPointsPayload(BaseModel):
    """
    Pydantic model for validating map-points plot requests.
    """
    payload: dict  # JSON/dict from API, file, or any source

    # Column hints (optional)
    lat_key: Optional[str] = None
    lon_key: Optional[str] = None
    value_key: Optional[str] = None
    label_key: Optional[str] = None
    wmo_key: Optional[str] = None
    time_key: Optional[str] = None
    depth_key: Optional[str] = None  # or pres
    qc_key: Optional[str] = None
    series_key: Optional[str] = None
    size_key: Optional[str] = None

    # Presentation
    title: Optional[str] = None
    color_by: Literal["auto", "value", "qc", "series", "none"] = "auto"
    colorscale: Optional[str] = "Viridis"
    projection: Optional[str] = "natural earth"
    output: Literal["html", "fig"] = "html"
    template: Optional[str] = "plotly_white"


async def generate_map_points(params: MapPointsPayload):
    """
    Async function that takes a validated payload and returns the map points plot.

    Returns:
        dict with a single key "plot" containing the HTML string or Plotly figure.
    """
    if not params.payload:
        raise ValueError("Empty payload provided.")

    result = create_map_points_plot(
        data_payload=params.payload,
        lat_key=params.lat_key,
        lon_key=params.lon_key,
        value_key=params.value_key,
        label_key=params.label_key,
        wmo_key=params.wmo_key,
        time_key=params.time_key,
        depth_key=params.depth_key,
        qc_key=params.qc_key,
        series_key=params.series_key,
        size_key=params.size_key,
        title=params.title,
        color_by=params.color_by,
        colorscale=params.colorscale or "Viridis",
        projection=params.projection or "natural earth",
        output=params.output,
        template=params.template or "plotly_white",
    )

    return {"plot": result}


# --------------------------
# Optional CLI test block
# --------------------------
if __name__ == "__main__":
    import asyncio
    import json
    from pathlib import Path

    # Minimal demo payload: a few points with value and metadata
    demo = {
        "structuredContent": {
            "results": [
                {"lat": 12.34, "lon": 45.67, "avg_temp": 22.5, "wmo": 6901234, "time": "2025-05-01T10:00:00Z", "dac": "coriolis"},
                {"lat": 13.00, "lon": 46.20, "avg_temp": 23.1, "wmo": 6901234, "time": "2025-05-01T12:00:00Z", "dac": "coriolis"},
                {"lat": -10.12, "lon": 150.55, "avg_temp": 17.8, "wmo": 2903456, "time": "2025-05-02T05:30:00Z", "dac": "aoml"},
            ]
        }
    }

    payload_model = MapPointsPayload(
        payload=demo,
        value_key="avg_temp",
        color_by="value",
        output="html",
        title="Demo Map Points"
    )

    html_result = asyncio.run(generate_map_points(payload_model))
    out_path = Path(__file__).with_name("output_map_points_demo.html")
    out_path.write_text(html_result["plot"], encoding="utf-8")
    print(f"Wrote {out_path}")