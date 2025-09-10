# file: heatmap_api.py
from pydantic import BaseModel
from typing import Optional, Literal
from .heatmap_plot import create_heatmap_plot  # same-dir import, mirrors time_series_api.py style

class HeatmapPayload(BaseModel):
    """
    Pydantic model for validating heatmap plot requests.
    """
    payload: dict  # JSON/dict from API, file, or any source

    # Bin axes
    x_bin: Optional[str] = None
    y_bin: Optional[str] = None

    # Z value or computed metric
    z: Optional[str] = None
    z_agg: Optional[Literal["auto", "mean", "sum", "median", "max", "min", "count"]] = "auto"
    metric: Optional[
        Literal[
            "count",
            "count_distinct_wmo",
            "count_good",
            "coverage_ratio",
            "bin_occupancy",
            "mean",
            "median",
            "sum",
            "max",
            "min",
            "mode_category",
        ]
    ] = None
    mode_category_key: Optional[str] = "dac"

    # Presentation
    title: Optional[str] = None
    colorscale: Optional[str] = "Viridis"
    output: Literal["html", "fig"] = "html"
    template: Optional[str] = "plotly_white"


async def generate_heatmap(params: HeatmapPayload):
    """
    Async function that takes a validated payload and returns the heatmap.
    Returns:
        dict with a single key "plot" containing the HTML string or Plotly figure.
    """
    if not params.payload:
        raise ValueError("Empty payload provided.")

    result = create_heatmap_plot(
        data_payload=params.payload,
        x_bin_key=params.x_bin,
        y_bin_key=params.y_bin,
        z_key=params.z,
        title=params.title,
        colorscale=params.colorscale or "Viridis",
        output=params.output,
        template=params.template or "plotly_white",
        z_agg=params.z_agg or "auto",
        metric=params.metric,
        mode_category_key=params.mode_category_key,
    )
    return {"plot": result}


# --------------------------
# Optional CLI test block
# --------------------------
if __name__ == "__main__":
    import asyncio
    import json
    from pathlib import Path

    # Minimal demo payload: grid of lon/lat bins with counts
    # Demo payload: grid of lon/lat bins with more varied counts and values
    demo = {
        "structuredContent": {
            "results": [
                {"lon_bin": -70, "lat_bin": 30, "wmo": 12345, "qc": 1},
                {"lon_bin": -70, "lat_bin": 30, "wmo": 12345, "qc": 2},
                {"lon_bin": -69, "lat_bin": 30, "wmo": 99999, "qc": 3},
                {"lon_bin": -70, "lat_bin": 31, "wmo": 12345, "qc": 1},
                {"lon_bin": -69, "lat_bin": 31, "wmo": 88888, "qc": 2},
                {"lon_bin": -68, "lat_bin": 30, "wmo": 77777, "qc": 1},
                {"lon_bin": -68, "lat_bin": 31, "wmo": 77777, "qc": 2},
                {"lon_bin": -70, "lat_bin": 32, "wmo": 12345, "qc": 3},
                {"lon_bin": -69, "lat_bin": 32, "wmo": 88888, "qc": 1},
                {"lon_bin": -68, "lat_bin": 32, "wmo": 77777, "qc": 2},
                {"lon_bin": -67, "lat_bin": 30, "wmo": 55555, "qc": 1},
                {"lon_bin": -67, "lat_bin": 31, "wmo": 55555, "qc": 2},
                {"lon_bin": -67, "lat_bin": 32, "wmo": 55555, "qc": 3},
            ]
        }
    }

    payload_model = HeatmapPayload(
        payload=demo,
        x_bin="lon_bin",
        y_bin="lat_bin",
        metric="coverage_ratio",
        output="html",
        title="Demo coverage ratio"
    )

    html_result = asyncio.run(generate_heatmap(payload_model))
    out_path = Path(__file__).with_name("output_heatmap_demo.html")
    out_path.write_text(html_result["plot"], encoding="utf-8")
    print(f"Wrote {out_path}")