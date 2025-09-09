from typing import List, Dict, Any, Optional, Literal
import math

def create_heatmap_plot(
    data_payload: Dict[str, Any],
    x_bin_key: Optional[str] = None,
    y_bin_key: Optional[str] = None,
    z_key: Optional[str] = None,
    title: Optional[str] = None,
    colorscale: str = "Viridis",
    output: Literal["html", "fig"] = "html",
    template: str = "plotly_white",
    z_agg: Optional[Literal["mean", "sum", "median", "max", "min", "count", "auto"]] = "auto",
    metric: Optional[Literal[
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
    ]] = None,
    mode_category_key: Optional[str] = "dac",
):
    """
    Create an interactive heatmap from a FloatChat-style payload.

    Expected tidy rows (before pivot):
      - x_bin (num/str): binned X axis (e.g., longitude tile)
      - y_bin (num/str): binned Y axis (e.g., latitude tile)
      - z (float): aggregated metric per (x_bin, y_bin); if not aggregated, set z_agg to aggregate

    Data payload sources (auto-detected in order):
      - payload["structuredContent"]["results"]
      - JSON string inside payload["content"][...]["text"]
      - payload["results"] directly

    Parameters:
    - data_payload: dict payload as described
    - x_bin_key, y_bin_key, z_key: explicit overrides for column names
    - title: optional plot title
    - colorscale: Plotly colorscale name (e.g., "Viridis", "Cividis", "Plasma")
    - output: "html" (default) to return embeddable HTML, or "fig" to return a Plotly Figure
    - template: Plotly template (e.g., "plotly_white")
    - z_agg: if duplicates exist or z is missing, how to aggregate: "mean"|"sum"|"median"|"max"|"min"|"count"|"auto"

    Returns:
    - HTML fragment (str) if output="html", else plotly.graph_objects.Figure
    """
    import json

    try:
        import pandas as pd
    except Exception as e:
        raise ImportError("pandas is required for create_heatmap_plot") from e
    try:
        import plotly.graph_objects as go
    except Exception as e:
        raise ImportError("plotly is required for create_heatmap_plot") from e

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
            return math.isfinite(float(x))
        if isinstance(x, str):
            try:
                fx = float(x)
                return math.isfinite(fx)
            except Exception:
                return False
        return False

    # Extract rows
    records = _as_list_of_dicts(data_payload)
    if not records:
        raise ValueError("No data rows found in payload (structuredContent.results or content[].text).")

    df = pd.DataFrame(records)
    if df.empty:
        raise ValueError("No rows after DataFrame construction.")

    # Infer keys if not provided
    keys = list(df.columns)

    X_BIN_CANDIDATES = [
        "x_bin", "lon_bin", "longitude_bin", "xbin", "x_tile", "lon_tile", "longitude_tile",
        "x", "lon", "longitude"
    ]
    Y_BIN_CANDIDATES = [
        "y_bin", "lat_bin", "latitude_bin", "ybin", "y_tile", "lat_tile", "latitude_tile",
        "y", "lat", "latitude"
    ]
    # z candidates include common aggregates and variable metrics; keep generic last
    Z_CANDIDATES = [
        # Counts & coverage
        "z", "count", "count_profiles", "count_obs", "count_observations",
        "count_good", "coverage_ratio", "bin_occupancy",
        # Means and medians and generic var metrics
        "avg_var", "mean_var", "median_var", "mode_category",
        "avg_temp", "mean_temp", "temp", "temperature",
        "avg_psal", "mean_psal", "psal", "salinity",
        "avg_pres", "mean_pres", "pres", "pressure",
        "avg_doxy", "mean_doxy", "doxy", "oxygen", "oxygen_sat",
        "avg_chla", "mean_chla", "chla",
        "avg_nitrate", "mean_nitrate", "nitrate",
        "avg_bbp700", "mean_bbp700", "bbp700", "backscatter",
        "avg_turbidity", "mean_turbidity", "turbidity",
        "avg_ph", "mean_ph", "ph_in_situ", "pH",
        # Generic fallback
        "value", "metric"
    ]

    # Additional candidates for WMO and QC
    WMO_CANDIDATES = ["wmo", "WMO", "float_id", "platform_number", "platform", "float", "wmoid"]
    QC_CANDIDATES = [
        "qc", "qc_flag", "QC", "QC_FLAG",
        "var_qc", "TEMP_qc", "PSAL_qc", "PRES_qc", "DOXY_qc",
        "qc_good", "qc_good_ratio", "qc_avg", "qc_ratio"
    ]

    # Robust value column inference (reuse timeseries value candidates logic)
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
            # Pressure / Depth
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

    xk = x_bin_key or _first_present(keys, X_BIN_CANDIDATES)
    yk = y_bin_key or _first_present(keys, Y_BIN_CANDIDATES)
    zk = z_key or _first_present(keys, Z_CANDIDATES)

    if xk is None or yk is None:
        raise ValueError("Could not infer x_bin/y_bin columns. Provide x_bin_key and y_bin_key explicitly.")

    # Clean/normalize bin columns (keep original for labels)
    # Try numeric conversion to allow natural sorting; fallback to string
    def _coerce_for_sort(series):
        try:
            s2 = pd.to_numeric(series, errors="coerce")
            if s2.notna().any():
                return s2
        except Exception:
            pass
        return series.astype(str)

    # Helper detections
    def _first_present_in_df(df_cols, candidates):
        lower_map = {str(c).lower(): c for c in df_cols}
        for cand in candidates:
            if str(cand).lower() in lower_map:
                return lower_map[str(cand).lower()]
        return None

    wmo_col = _first_present_in_df(df.columns, WMO_CANDIDATES)
    qc_col = _first_present_in_df(df.columns, QC_CANDIDATES)

    # If a metric is requested, compute it; otherwise fall back to z_key + z_agg behavior
    if metric:
        if metric == "count":
            grouped = df.groupby([xk, yk], dropna=False).size().reset_index(name="z")
            colorbar_title = "Count"
        elif metric == "count_distinct_wmo":
            if not wmo_col:
                raise ValueError("count_distinct_wmo requires a WMO/float id column (e.g., 'wmo', 'platform_number').")
            grouped = df.groupby([xk, yk], dropna=False)[wmo_col].nunique().reset_index(name="z")
            colorbar_title = "Distinct WMOs"
        elif metric == "count_good":
            if not qc_col:
                raise ValueError("count_good requires a QC column (e.g., 'qc', 'qc_flag').")
            qc_num = pd.to_numeric(df[qc_col], errors="coerce")
            good = qc_num.isin([1, 2]).astype(int)
            grouped = df.assign(_good=good).groupby([xk, yk], dropna=False)["_good"].sum().reset_index(name="z")
            colorbar_title = "QC Good Count"
        elif metric == "coverage_ratio":
            if qc_col:
                qc_num = pd.to_numeric(df[qc_col], errors="coerce")
                good = qc_num.isin([1, 2]).astype(float)
                grouped = df.assign(_good=good).groupby([xk, yk], dropna=False)["_good"].mean().reset_index(name="z")
                colorbar_title = "Coverage Ratio"
            else:
                # Fallback: if qc_good_ratio present, average it
                qcr = _first_present_in_df(df.columns, ["qc_good_ratio", "qc_avg", "qc_ratio"])
                if not qcr:
                    raise ValueError("coverage_ratio requires a QC column or qc_good_ratio-like column.")
                grouped = df.groupby([xk, yk], dropna=False)[qcr].mean().reset_index(name="z")
                colorbar_title = "Coverage Ratio"
        elif metric in ("mean", "median", "sum", "max", "min"):
            # Determine variable column
            var_col = zk
            if var_col is None:
                var_col = _first_present_in_df(df.columns, VALUE_PREFERRED)
            if not var_col:
                # fallback: any numeric column not bins
                candidates = [c for c in df.columns if c not in [xk, yk]]
                var_col = next((c for c in candidates if pd.to_numeric(df[c], errors="coerce").notna().any()), None)
            if not var_col:
                raise ValueError(f"{metric} requires a numeric variable column (z_key or inferable).")
            s = pd.to_numeric(df[var_col], errors="coerce")
            work = df.assign(_z=s)
            agg_map = {"_z": metric}
            grouped = work.groupby([xk, yk], dropna=False).agg(agg_map).reset_index().rename(columns={"_z": "z"})
            colorbar_title = metric.capitalize()
        elif metric == "mode_category":
            # Most frequent category in each bin
            cat_col = mode_category_key or _first_present_in_df(df.columns, ["dac", "DAC", "category", "group", "series"])
            if not cat_col or cat_col not in df.columns:
                raise ValueError("mode_category requires a categorical column (e.g., 'dac').")
            # Compute mode string
            def _mode_series(s):
                m = s.mode(dropna=True)
                return m.iloc[0] if not m.empty else None
            grouped_cat = df.groupby([xk, yk], dropna=False)[cat_col].apply(_mode_series).reset_index(name="category")
            # Map categories to integer codes for heatmap
            labels = sorted([str(v) for v in grouped_cat["category"].dropna().unique()])
            code_map = {lab: i for i, lab in enumerate(labels)}
            grouped = grouped_cat.assign(z=grouped_cat["category"].map(lambda v: code_map.get(str(v)) if v is not None else None))
            colorbar_title = f"Mode {cat_col}"
            # Attach mapping for later colorbar ticks
            grouped._mode_labels = labels  # type: ignore
            grouped._mode_codes = code_map  # type: ignore
        else:
            raise ValueError(f"Unsupported metric: {metric}")
    else:
        # Legacy behavior: use z_key with aggregation
        if zk is None:
            z_agg = "count"
        df_tmp = df[[xk, yk] + ([zk] if zk in df.columns else [])].copy()
        if zk in df_tmp.columns:
            if z_agg in (None, "auto"):
                z_agg = "mean"
            if z_agg in ("mean", "sum", "median", "max", "min"):
                df_tmp[zk] = pd.to_numeric(df_tmp[zk], errors="coerce")
            if z_agg == "count":
                grouped = df_tmp.groupby([xk, yk], dropna=False).size().reset_index(name="z")
            else:
                grouped = (
                    df_tmp.groupby([xk, yk], dropna=False)
                    .agg({zk: z_agg})
                    .reset_index()
                    .rename(columns={zk: "z"})
                )
            colorbar_title = "Value"
        else:
            grouped = df_tmp.groupby([xk, yk], dropna=False).size().reset_index(name="z")
            colorbar_title = "Count"

    # Order axes
    x_for_sort = _coerce_for_sort(grouped[xk])
    y_for_sort = _coerce_for_sort(grouped[yk])
    # Preserve original labels but sort by coerced order
    grouped = grouped.assign(_x_sort=x_for_sort, _y_sort=y_for_sort)
    grouped = grouped.sort_values(by=["_y_sort", "_x_sort"], kind="mergesort")

    x_order = grouped[[xk, "_x_sort"]].drop_duplicates().sort_values("_x_sort")[xk].tolist()
    y_order = grouped[[yk, "_y_sort"]].drop_duplicates().sort_values("_y_sort")[yk].tolist()

    # Pivot to matrix (rows=y, cols=x) using 'z'
    pivot = grouped.pivot_table(index=yk, columns=xk, values="z", aggfunc="mean")
    # Ensure full axes coverage
    pivot = pivot.reindex(index=y_order, columns=x_order)
    z_matrix = pivot.values.tolist()

    # Labels
    z_label_map = {
        "count": "Count",
        "count_distinct_wmo": "Distinct WMOs",
        "count_profiles": "Profile Count",
        "count_obs": "Observation Count",
        "count_good": "QC Good Count",
        "coverage_ratio": "Coverage Ratio",
        "bin_occupancy": "Bin Occupancy",
        "avg_var": "Average",
        "mean_var": "Mean",
        "median_var": "Median",
        "mode_category": "Mode",
        "mean": "Mean",
        "sum": "Sum",
        "max": "Max",
        "min": "Min",
    }
    # If metric set earlier may have defined colorbar_title; otherwise, choose default
    colorbar_title = locals().get("colorbar_title", z_label_map.get((zk or "z"), (zk or "z")))

    # Build figure, handle mode_category tick labels if present
    colorbar_kwargs = dict(title=str(colorbar_title))
    if metric == "mode_category":
        labels = getattr(grouped, "_mode_labels", None)
        if labels:
            tickvals = list(range(len(labels)))
            colorbar_kwargs.update(tickvals=tickvals, ticktext=labels)

    fig = go.Figure(
        data=go.Heatmap(
            z=z_matrix,
            x=x_order,
            y=y_order,
            colorscale=colorscale,
            colorbar=colorbar_kwargs,
            hoverongaps=False,
            hovertemplate="x: %{x}<br>y: %{y}<br>z: %{z}<extra></extra>",
        )
    )
    fig.update_layout(
        template=template,
        title=title or "Heatmap",
        xaxis_title=str(xk),
        yaxis_title=str(yk),
        margin=dict(t=60, r=20, b=40, l=60),
    )

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
    default_output = here.with_name("output_heatmap.html")

    parser = argparse.ArgumentParser(description="Create a heatmap Plotly HTML from a FloatChat payload JSON.")
    parser.add_argument("-i", "--input", default=str(default_input), help="Path to JSON payload (default: test.json beside this file)")
    parser.add_argument("-o", "--output", default=str(default_output), help="Path to write HTML (default: output_heatmap.html beside this file)")
    parser.add_argument("--x-bin", dest="x_bin", default=None, help="X bin column (e.g., lon_bin)")
    parser.add_argument("--y-bin", dest="y_bin", default=None, help="Y bin column (e.g., lat_bin)")
    parser.add_argument("--z", dest="z", default=None, help="Z value column (aggregated metric). If omitted, counts will be used.")
    parser.add_argument("--title", default=None, help="Plot title")
    parser.add_argument("--colorscale", default="Viridis", help="Plotly colorscale name (e.g., Viridis, Cividis)")
    parser.add_argument("--z-agg", dest="z_agg", default="auto", choices=["auto", "mean", "sum", "median", "max", "min", "count"], help="Aggregation strategy for z when duplicates exist")
    parser.add_argument("--open", dest="open_browser", action="store_true", help="Open the generated HTML in your default browser")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)

    html = create_heatmap_plot(
        payload,
        x_bin_key=args.x_bin,
        y_bin_key=args.y_bin,
        z_key=args.z,
        title=args.title,
        colorscale=args.colorscale,
        output="html",
        z_agg=args.z_agg,
    )

    out_path = Path(args.output)
    out_path.write_text(html, encoding="utf-8")
    print(f"Wrote HTML to {out_path.resolve()}")

    if args.open_browser:
        try:
            webbrowser.open(out_path.resolve().as_uri())
        except Exception:
            pass


__all__ = ["create_heatmap_plot"]