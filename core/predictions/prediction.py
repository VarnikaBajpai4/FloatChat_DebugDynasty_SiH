# prediction_nlp_dynamic.py

import re
import psycopg2
import pandas as pd
from datetime import datetime, timedelta, UTC
import plotly.graph_objects as go
from numpy import polyfit

# --- Config ---
PG_DSN = "dbname=floatchat user=postgres password=admin host=localhost port=5432"
DEFAULT_WMO = 5905583

# --- Connect DB ---
def connect_pg():
    return psycopg2.connect(PG_DSN)

# --- Parse Simple Command ---
def parse_command(cmd: str):
    cmd = cmd.lower()
    if "temp" in cmd:
        variable = "temp"
    elif "salinity" in cmd:
        variable = "psal"
    else:
        variable = "temp"
    
    horizon_days = 7
    if match := re.search(r"(\d+)\s*day", cmd):
        horizon_days = int(match.group(1))
    elif match := re.search(r"(\d+)\s*week", cmd):
        horizon_days = int(match.group(1)) * 7
    elif match := re.search(r"(\d+)\s*month", cmd):
        horizon_days = int(match.group(1)) * 30
    elif match := re.search(r"(\d+)\s*year", cmd):
        horizon_days = int(match.group(1)) * 365

    return variable, horizon_days

# --- Fetch Data ---
def fetch_data(variable, start_date, end_date):
    conn = connect_pg()
    if variable in ["temp", "psal", "pres"]:
        table = "levels_core"
        col = variable
    else:
        table = "levels_bgc"
        col = variable

    query = f"""
        SELECT p.juld_time AS time, l.{col} AS value
        FROM {table} l
        JOIN profiles p ON p.id = l.profile_id
        JOIN float_cycles fc ON fc.id = p.cycle_id
        WHERE fc.wmo = %s AND p.juld_time BETWEEN %s AND %s
        ORDER BY p.juld_time, l.level_index
    """
    df = pd.read_sql(query, conn, params=(DEFAULT_WMO, start_date, end_date))
    conn.close()
    return df

# --- Interpolate dynamically (daily) ---
def interpolate_daily(df):
    if df.empty:
        return df
    df = df.dropna(subset=["time", "value"])
    df = df.set_index("time").sort_index()
    df = df.asfreq("D")  # daily frequency
    df["value"] = df["value"].interpolate(method="linear")
    return df

# --- Predict ---
def predict(df, horizon_days):
    if df.empty or df["value"].isnull().all():
        return pd.Series(dtype=float)

    steps = max(1, horizon_days)  # daily steps
    last_time = df.index[-1]

    if len(df) >= 2:
        # Linear regression trend
        x = (df.index - df.index[0]).days.values
        y = df["value"].values
        a, b = polyfit(x, y, 1)
        future_x = [(last_time - df.index[0]).days + i for i in range(1, steps+1)]
        values = [a*fx + b for fx in future_x]
    else:
        # Only one point → repeat
        values = [df["value"].iloc[-1]] * steps

    dates = [last_time + timedelta(days=i) for i in range(1, steps+1)]
    return pd.Series(values, index=dates)

# --- Plot ---
def plot_results(df, predictions, variable):
    fig = go.Figure()
    # Historical
    fig.add_trace(go.Scatter(
        x=df.index, y=df["value"],
        mode="lines+markers", name="Historical",
        line=dict(color="blue")
    ))
    # Predictions
    fig.add_trace(go.Scatter(
        x=predictions.index, y=predictions.values,
        mode="lines+markers", name="Prediction",
        line=dict(color="red", dash="dash")
    ))

    fig.update_layout(
        title=f"{variable.upper()} Historical & Predicted",
        xaxis_title="Date",
        yaxis_title=variable.upper(),
        template="plotly_white"
    )
    fig.show()

# --- Main ---
def main():
    print("Enter command like 'next 1 day temp' or 'next 2 weeks salinity'")
    cmd = input("> ")

    variable, horizon_days = parse_command(cmd)
    print(f"\n[INFO] Variable={variable}, Horizon={horizon_days} days")

    end_date = datetime.now(UTC)
    start_date = end_date - timedelta(days=365*3)

    df = fetch_data(variable, start_date, end_date)
    if df.empty:
        print("[WARN] No data found")
        return

    df_daily = interpolate_daily(df)
    predictions = predict(df_daily, horizon_days)

    # Display tables
    print("\n=== Historical (Daily Interpolated) ===")
    print(df_daily.tail(10))
    print("\n=== Predictions ===")
    print(predictions)

    # Plot
    plot_results(df_daily, predictions, variable)

if __name__ == "__main__":
    main()
