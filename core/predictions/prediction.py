import psycopg2
import pandas as pd
import numpy as np
import json
import argparse
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression

# --- Database connection details ---
DB_CONFIG = {
    "dbname": "Argo",
    "user": "postgres",
    "password": "Vasava@2024",
    "host": "localhost",
    "port": 5432,
}

# --- Variable mapping (includes unit) ---
# variable_name -> (table, column, unit)
VARIABLE_MAP = {
    "temperature": ("levels_core", "best_temp", "°C"),
    "salinity": ("levels_core", "best_psal", "PSU"),
    "oxygen": ("levels_bgc", "doxy", "µmol/kg"),
    "chlorophyll": ("levels_bgc", "chla", "mg/m³"),
}


def parse_horizon(horizon: str):
    """
    Convert human-readable horizon (e.g., '5 days', '2 weeks') to integer day count.
    """
    horizon = horizon.lower().strip()
    if "day" in horizon:
        return int(horizon.split()[0])
    elif "week" in horizon:
        return int(horizon.split()[0]) * 7
    elif "month" in horizon:
        return int(horizon.split()[0]) * 30
    elif "year" in horizon:
        return int(horizon.split()[0]) * 365
    else:
        raise ValueError("Invalid horizon format (use days/weeks/months/years)")


def fetch_data(variable: str, since_days=1095):
    """
    Fetch daily-aggregated values for the variable from Postgres.
    Returns (DataFrame, unit).
    """
    if variable not in VARIABLE_MAP:
        raise ValueError(f"Unsupported variable '{variable}'")

    table, column, unit = VARIABLE_MAP[variable]

    query = f"""
        SELECT p.juld_time::date AS date, AVG(l.{column}) AS value
        FROM {table} l
        JOIN profiles p ON p.id = l.profile_id
        WHERE l.{column} IS NOT NULL
          AND p.juld_time > NOW() - INTERVAL '{since_days} days'
        GROUP BY p.juld_time::date
        ORDER BY date;
    """

    with psycopg2.connect(**DB_CONFIG) as conn:
        # Using DBAPI connection directly is fine here; pandas will warn but still work.
        df = pd.read_sql(query, conn)

    # Ensure datetime dtype for downstream resampling/interpolation
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])

    return df, unit


