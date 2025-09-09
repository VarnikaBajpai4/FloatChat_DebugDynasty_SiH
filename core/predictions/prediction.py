# ts_forecast.py
import os
import re
import math
import joblib
import psycopg2
import pandas as pd
import numpy as np
from datetime import timedelta
from xgboost import XGBRegressor

# --- CONFIG ---
PG_DSN = os.environ.get("PG_DSN", "dbname=floatchat user=postgres password=admin host=localhost port=5432")
MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Allowed user choices
TARGETS = {"temp": "temp", "psal": "psal", "pres": "pres"}

# Physical sanity ranges
VALID_RANGES = {
    "temp": (-3.0, 45.0),
    "psal": (0.0, 45.0),
    "pres": (0.0, 12000.0),
}

# Lags/rolls to encode seasonality + inertia
LAGS = [1, 7, 14, 30]
ROLLS = [7, 30]


def _model_path(target: str) -> str:
    return os.path.join(MODEL_DIR, f"ts_{target}.pkl")


def _connect():
    return psycopg2.connect(PG_DSN)


def _parse_horizon(h: str) -> int:
    """
    Accepts '5d', '3w', '6m', '1y' etc. Returns number of days (max 365).
    """
    if not isinstance(h, str):
        raise ValueError("Horizon must be a string like '5d', '3w', '6m', or '1y'.")

    m = re.fullmatch(r"\s*(\d+)\s*([dwmy])\s*", h.lower())
    if not m:
        raise ValueError("Use horizon like '5d', '3w', '6m', or '1y'.")

    n = int(m.group(1))
    unit = m.group(2)

    if unit == "d":
        days = n
    elif unit == "w":
        days = n * 7
    elif unit == "m":
        days = n * 30  # coarse month
    elif unit == "y":
        days = n * 365
    else:
        raise ValueError("Unit must be one of d/w/m/y.")

    return int(min(days, 365))


def _fetch_daily_series(target: str, min_date_back_days: int = 730) -> pd.DataFrame:
    """
    Builds a global daily series for the target using QC filters and a near-surface depth band.
    Adjust WHERE to your needs (region, depth band, modality, QC flags).
    """
    assert target in TARGETS
    col = TARGETS[target]

    # Example QC sketch; adapt to your schema
    qc_clause = {
        "temp": "lc.temp_qc IN ('1','2')",
        "psal": "lc.psal_qc IN ('1','2')",
        "pres": "TRUE"  # pressure QC varies; permissive default
    }[target]

    # Example depth band (0–200 dbar) to stabilize the series
    depth_clause = "lc.pres BETWEEN 0 AND 200"

    query = f"""
        WITH base AS (
            SELECT
                date_trunc('day', p.juld_time)::date AS d,
                lc.{col} AS val
            FROM levels_core lc
            JOIN profiles p ON p.id = lc.profile_id
            WHERE {qc_clause}
              AND {depth_clause}
              AND lc.{col} IS NOT NULL
              AND p.juld_time >= now() - interval '{min_date_back_days} days'
        )
        SELECT d, AVG(val) AS daily_val
        FROM base
        GROUP BY d
        ORDER BY d;
    """

    with _connect() as conn:
        df = pd.read_sql(query, conn)

    if df.empty:
        raise RuntimeError(f"No data available to train time series for '{target}'.")

    # Clamp to physical ranges
    lo, hi = VALID_RANGES[target]
    df["daily_val"] = df["daily_val"].clip(lo, hi)

    # Reindex to continuous daily frequency (forward-fill gaps)
    all_days = pd.date_range(df["d"].min(), df["d"].max(), freq="D")
    df = df.set_index("d").reindex(all_days)
    df.index.name = "d"
    df["daily_val"] = df["daily_val"].ffill()

    return df.reset_index(names="d")


