import re
import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import timedelta
import plotly.graph_objects as go
from sklearn.linear_model import LinearRegression

# ---------------------------
# Database Connection
# ---------------------------
def get_db_connection():
    conn = psycopg2.connect(
        dbname="floatchat",
        user="postgres",
        password="admin",
        host="localhost",
        port=5432
    )
    return conn

# ---------------------------
# Natural Language Parsing
# ---------------------------
def parse_command(command):
    # Extract variable
    var_match = re.search(r"(temperature|salinity|oxygen|chlorophyll)", command, re.I)
    if not var_match:
        raise ValueError("No valid variable found in command.")
    variable = var_match.group(1).lower()

    # Extract horizon
    num_match = re.search(r"(\d+)", command)
    if not num_match:
        raise ValueError("No numeric horizon found in command.")
    value = int(num_match.group(1))

    # Extract unit
    unit_match = re.search(r"(day|week|month|year)s?", command, re.I)
    if not unit_match:
        raise ValueError("No time unit found in command.")
    unit = unit_match.group(1).lower()

    # Convert to days for prediction
    if unit == "day":
        horizon_days = value
    elif unit == "week":
        horizon_days = value * 7
    elif unit == "month":
        horizon_days = value * 30
    elif unit == "year":
        horizon_days = value * 365
    else:
        horizon_days = value

    return variable, horizon_days

# ---------------------------
# Fetch Historical Data
# ---------------------------
def fetch_historical_data(variable, conn):
    # Determine table
    core_vars = ["temperature", "salinity", "pressure"]
    bgc_vars = ["oxygen", "chlorophyll"]

    if variable in core_vars:
        table = "levels_core"
    elif variable in bgc_vars:
        table = "levels_bgc"
    else:
        raise ValueError("Unknown variable.")

    query = f"""
        SELECT f.float_id, c.cycle_date::date AS date, l.{variable} 
        FROM {table} l
        JOIN float_cycles c ON l.cycle_id = c.cycle_id
        JOIN profiles f ON c.profile_id = f.profile_id
        WHERE c.cycle_date >= NOW() - INTERVAL '3 years'
        ORDER BY c.cycle_date;
    """

    df = pd.read_sql(query, conn)
    if df.empty:
        raise ValueError("No data found for variable.")
    df = df.groupby("date")[variable].mean().reset_index()
    return df

# ---------------------------
# Interpolate Missing Values
# ---------------------------
def interpolate_data(df):
    df = df.set_index("date").asfreq("D")
    df[ df.columns[0] ] = df[ df.columns[0] ].interpolate(method='linear')
    df = df.reset_index()
    return df

# ---------------------------
# Predict Future Values
# ---------------------------
def predict_trend(df, horizon_days):
    X = np.arange(len(df)).reshape(-1, 1)
    y = df[df.columns[1]].values

    if len(y) == 1:
        # single-point prediction, repeat value
        future_values = np.full(horizon_days, y[0])
    else:
        model = LinearRegression()
        model.fit(X, y)
        future_X = np.arange(len(df), len(df) + horizon_days).reshape(-1, 1)
        future_values = model.predict(future_X)
        # make sure no negative values for variables like salinity, temperature
        future_values = np.clip(future_values, 0, None)

    future_dates = pd.date_range(start=df['date'].max() + pd.Timedelta(days=1), periods=horizon_days)
    forecast_df = pd.DataFrame({'date': future_dates, 'predicted': future_values})
    return forecast_df

# ---------------------------
# Plot Results
# ---------------------------
def plot_results(df, forecast_df, variable):
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df['date'], y=df[variable], mode='lines+markers', name='Historical'))
    fig.add_trace(go.Scatter(x=forecast_df['date'], y=forecast_df['predicted'], mode='lines+markers', name='Predicted'))
    fig.update_layout(
        title=f"{variable.capitalize()} Prediction",
        xaxis_title="Date",
        yaxis_title=variable.capitalize(),
        template="plotly_white"
    )
    fig.show()

# ---------------------------
# Main Program
# ---------------------------
def main():
    command = input("Enter your prediction command: ")
    try:
        variable, horizon_days = parse_command(command)
        conn = get_db_connection()
        df = fetch_historical_data(variable, conn)
        df = interpolate_data(df)
        forecast_df = predict_trend(df, horizon_days)

        print("\nRecent Historical Data:")
        print(df.tail(10))
        print("\nPredicted Values:")
        print(forecast_df)

        plot_results(df, forecast_df, variable)

    except Exception as e:
        print("Error:", e)
    finally:
        if 'conn' in locals():
            conn.close()

# ---------------------------
# Run
# ---------------------------
if __name__ == "__main__":
    main()