def interpolate_daily(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensure a continuous daily series and linearly interpolate gaps.
    """
    if df.empty:
        raise ValueError("No data found for interpolation")

    df = df.set_index("date").asfreq("D")
    df["value"] = df["value"].interpolate(method="linear")
    df = df.reset_index()
    return df


def predict_future(df: pd.DataFrame, horizon_days: int) -> pd.DataFrame:
    """
    Fit a simple linear regression over time and produce horizon_days of forecasts.
    Returns DataFrame with columns ['date', 'predicted'].
    """
    if df.empty:
        raise ValueError("No historical data to predict")

    df = df.dropna()
    df["t"] = (df["date"] - df["date"].min()).dt.days

    X = df["t"].values.reshape(-1, 1)
    y = df["value"].values

    model = LinearRegression()
    model.fit(X, y)

    last_t = df["t"].max()
    future_t = np.arange(last_t + 1, last_t + horizon_days + 1)
    future_dates = [df["date"].max() + timedelta(days=i) for i in range(1, horizon_days + 1)]

    preds = model.predict(future_t.reshape(-1, 1))
    return pd.DataFrame({"date": future_dates, "predicted": preds})


def df_to_list(df: pd.DataFrame, value_field_name: str):
    """
    Convert DataFrame with columns ['date', value_field_name] to
    [{ 'date': 'YYYY-MM-DD', value_field_name: float|None }, ...]
    Suitable for JSON serialization and frontend consumption.
    """
    records = []
    for _, row in df.iterrows():
        d = pd.to_datetime(row["date"])
        date_iso = d.date().isoformat()  # date-only string
        v = row[value_field_name]
        if pd.isna(v):
            v_out = None
        else:
            v_out = float(v)  # ensure plain Python float
        records.append({"date": date_iso, value_field_name: v_out})
    return records


def make_prediction_payload(
    variable: str,
    horizon: str,
    since_days: int = 1095,
    include_history: bool = False,
    history_limit: int = 10,
):
    """
    Orchestrate the end-to-end pipeline and return a JSON-serializable dict.

    Schema (success):
    {
      "schema_version": 1,
      "variable": "temperature",
      "unit": "°C",
      "horizon": "5 days",
      "horizon_days": 5,
      "metadata": {
        "rows_fetched": 123,
        "generated_at": "2025-09-09T12:34:56.000Z",
        "since_days": 1095
      },
      "history": [
        { "date": "2025-01-01", "value": 24.1 },
        ...
      ],
      "predictions": [
        { "date": "2025-02-01", "predicted": 24.9 },
        ...
      ]
    }

    Schema (error):
    {
      "schema_version": 1,
      "error": "Error message",
      "variable": "temperature",
      "horizon": "5 days",
      "timestamp": "2025-09-09T12:34:56.000Z"
    }
    """
    horizon_days = parse_horizon(horizon)

    df_raw, unit = fetch_data(variable, since_days=since_days)
    df_daily = interpolate_daily(df_raw)
    preds = predict_future(df_daily, horizon_days)

    # History output control
    if include_history:
        history_df = df_daily
    else:
        history_df = df_daily.tail(history_limit)

    payload = {
        "schema_version": 1,
        "variable": variable,
        "unit": unit,
        "horizon": horizon,
        "horizon_days": int(horizon_days),
        "metadata": {
            "rows_fetched": int(len(df_raw)),
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "since_days": int(since_days),
        },
        "history": df_to_list(history_df, "value"),
        "predictions": df_to_list(preds, "predicted"),
    }
    return payload


def main():
    """
    CLI designed for easy frontend/backend integration.
    - Defaults to JSON output.
    - Supports interactive fallback when args are missing.
    """
    parser = argparse.ArgumentParser(description="Time-series prediction for Argo float data")
    parser.add_argument("--variable", choices=list(VARIABLE_MAP.keys()), help="Which variable to forecast")
    parser.add_argument("--horizon", type=str, help="Forecast horizon, e.g. '5 days', '2 weeks', '3 months'")
    parser.add_argument("--since-days", type=int, default=1095, help="Lookback window in days for history (default: 1095)")
    parser.add_argument("--include-history", action="store_true", help="Include full history in output (default: only last 10 days)")
    parser.add_argument("--history-limit", type=int, default=10, help="If not including full history, how many recent days to include")
    parser.add_argument("--output", choices=["json", "text"], default="json", help="Output format (default: json)")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")

    args = parser.parse_args()

    # Backward-compatible interactive prompts if args not provided
    variable = args.variable or input("Enter variable (temperature/salinity/oxygen/chlorophyll): ").strip().lower()
    horizon = args.horizon or input("Enter horizon (e.g., '5 days', '2 weeks', '3 months'): ").strip()

    try:
        payload = make_prediction_payload(
            variable=variable,
            horizon=horizon,
            since_days=args.since_days,
            include_history=args.include_history,
            history_limit=args.history_limit,
        )

        if args.output == "json":
            print(json.dumps(payload, indent=2 if args.pretty else None))
        else:
            # Minimal text fallback (not intended for frontend)
            print(f"Variable: {payload['variable']} ({payload['unit']})")
            print("Recent historical (daily):")
            for rec in payload["history"]:
                print(f"{rec['date']}: {rec['value']}")
            print(f"\nPredicted values for next {payload['horizon_days']} days:")
            for rec in payload["predictions"]:
                print(f"{rec['date']}: {rec['predicted']}")

    except Exception as e:
        # Always emit structured JSON error for easy frontend handling
        err_obj = {
            "schema_version": 1,
            "error": str(e),
            "variable": variable,
            "horizon": horizon,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        print(json.dumps(err_obj))
        # Non-zero exit code signals failure to callers (e.g., backend)
        raise


if __name__ == "__main__":
    main()