def _make_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for lag in LAGS:
        out[f"lag_{lag}"] = out["daily_val"].shift(lag)
    for w in ROLLS:
        out[f"roll{w}"] = out["daily_val"].rolling(w, min_periods=max(2, w // 2)).mean()
    out = out.dropna().reset_index(drop=True)
    return out


def train_ts_model(target: str = "temp") -> dict:
    """
    Train per-target XGBRegressor on lag/roll features of its daily series.
    Returns basic metrics on a small holdout.
    """
    target = target.lower()
    if target not in TARGETS:
        raise ValueError(f"target must be one of {list(TARGETS.keys())}")

    df = _fetch_daily_series(target)
    feat_df = _make_features(df)

    # Time-aware split: last 20% as validation
    split_idx = int(math.floor(len(feat_df) * 0.8))
    train_df = feat_df.iloc[:split_idx]
    valid_df = feat_df.iloc[split_idx:]

    X_cols = [c for c in feat_df.columns if c not in ("daily_val", "d")]
    X_tr, y_tr = train_df[X_cols], train_df["daily_val"]
    X_va, y_va = valid_df[X_cols], valid_df["daily_val"]

    model = XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=-1,
        reg_lambda=1.0
    )
    model.fit(X_tr, y_tr)

    # Simple metrics
    va_pred = model.predict(X_va)
    mae = float(np.mean(np.abs(va_pred - y_va)))
    rmse = float(np.sqrt(np.mean((va_pred - y_va) ** 2)))

    joblib.dump(
        {
            "model": model,
            "X_cols": X_cols,
            "last_date": df["d"].max(),   # where the series ends
            "target": target
        },
        _model_path(target)
    )

    return {
        "target": target,
        "train_rows": int(len(train_df)),
        "valid_rows": int(len(valid_df)),
        "MAE": mae,
        "RMSE": rmse
    }


def forecast_days(target: str, horizon: str) -> pd.DataFrame:
    """
    Returns a DataFrame with columns: date, pred for each future day.
    """
    target = target.lower()
    if target not in TARGETS:
        raise ValueError(f"target must be one of {list(TARGETS.keys())}")

    blob = joblib.load(_model_path(target))
    model = blob["model"]
    X_cols = blob["X_cols"]
    last_trained_date = pd.to_datetime(blob["last_date"]).date()

    # Rebuild the latest history to seed lags
    hist = _fetch_daily_series(target)
    hist = hist[hist["d"] <= pd.Timestamp(last_trained_date)]
    hist = hist.set_index("d").sort_index()

    # Need enough history for lags/rolls
    min_history = max(max(LAGS), max(ROLLS))
    if len(hist) < min_history + 5:
        raise RuntimeError("Not enough history to generate lag/roll features.")

    # Recursive forecasting
    days = _parse_horizon(horizon)
    preds = []
    current_series = hist["daily_val"].copy()

    for i in range(1, days + 1):
        next_day = hist.index.max() + pd.Timedelta(days=i)
        tmp = pd.DataFrame({"d": [next_day], "daily_val": [np.nan]}).set_index("d")

        # append a placeholder
        s = pd.concat([current_series, tmp["daily_val"]]).sort_index()

        # build features for the last row only
        row = {}
        for lag in LAGS:
            row[f"lag_{lag}"] = s.shift(lag).iloc[-1]
        for w in ROLLS:
            row[f"roll{w}"] = s.rolling(w, min_periods=max(2, w // 2)).mean().iloc[-1]

        X_last = pd.DataFrame([row])[X_cols]
        y_hat = float(model.predict(X_last)[0])

        # append prediction to series so future steps can use it
        s.iloc[-1] = y_hat
        current_series = s

        preds.append({"date": next_day.date(), "pred": y_hat})

    return pd.DataFrame(preds)


# --- MINI CLI (interactive): run `python ts_forecast.py` ---
def _normalize_target(s: str) -> str:
    s = s.strip().lower()
    if s in ("temperature", "temp", "t"):
        return "temp"
    if s in ("salinity", "psal", "s"):
        return "psal"
    if s in ("pressure", "pres", "p"):
        return "pres"
    raise ValueError("Choose one: temperature | salinity | pressure")


def _normalize_horizon(h: str) -> str:
    h = h.strip().lower()
    # Accept "5d/3w/6m/1y" or "5 days", "3 weeks", etc.
    alias = {
        "day": "d", "days": "d",
        "week": "w", "weeks": "w",
        "month": "m", "months": "m",
        "year": "y", "years": "y",
    }
    # already compact form like "5d"
    if re.fullmatch(r"\s*\d+\s*[dwmy]\s*", h):
        return re.sub(r"\s+", "", h)
    # phrases like "5 days"
    m = re.fullmatch(r"\s*(\d+)\s*([a-z]+)\s*", h)
    if m and m.group(2) in alias:
        return f"{int(m.group(1))}{alias[m.group(2)]}"
    raise ValueError("Time must look like: 5d | 3w | 6m | 1y (or '5 days', '3 weeks', etc.)")


if __name__ == "__main__":
    try:
        var_in = input("Variable [temperature | salinity | pressure]: ")
        horizon_in = input("Time (e.g., 5d | 3w | 6m | 1y, also accepts '5 days', '3 weeks'): ")

        target = _normalize_target(var_in)
        horizon = _normalize_horizon(horizon_in)

        pkl_path = _model_path(target)
        if not os.path.exists(pkl_path):
            print(f"Model for '{target}' not found. Training now…")
            info = train_ts_model(target)
            print(f"Trained {info['target']}  MAE={info['MAE']:.3f}  RMSE={info['RMSE']:.3f}")

        print(f"\nForecasting {target} for {horizon}...\n")
        df = forecast_days(target, horizon)
        with pd.option_context('display.max_rows', None, 'display.max_columns', None):
            print(df.to_string(index=False))

    except Exception as e:
        print("Error:", e)