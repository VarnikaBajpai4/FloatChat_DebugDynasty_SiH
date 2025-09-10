def create_compare_time_series_plot(
    data_payload,
    time_key=None,
    value_key=None,
    float_id_key=None,
    title=None,
    resample_rule=None,
    output="html",
    template="plotly_white",
):
    """
    Create a time-series plot comparing a variable (e.g., temperature, pressure) for two floats over time.

    Parameters:
    - data_payload: dict containing results for both floats.
    - time_key: time column name (e.g., "time").
    - value_key: variable to compare (e.g., "TEMP", "PRES").
    - float_id_key: column name identifying the float (e.g., "WMO").
    - title: plot title.
    - resample_rule: pandas resample rule (optional).
    - output: "html" or "fig".
    - template: Plotly template.

    Returns:
    - HTML string or Plotly Figure.
    """
    import json
    import math
    try:
        import pandas as pd
    except Exception as e:
        raise ImportError("pandas is required for create_compare_time_series_plot") from e
    try:
        import plotly.express as px
    except Exception as e:
        raise ImportError("plotly is required for create_compare_time_series_plot") from e

    def _as_list_of_dicts(payload):
        if not isinstance(payload, dict):
            return []
        sc = payload.get("structuredContent")
        if isinstance(sc, dict) and isinstance(sc.get("results"), list):
            return sc["results"]
        if isinstance(payload.get("results"), list):
            return payload["results"]
        return []

    records = _as_list_of_dicts(data_payload)
    if not records:
        raise ValueError("No data rows found in payload.")

    sample = records[0]
    keys = list(sample.keys())

    t_key = time_key or next(
        (
            k
            for k in keys
            if any(
                kw in k.lower()
                for kw in [
                    "time", "datetime", "date", "timestamp", "hour", "minute", "second", "day"
                ]
            )
        ),
        None
    )
    v_key = value_key or next((k for k in keys if k.lower() in ["avg_temp", "TEMP", "temp", "temperature", "TEMP_C", "temp_c", "temperature_c","PSAL", "psal", "salinity", "sal", "SAL", "sal_psu", "salinity_psu", "PRES", "pres", "pressure", "pressure_dbar", "depth", "depth_m", "Depth"]), None)
    f_key = float_id_key or next((k for k in keys if k.lower() in ["wmo", "float_id", "id"]), None)

    if not t_key or not v_key or not f_key:
        raise ValueError("Could not infer time, value, or float ID column. Provide them explicitly.")

    df = pd.DataFrame(records)
    df[t_key] = pd.to_datetime(df[t_key], utc=True, errors="coerce")
    df = df.dropna(subset=[t_key])
    df[v_key] = pd.to_numeric(df[v_key], errors="coerce")
    df = df.dropna(subset=[v_key])

    if resample_rule:
        df = (
            df.set_index(t_key)
              .groupby(f_key)
              .resample(resample_rule)[v_key]
              .mean()
              .reset_index()
        )

    df = df.sort_values(by=t_key).reset_index(drop=True)

    fig = px.line(
        df,
        x=t_key,
        y=v_key,
        color=f_key,
        markers=True,
        template=template,
        labels={t_key: "Time", v_key: v_key, f_key: "Float"},
        title=title or f"{v_key} comparison over time"
    )
    fig.update_layout(margin=dict(t=60, r=20, b=40, l=60), hovermode="x unified")

    if output in ("fig", "figure"):
        return fig
    html = fig.to_html(full_html=False, include_plotlyjs="cdn")
    return html

__all__ = ["create_compare_time_series_plot"]
