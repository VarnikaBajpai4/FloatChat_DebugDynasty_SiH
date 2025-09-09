def create_time_series_plot(
    data_payload,
    time_key=None,
    value_key=None,
    series_key=None,
    title=None,
    resample_rule=None,
    show_qc_color=True,
    output="html",
    template="plotly_white",
):
    """
    Create an interactive time-series line chart from a FloatChat data payload.

    Parameters:
    - data_payload: dict shaped like the tool response shown in the prompt.
    - time_key: optional explicit time column name (e.g., "hour", "day", "time").
    - value_key: optional explicit numeric variable name (e.g., "avg_temp", "PSAL").
    - series_key: optional categorical column for multiple series (e.g., "WMO").
    - title: optional plot title.
    - resample_rule: optional pandas offset alias; if None, auto-detect ("D" if span > 2 days).
    - show_qc_color: if True, overlay markers colored by qc_good_ratio (if present).
    - output: "html" (default) to return embeddable HTML, or "fig" to return a Plotly Figure.
    - template: Plotly template, defaults to "plotly_white".

    Returns:
    - str (HTML fragment) when output="html", else a Plotly Figure when output="fig".
    """
    import json
    from typing import List, Dict, Any
    import math

    try:
        import pandas as pd
    except Exception as e:
        raise ImportError("pandas is required for create_time_series_plot") from e
    try:
        import plotly.express as px
        import plotly.graph_objects as go
    except Exception as e:
        raise ImportError("plotly is required for create_time_series_plot") from e

    def _as_list_of_dicts(payload) -> List[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return []
        # Prefer structuredContent.results
        sc = payload.get("structuredContent")
        if isinstance(sc, dict) and isinstance(sc.get("results"), list):
            return sc["results"]
        # Fallback: parse JSON string inside content[].text
        content = payload.get("content")
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    txt = item.get("text")
                    if isinstance(txt, str) and txt.strip():
                        try:
                            obj = json.loads(txt)
                            if isinstance(obj, dict):
                                results = obj.get("results")
                                if isinstance(results, list):
                                    return results
                        except Exception:
                            # ignore and continue
                            pass
        # Direct list of dicts
        if isinstance(payload.get("results"), list):
            return payload["results"]
        return []

    def _first_present(keys, candidates):
        # Return the first candidate that matches any key (case-insensitive),
        # but preserve the original key's casing when returning.
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
            return math.isfinite(x)
        if isinstance(x, str):
            try:
                fx = float(x)
                return math.isfinite(fx)
            except Exception:
                return False
        return False

    # Extract records
    records = _as_list_of_dicts(data_payload)
    if not records:
        raise ValueError("No data rows found in payload (structuredContent.results or content[].text).")

    # Infer columns if not provided
    sample = records[0]
    keys = list(sample.keys())

    TIME_CANDIDATES = ["time", "hour", "day", "date", "datetime", "timestamp", "juld_time", "juld"]
    QC_CANDIDATES = [
        "qc_good_ratio", "qc_avg", "qc_ratio", "qc_flag", "qc",
        "good_qc_ratio", "qc_good", "qc_ok_ratio", "qc_pass_ratio"
    ]
    def _generate_value_preferred():
        # Domain groups with rich synonyms (unordered within group, but groups imply priority)
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
            # Pressure / Depth (kept lower in priority so science vars win first)
            ["PRES", "pres", "pressure", "pressure_dbar", "depth", "depth_m", "Depth"],
            # Generic fallbacks (kept last)
            ["VALUE", "value", "metric", "measurement", "obs_value", "observed_value", "y", "val"],
        ]

        # Common statistical prefixes/suffixes and data-processing variants
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
            # Deterministic ordered variants for a base token
            ordered = []
            seen_local = set()

            def add_local(x: str):
                if x not in seen_local:
                    ordered.append(x)
                    seen_local.add(x)

            # base in native, lower, upper
            for v in (base, base.lower(), base.upper()):
                add_local(v)
                # adjusted/used forms
                for suf in adj_suffixes:
                    add_local(v + suf)
                # prefixed stats
                for pre in prefixes:
                    add_local(pre + v)
                # suffixed stats
                for suf2 in suffixes:
                    add_local(v + suf2)
            return ordered

        # Build the master ordered candidate list
        for group in base_groups:
            for base in group:
                for v in variants(base):
                    add(v)

        return candidates

    VALUE_PREFERRED = _generate_value_preferred()

    t_key = time_key or _first_present(keys, TIME_CANDIDATES)
    if t_key is None:
        # try to detect any key whose values parse to datetime
        for k in keys:
            v = records[0].get(k)
            try:
                pd.to_datetime([v], utc=True)
                t_key = k
                break
            except Exception:
                continue
    if t_key is None:
        raise ValueError("Could not infer a time column. Provide time_key explicitly.")

    qc_key = _first_present(keys, QC_CANDIDATES)

    v_key = value_key
    if v_key is None:
        # choose from preferred if present
        v_key = _first_present(keys, VALUE_PREFERRED)
    if v_key is None:
        # fallback: first numeric-looking key that isn't time/qc
        for k in keys:
            if k == t_key or k == qc_key:
                continue
            if _is_number(records[0].get(k)):
                v_key = k
                break
    if v_key is None:
        raise ValueError("Could not infer a numeric value column. Provide value_key explicitly.")

    # DataFrame coercion
    df = pd.DataFrame(records)

    # Coerce time
    df[t_key] = pd.to_datetime(df[t_key], utc=True, errors="coerce")
    df = df.dropna(subset=[t_key])

    # Coerce value
    df[v_key] = pd.to_numeric(df[v_key], errors="coerce")
    df = df.dropna(subset=[v_key])

    # Coerce qc to float 0..1 if available
    if qc_key and qc_key in df.columns:
        df[qc_key] = pd.to_numeric(df[qc_key], errors="coerce")
        # Some sources encode as 0..100; normalize if any value > 1.5
        try:
            if float(df[qc_key].max(skipna=True)) > 1.5:
                df[qc_key] = df[qc_key] / 100.0
        except Exception:
            pass
        df[qc_key] = df[qc_key].clip(0, 1)

    # Optional resampling detection
    auto_rule = None
    t_span = (df[t_key].max() - df[t_key].min())
    if t_span is not None:
        try:
            if t_span.days >= 2:
                auto_rule = "D"
        except Exception:
            pass
    rule = resample_rule or auto_rule

    # Apply resampling if requested
    if rule:
        if series_key and series_key in df.columns:
            # group by series then resample
            df = (
                df.set_index(t_key)
                  .groupby(series_key)
                  .resample(rule)[[v_key] + ([qc_key] if qc_key in df.columns else [])]
                  .mean()
                  .reset_index()
            )
        else:
            df = (
                df.set_index(t_key)
                  .resample(rule)
                  .mean(numeric_only=True)
                  .reset_index()
            )

    # Sort by time
    df = df.sort_values(by=t_key).reset_index(drop=True)

    # Labels
    pretty_names = {
        "avg_temp": "Average Temperature (°C)",
        "temp": "Temperature (°C)",
        "temperature": "Temperature (°C)",
        "PSAL": "Salinity (PSU)",
        "psal": "Salinity (PSU)",
        "salinity": "Salinity (PSU)",
        "PRES": "Pressure (dbar)",
        "pres": "Pressure (dbar)",
        "pressure": "Pressure (dbar)",
        "DOXY": "Dissolved Oxygen",
        "doxy": "Dissolved Oxygen",
        "oxygen": "Dissolved Oxygen",
        "oxygen_sat": "Oxygen Saturation (%)",
        "CHLA": "Chlorophyll-a (mg/m³)",
        "chla": "Chlorophyll-a (mg/m³)",
        "NITRATE": "Nitrate (µmol/L)",
        "nitrate": "Nitrate (µmol/L)",
        "BBP700": "Backscatter 700nm (1/m)",
        "bbp700": "Backscatter 700nm (1/m)",
        "TURBIDITY": "Turbidity (NTU)",
        "turbidity": "Turbidity (NTU)",
        "PH_IN_SITU": "pH (in situ)",
        "ph_in_situ": "pH (in situ)",
        qc_key or "qc_good_ratio": "QC good ratio",
    }
    y_label = pretty_names.get(v_key, v_key)
    x_label = "Time"

    # Build figure
    fig = px.line(
        df,
        x=t_key,
        y=v_key,
        color=series_key if series_key and series_key in df.columns else None,
        markers=True,
        template=template,
        labels={t_key: x_label, v_key: y_label},
        title=title or f"{y_label} over time"
    )

    # Overlay QC-colored markers if desired and available (avoids conflicting with series color)
    if show_qc_color and qc_key and qc_key in df.columns and (not series_key or series_key not in df.columns):
        fig.add_trace(
            go.Scatter(
                x=df[t_key],
                y=df[v_key],
                mode="markers",
                marker=dict(
                    size=6,
                    color=df[qc_key],
                    colorscale="Viridis",
                    cmin=0,
                    cmax=1,
                    colorbar=dict(title="QC good ratio"),
                ),
                name="QC",
            )
        )

    fig.update_layout(
        margin=dict(t=60, r=20, b=40, l=60),
        hovermode="x unified",
    )


    # Output
    if output in ("fig", "figure"):
        return fig
    html = fig.to_html(full_html=False, include_plotlyjs="cdn")
    return html

