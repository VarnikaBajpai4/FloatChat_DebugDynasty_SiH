from typing import List, Dict, Any, Optional, Literal, Tuple
import math

def create_map_points_plot(
    data_payload: Dict[str, Any],
    lat_key: Optional[str] = None,
    lon_key: Optional[str] = None,
    value_key: Optional[str] = None,
    label_key: Optional[str] = None,
    wmo_key: Optional[str] = None,
    time_key: Optional[str] = None,
    depth_key: Optional[str] = None,  # or pres
    qc_key: Optional[str] = None,
    series_key: Optional[str] = None,
    size_key: Optional[str] = None,
    title: Optional[str] = None,
    color_by: Literal["auto", "value", "qc", "series", "none"] = "auto",
    colorscale: str = "Turbo",
    size_range: Tuple[int, int] = (12, 28),
    projection: str = "natural earth",
    # New view/clarity controls
    region: Literal["indian_ocean", "global", "custom"] = "indian_ocean",
    lon_range: Optional[Tuple[float, float]] = None,
    lat_range: Optional[Tuple[float, float]] = None,
    marker_opacity: float = 1.0,
    marker_line_color: str = "#111111",
    marker_line_width: float = 1.2,
    output: Literal["html", "fig"] = "html",
    template: str = "plotly_white",
):
    """
    Create an interactive map of points from a FloatChat-style payload.

    Expected input shape (logical keys; we will infer columns when not provided):
      - lat (float): latitude (EPSG:4326)
      - lon (float): longitude (EPSG:4326)

    Optional, recommended:
      - value (float): numeric variable (TEMP, PSAL, etc.) to map to color
      - label (str): short label (e.g., "WMO 6901234, 2024-05-02")
      - wmo (str/int): float identifier
      - time (timestamp or ISO string)
      - depth / pres (float)
      - qc_flag (int/str): per-point qc
      - series (str): grouping (e.g., DAC/platform type)
      - size (float/int): optional symbol size mapping

    Data payload sources (auto-detected in order):
      - payload["structuredContent"]["results"]
      - JSON string inside payload["content"][...]["text"]
      - payload["results"] directly

    Returns:
      - HTML fragment (str) if output="html"
      - plotly.graph_objects.Figure if output="fig"

    Notes:
      - Default view is focused on the Indian Ocean (lon 20°E–120°E, lat 40°S–30°N).
        Set region="global" or pass lon_range/lat_range to override.
    """
    import json

    try:
        import pandas as pd
    except Exception as e:
        raise ImportError("pandas is required for create_map_points_plot") from e
    try:
        import plotly.express as px
        import plotly.graph_objects as go
    except Exception as e:
        raise ImportError("plotly is required for create_map_points_plot") from e

    def _as_list_of_dicts(payload) -> List[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return []
        sc = payload.get("structuredContent")
        if isinstance(sc, dict) and isinstance(sc.get("results"), list):
            return sc["results"]
        content = payload.get("content")
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    txt = item.get("text")
                    if isinstance(txt, str) and txt.strip():
                        try:
                            obj = json.loads(txt)
                            if isinstance(obj, dict) and isinstance(obj.get("results"), list):
                                return obj["results"]
                        except Exception:
                            pass
        if isinstance(payload.get("results"), list):
            return payload["results"]
        return []

    def _first_present(keys, candidates):
        if not keys:
            return None
        lower_map = {str(k).lower(): k for k in keys}
        for c in candidates:
            cl = str(c).lower()
            if cl in lower_map:
                return lower_map[cl]
        return None

    def _is_number(x) -> bool:
        if isinstance(x, (int, float)) and not isinstance(x, bool):
            try:
                return math.isfinite(float(x))
            except Exception:
                return False
        if isinstance(x, str):
            try:
                fx = float(x)
                return math.isfinite(fx)
            except Exception:
                return False
        return False

    # Robust value candidates (shared with time series logic)
    def _generate_value_preferred():
        base_groups = [
            # Temperature
            ["avg_temp", "TEMP", "temp", "temperature", "TEMP_C", "temp_c", "temperature_c"],
            # Salinity
            ["PSAL", "psal", "salinity", "sal", "SAL", "sal_psu", "salinity_psu"],
            # Dissolved Oxygen
            ["DOXY", "doxy", "oxygen", "OXYGEN", "o2", "O2", "oxygen_concentration",
             "oxygen_sat", "oxygen_saturation", "OXYGEN_SAT", "oxy_sat", "o2sat"],
            # Chlorophyll-a
            ["CHLA", "chla", "chlorophyll", "chlorophyll_a"],
            # Nitrate
            ["NITRATE", "nitrate", "NO3", "no3"],
            # Backscatter
            ["BBP700", "bbp700", "bbp", "backscatter", "backscatter_700"],
            # Turbidity
            ["TURBIDITY", "turbidity", "NTU", "ntu"],
            # pH
            ["PH_IN_SITU", "ph_in_situ", "pH", "ph", "pH_total_scale", "ph_total_scale", "PH_IN_SITU_TOTAL_SCALE"],
            # Pressure / Depth (kept lower)
            ["PRES", "pres", "pressure", "pressure_dbar", "depth", "depth_m", "Depth"],
            # Generic fallbacks
            ["VALUE", "value", "metric", "measurement", "obs_value", "observed_value", "y", "val"],
        ]
        prefixes = [
            "avg_", "mean_", "median_", "min_", "max_", "std_", "var_", "sum_",
            "p05_", "p10_", "p25_", "p50_", "p75_", "p90_", "p95_",
            "rolling_", "smoothed_", "ema_", "exp_"
        ]
        suffixes = [
            "_avg", "_mean", "_median", "_min", "_max", "_std", "_var", "_sum",
            "_p05", "_p10", "_p25", "_p50", "_p75", "_p90", "_p95"
        ]
        adj_suffixes = ["_adjusted", "_adj", "_used"]

        candidates = []
        seen = set()

        def add(name: str):
            if name not in seen:
                candidates.append(name)
                seen.add(name)

        def variants(base: str):
            ordered = []
            seen_local = set()
            def add_local(x: str):
                if x not in seen_local:
                    ordered.append(x)
                    seen_local.add(x)
            for v in (base, base.lower(), base.upper()):
                add_local(v)
                for suf in adj_suffixes:
                    add_local(v + suf)
                for pre in prefixes:
                    add_local(pre + v)
                for suf2 in suffixes:
                    add_local(v + suf2)
            return ordered

        for group in base_groups:
            for base in group:
                for v in variants(base):
                    add(v)
        return candidates

    VALUE_PREFERRED = _generate_value_preferred()

    # Extract records
    records = _as_list_of_dicts(data_payload)
    if not records:
        raise ValueError("No data rows found in payload (structuredContent.results or content[].text).")

    df = pd.DataFrame(records)
    if df.empty:
        raise ValueError("No rows after DataFrame construction.")

    keys = list(df.columns)

    LAT_CANDIDATES = ["lat", "latitude", "Lat", "Latitude", "LAT"]
    LON_CANDIDATES = ["lon", "longitude", "lng", "Lon", "Longitude", "LON"]
    LABEL_CANDS = ["label", "name", "title", "desc", "description", "tooltip"]
    WMO_CANDS = ["wmo", "WMO", "float_id", "platform_number", "platform", "float", "wmoid"]
    TIME_CANDS = ["time", "datetime", "timestamp", "date", "juld_time", "juld", "hour", "day"]
    DEPTH_CANDS = ["depth", "depth_m", "Depth", "PRES", "pres", "pressure"]
    QC_CANDS = ["qc_flag", "qc", "QC", "QC_FLAG", "var_qc", "TEMP_qc", "PSAL_qc", "PRES_qc", "DOXY_qc"]
    SERIES_CANDS = ["series", "group", "category", "dac", "DAC", "platform_type", "platform_class"]
    SIZE_CANDS = ["size", "SIZE", "radius", "symbol_size", "count"]

    lat_col = lat_key or _first_present(keys, LAT_CANDIDATES)
    lon_col = lon_key or _first_present(keys, LON_CANDIDATES)
    if lat_col is None or lon_col is None:
        available = ", ".join(map(str, keys))
        raise ValueError(f"Could not infer lat/lon columns. Provide lat_key and lon_key explicitly. Available columns: {available}")

    # Optional/inferred columns
    label_col = label_key or _first_present(keys, LABEL_CANDS)
    wmo_col = wmo_key or _first_present(keys, WMO_CANDS)
    time_col = time_key or _first_present(keys, TIME_CANDS)
    depth_col = depth_key or _first_present(keys, DEPTH_CANDS)
    qc_col = qc_key or _first_present(keys, QC_CANDS)
    series_col = series_key or _first_present(keys, SERIES_CANDS)
    val_col = value_key or _first_present(keys, VALUE_PREFERRED)
    size_col = size_key or _first_present(keys, SIZE_CANDS)

    # Coerce numeric lat/lon; drop invalid rows
    df[lat_col] = pd.to_numeric(df[lat_col], errors="coerce")
    df[lon_col] = pd.to_numeric(df[lon_col], errors="coerce")
    df = df.dropna(subset=[lat_col, lon_col])

    if val_col and val_col in df.columns:
        df[val_col] = pd.to_numeric(df[val_col], errors="coerce")

    if size_col and size_col in df.columns:
        df[size_col] = pd.to_numeric(df[size_col], errors="coerce")

    # Build hover text if label not provided
    def _fmt(v) -> str:
        try:
            if v is None or (isinstance(v, float) and (math.isnan(v) or not math.isfinite(v))):
                return ""
            return str(v)
        except Exception:
            return ""

    if not label_col:
        # Compose a useful label
        pieces = []
        if wmo_col and wmo_col in df.columns:
            pieces.append("WMO=%s" % df[wmo_col].astype(str))
        if time_col and time_col in df.columns:
            # show raw string or ISO
            pieces.append("time=%s" % df[time_col].astype(str))
        if depth_col and depth_col in df.columns:
            pieces.append("z=%s" % df[depth_col].astype(str))
        if val_col and val_col in df.columns:
            pieces.append("val=%s" % df[val_col].round(3).astype(str))
        # Always add short lat/lon
        pieces.append("(%s, %s)" % (df[lat_col].round(3).astype(str), df[lon_col].round(3).astype(str)))
        df["_label"] = (" | ").join([])  # initialize
        # Combine columns row-wise
        df["_label"] = (
            (("WMO=%s" % df[wmo_col].astype(str)) if wmo_col and wmo_col in df.columns else "")
            + ((" | time=%s" % df[time_col].astype(str)) if time_col and time_col in df.columns else "")
            + ((" | z=%s" % df[depth_col].astype(str)) if depth_col and depth_col in df.columns else "")
            + ((" | val=%s" % df[val_col].round(3).astype(str)) if val_col and val_col in df.columns else "")
            + (" | (" + df[lat_col].round(3).astype(str) + ", " + df[lon_col].round(3).astype(str) + ")")
        )
        label_col = "_label"

    # Color mapping selection
    color_arg = None
    if color_by == "value" and val_col:
        color_arg = val_col
    elif color_by == "qc" and qc_col:
        color_arg = qc_col
    elif color_by == "series" and series_col:
        color_arg = series_col
    elif color_by == "none":
        color_arg = None
    elif color_by == "auto":
        # prefer value, else qc, else series, else none
        if val_col:
            color_arg = val_col
        elif qc_col:
            color_arg = qc_col
        elif series_col:
            color_arg = series_col
        else:
            color_arg = None

    # Size mapping
    size_arg = None
    if size_col:
        size_arg = size_col

    # Build hover_data only with columns that actually exist
    hover_data = {}
    if wmo_col and wmo_col in df.columns:
        hover_data[wmo_col] = True
    if time_col and time_col in df.columns:
        hover_data[time_col] = True
    if depth_col and depth_col in df.columns:
        hover_data[depth_col] = True
    if val_col and val_col in df.columns:
        hover_data[val_col] = True
    if qc_col and qc_col in df.columns:
        hover_data[qc_col] = True
    if series_col and series_col in df.columns:
        hover_data[series_col] = True

    # Build figure (scatter_geo)
    fig = px.scatter_geo(
        df,
        lat=lat_col,
        lon=lon_col,
        color=color_arg,
        size=size_arg,
        hover_name=label_col if label_col in df.columns else None,
        hover_data=hover_data if hover_data else None,
        template=template,
        projection=projection,
        color_continuous_scale=colorscale if (color_arg and (val_col and color_arg == val_col)) else None,
    )

    # Improve marker clarity and visibility
    base_marker = dict(
        opacity=marker_opacity,
        line=dict(color=marker_line_color, width=marker_line_width),
    )
    # If no size column provided, use a strong default size for visibility
    if not size_arg:
        base_marker.update(size=max(size_range[0], 14))
    fig.update_traces(marker=base_marker)

    # Focus on Indian Ocean by default (override with region/custom ranges)
    default_lon = (20.0, 120.0)
    default_lat = (-40.0, 30.0)

    use_lon = lon_range if lon_range else (default_lon if region == "indian_ocean" else None)
    use_lat = lat_range if lat_range else (default_lat if region == "indian_ocean" else None)

    fig.update_geos(
        showcoastlines=True,
        coastlinecolor="rgba(0,0,0,0.6)",
        showcountries=True,
        countrycolor="rgba(80,80,80,0.6)",
        showland=True,
        landcolor="rgb(240, 240, 240)",
        showocean=True,
        oceancolor="rgb(230, 240, 255)",
        showlakes=True,
        lakecolor="rgb(230, 240, 255)",
        lonaxis_range=use_lon,
        lataxis_range=use_lat,
        projection_type=projection,
        framecolor="rgba(0,0,0,0.2)",
        bgcolor="white",
        showframe=False,
    )

    # If color is numeric and continuous, label the colorbar sensibly
    if color_arg and val_col and color_arg == val_col:
        colorbar_title = val_col.replace("_", " ").upper()
        try:
            fig.update_coloraxes(colorbar=dict(title=colorbar_title))
        except Exception:
            pass

    # Continuous colorscale applies only for numeric color. If categorical color (qc/series),
    # Plotly auto-assigns category colors.
    if size_arg:
        # Enlarge minimum bubble size and use area sizing for better visibility
        try:
            fig.update_traces(marker=dict(sizemode="area", sizemin=max(size_range[0], 12)))
        except Exception:
            fig.update_traces(marker=dict(sizemin=max(size_range[0], 12)))

    fig.update_layout(
        title=title or "Map Points (Indian Ocean view)",
        margin=dict(t=60, r=20, b=40, l=20),
        legend_title_text=series_col if series_col else None,
        hoverlabel=dict(bgcolor="rgba(255,255,255,0.9)", font_size=12, font_family="Arial"),
    )

    # If color is numeric but not value (e.g., qc numeric), set a default colorscale
    if color_arg and color_arg != val_col:
        # If qc_col is numeric and limited to 1..9, consider a discrete mapping; otherwise keep default
        try:
            if qc_col and color_arg == qc_col:
                # Cast QC to string for discrete legend if few categories
                unique_qc = pd.Series(df[qc_col]).dropna().unique()
                if len(unique_qc) <= 9:
                    df["_qc_str"] = df[qc_col].astype(str)
                    fig = px.scatter_geo(
                        df,
                        lat=lat_col,
                        lon=lon_col,
                        color="_qc_str",
                        size=size_arg,
                        hover_name=label_col if label_col in df.columns else None,
                        hover_data=hover_data if hover_data else None,
                        template=template,
                        projection=projection,
                    )
                    fig.update_traces(
                        marker=dict(
                            opacity=marker_opacity,
                            line=dict(color=marker_line_color, width=marker_line_width),
                        )
                    )
                    fig.update_geos(lonaxis_range=use_lon, lataxis_range=use_lat)
                    fig.update_layout(legend_title_text="QC")
        except Exception:
            pass

    if output in ("fig", "figure"):
        return fig
    return fig.to_html(full_html=False, include_plotlyjs="cdn")


if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path
    import webbrowser

    here = Path(__file__).resolve()
    default_input = here.with_name("test.json")
    default_output = here.with_name("output_map_points.html")

    parser = argparse.ArgumentParser(description="Create a map-points Plotly HTML from a FloatChat payload JSON.")
    parser.add_argument("-i", "--input", default=str(default_input), help="Path to JSON payload (default: test.json beside this file)")
    parser.add_argument("-o", "--output", default=str(default_output), help="Path to write HTML (default: output_map_points.html beside this file)")
    parser.add_argument("--lat", dest="lat_key", default=None, help="Latitude column")
    parser.add_argument("--lon", dest="lon_key", default=None, help="Longitude column")
    parser.add_argument("--value", dest="value_key", default=None, help="Value column for color")
    parser.add_argument("--label", dest="label_key", default=None, help="Label column for hover")
    parser.add_argument("--wmo", dest="wmo_key", default=None, help="WMO/float id column")
    parser.add_argument("--time", dest="time_key", default=None, help="Time column")
    parser.add_argument("--depth", dest="depth_key", default=None, help="Depth/pressure column")
    parser.add_argument("--qc", dest="qc_key", default=None, help="QC flag column")
    parser.add_argument("--series", dest="series_key", default=None, help="Series/group column")
    parser.add_argument("--size", dest="size_key", default=None, help="Size column for bubble size")
    parser.add_argument("--color-by", dest="color_by", default="auto", choices=["auto", "value", "qc", "series", "none"], help="Which column to map to color")
    parser.add_argument("--colorscale", default="Viridis", help="Plotly continuous colorscale (for numeric color)")
    parser.add_argument("--projection", default="natural earth", help="Geo projection (e.g., 'natural earth', 'equirectangular')")
    parser.add_argument("--region", default="indian_ocean", choices=["indian_ocean", "global", "custom"], help="Default view region")
    parser.add_argument("--lon-range", nargs=2, type=float, default=None, metavar=("LON_MIN", "LON_MAX"), help="Custom longitude range (requires --region custom)")
    parser.add_argument("--lat-range", nargs=2, type=float, default=None, metavar=("LAT_MIN", "LAT_MAX"), help="Custom latitude range (requires --region custom)")
    parser.add_argument("--open", dest="open_browser", action="store_true", help="Open the generated HTML in your default browser")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)

    # Try to create from provided payload; if lat/lon cannot be inferred, fall back to an embedded demo
    try:
        html = create_map_points_plot(
            payload,
            lat_key=args.lat_key,
            lon_key=args.lon_key,
            value_key=args.value_key,
            label_key=args.label_key,
            wmo_key=args.wmo_key,
            time_key=args.time_key,
            depth_key=args.depth_key,
            qc_key=args.qc_key,
            series_key=args.series_key,
            size_key=args.size_key,
            color_by=args.color_by,
            colorscale=args.colorscale,
            projection=args.projection,
            region=args.region,
            lon_range=tuple(args.lon_range) if args.lon_range else None,
            lat_range=tuple(args.lat_range) if args.lat_range else None,
            output="html",
        )
    except ValueError as e:
        msg = str(e)
        if "infer lat/lon" in msg or "lat/lon" in msg:
            print("Could not infer lat/lon from input. Falling back to embedded demo payload with lat/lon keys.")
            demo = {
                "structuredContent": {
                    "results": [
                        {"lat": 12.34, "lon": 45.67, "avg_temp": 22.5, "wmo": 6901234, "time": "2025-01-01T10:00:00Z", "dac": "coriolis"},
                        {"lat": 12.50, "lon": 45.90, "avg_temp": 23.1, "wmo": 6901234, "time": "2025-01-01T12:00:00Z", "dac": "coriolis"},
                        {"lat": -10.12, "lon": 150.55, "avg_temp": 17.8, "wmo": 2903456, "time": "2025-01-02T05:30:00Z", "dac": "aoml"}
                    ]
                }
            }
            html = create_map_points_plot(
                demo,
                value_key="avg_temp",
                color_by="value",
                output="html",
                #title=args.title or "Demo Map Points"
            )
        else:
            raise

    out_path = Path(args.output)
    out_path.write_text(html, encoding="utf-8")
    print(f"Wrote HTML to {out_path.resolve()}")

    if args.open_browser:
        try:
            webbrowser.open(out_path.resolve().as_uri())
        except Exception:
            pass


__all__ = ["create_map_points_plot"]