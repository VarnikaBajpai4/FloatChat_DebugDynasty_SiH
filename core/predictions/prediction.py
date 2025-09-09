import psycopg2
import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.linear_model import LinearRegression
from tabulate import tabulate  

# --- Database connection details ---
DB_CONFIG = {
    "dbname": "Argo",
    "user": "postgres",
    "password": "Vasava@2024",
    "host": "localhost",
    "port": 5432,
}

# --- Variable mapping ---
VARIABLE_MAP = {
    "temperature": ("levels_core", "best_temp", "°C"),
    "salinity": ("levels_core", "best_psal", "PSU"),
    "oxygen": ("levels_bgc", "doxy", "µmol/kg"),
    "chlorophyll": ("levels_bgc", "chla", "mg/m³"),
}

def parse_horizon(horizon: str):
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
        df = pd.read_sql(query, conn)

    print(f"Fetched {len(df)} raw rows from DB")
    return df, unit


def interpolate_daily(df):
    if df.empty:
        raise ValueError("No data found for interpolation")

    df = df.set_index("date").asfreq("D")
    df["value"] = df["value"].interpolate(method="linear")
    df = df.reset_index()
    return df


def predict_future(df, horizon_days):
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


def main():
    variable = input("Enter variable (temperature/salinity/oxygen/chlorophyll): ").strip().lower()
    horizon = input("Enter horizon (e.g., '5 days', '2 weeks', '3 months'): ").strip()

    try:
        horizon_days = parse_horizon(horizon)

        # Step 2: Fetch and process data
        df, unit = fetch_data(variable)
        df = interpolate_daily(df)

        # Step 3: Show recent history
        print("\nRecent historical (daily, last 10):")
        print(tabulate(df.tail(10), headers=["Date", f"Value ({unit})"], tablefmt="pretty", showindex=False))

        # Step 4: Predict future
        preds = predict_future(df, horizon_days)
        print(f"\nPredicted values for next {horizon_days} days:")
        print(tabulate(preds, headers=["Date", f"Predicted ({unit})"], tablefmt="pretty", showindex=False))

    except Exception as e:
        print("Error:", e)


if __name__ == "_main_":
    main()