if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path
    import webbrowser

    here = Path(__file__).resolve()
    default_input = here.with_name("test.json")
    default_output = here.with_name("output_plot.html")

    parser = argparse.ArgumentParser(description="Create a time-series Plotly HTML from a FloatChat payload JSON.")
    parser.add_argument("-i", "--input", default=str(default_input), help="Path to JSON payload (default: test.json beside this file)")
    parser.add_argument("-o", "--output", default=str(default_output), help="Path to write HTML (default: output_plot.html beside this file)")
    parser.add_argument("--time-key", default=None, help="Time column name (e.g., hour, day)")
    parser.add_argument("--value-key", default=None, help="Value column name (e.g., avg_temp, PSAL)")
    parser.add_argument("--series-key", default=None, help="Optional series/group column")
    parser.add_argument("--title", default=None, help="Optional plot title")
    parser.add_argument("--resample-rule", default=None, help='Optional pandas resample rule, e.g., "D" or "H"')
    parser.add_argument("--open", dest="open_browser", action="store_true", help="Open the generated HTML in your default browser")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)

    html = create_time_series_plot(
        payload,
        time_key=args.time_key,
        value_key=args.value_key,
        series_key=args.series_key,
        title=args.title,
        resample_rule=args.resample_rule,
        output="html",
    )

    out_path = Path(args.output)
    out_path.write_text(html, encoding="utf-8")
    print(f"Wrote HTML to {out_path.resolve()}")

    if args.open_browser:
        try:
            webbrowser.open(out_path.resolve().as_uri())
        except Exception:
            pass

__all__ = ["create_time_series_plot"]