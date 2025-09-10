# predict.py
import os
import re
import math
import json
import argparse
import joblib
import psycopg2
import pandas as pd
import numpy as np
from xgboost import XGBRegressor
from dotenv import load_dotenv

# --------------------------
# Load .env and helpers
# --------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CORE_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))
PROJECT_ROOT = os.path.abspath(os.path.join(CORE_DIR, '..'))

# Load env files in this order (non-overriding): core/.env, project/.env, predictions/.env
load_dotenv(os.path.join(CORE_DIR, '.env'), override=False)
load_dotenv(os.path.join(PROJECT_ROOT, '.env'), override=False)
load_dotenv(os.path.join(BASE_DIR, '.env'), override=False)

def _get(env_name: str) -> str:
    v = os.environ.get(env_name)
    if v is None or str(v).strip() == "":
        raise RuntimeError(f"Missing required env var: {env_name}")
    return v

def _get_int(env_name: str) -> int:
    return int(_get(env_name))

def _get_float(env_name: str) -> float:
    return float(_get(env_name))

def _get_bool(env_name: str) -> bool:
    return str(_get(env_name)).strip().lower() in ("1", "true", "yes", "y", "on")

def _get_int_list(env_name: str) -> list[int]:
    raw = _get(env_name)
    return [int(x.strip()) for x in raw.split(",") if x.strip() != ""]

# --------------------------
# REQUIRED CONFIG (all from .env)
# --------------------------
PG_DSN        = _get("PG_DSN")
_raw_model_dir = _get("MODEL_DIR")
if os.path.isabs(_raw_model_dir):
    MODEL_DIR = _raw_model_dir
else:
    # Interpret relative MODEL_DIR with respect to core/ directory (where core/.env lives)
    MODEL_DIR = os.path.abspath(os.path.join(CORE_DIR, _raw_model_dir))
USE_QC        = _get_bool("USE_QC")
MIN_BACK_DAYS = _get_int("MIN_BACK_DAYS")
DEPTH_MIN     = _get_int("DEPTH_MIN")
DEPTH_MAX     = _get_int("DEPTH_MAX")
TS_LAGS       = _get_int_list("TS_LAGS")
TS_ROLLS      = _get_int_list("TS_ROLLS")

XGB_N_ESTIMATORS = _get_int("XGB_N_ESTIMATORS")
XGB_MAX_DEPTH    = _get_int("XGB_MAX_DEPTH")
XGB_LR           = _get_float("XGB_LR")
XGB_SUBSAMPLE    = _get_float("XGB_SUBSAMPLE")
XGB_COLSAMPLE    = _get_float("XGB_COLSAMPLE")
XGB_RANDOM_STATE = _get_int("XGB_RANDOM_STATE")
XGB_N_JOBS       = _get_int("XGB_N_JOBS")
XGB_REG_LAMBDA   = _get_float("XGB_REG_LAMBDA")

os.makedirs(MODEL_DIR, exist_ok=True)

# Allowed user choices (not env-driven)
TARGETS = {"temp": "temp", "psal": "psal", "pres": "pres"}

# Physical sanity ranges (domain constants; not env-driven)
VALID_RANGES = {
    "temp": (-3.0, 45.0),
    "psal": (0.0, 45.0),
    "pres": (0.0, 12000.0),
}

# Units per target (for UI axis labels)
UNITS = {
    "temp": "°C",
    "psal": "PSU",
    "pres": "dbar",
}

# --------------------------
# Helpers
# --------------------------
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
    days = {"d": n, "w": n * 7, "m": n * 30, "y": n * 365}[unit]
    return int(min(days, 365))

# --------------------------
# Data + Features
# --------------------------
def _fetch_daily_series(target: str, since_days: int = MIN_BACK_DAYS) -> pd.DataFrame:
    """
    Builds a global daily series for the target using QC filters and a depth band.
    'since_days' controls the history window pulled from DB (overrides MIN_BACK_DAYS).
    """
    assert target in TARGETS
    col = TARGETS[target]

    qc_clause = {
        "temp": "lc.temp_qc IN ('1','2')",
        "psal": "lc.psal_qc IN ('1','2')",
        "pres": "TRUE"
    }[target]
    if not USE_QC:
        qc_clause = "TRUE"

    depth_clause = f"lc.pres BETWEEN {DEPTH_MIN} AND {DEPTH_MAX}"

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
              AND p.juld_time >= now() - interval '{int(since_days)} days'
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

    lo, hi = VALID_RANGES[target]
    df["daily_val"] = df["daily_val"].clip(lo, hi)

    all_days = pd.date_range(df["d"].min(), df["d"].max(), freq="D")
    df = df.set_index("d").reindex(all_days)
    df.index.name = "d"
    df["daily_val"] = df["daily_val"].ffill()

    return df.reset_index(names="d")

def _make_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for lag in TS_LAGS:
        out[f"lag_{lag}"] = out["daily_val"].shift(lag)
    for w in TS_ROLLS:
        out[f"roll{w}"] = out["daily_val"].rolling(w, min_periods=max(2, w // 2)).mean()
    out = out.dropna().reset_index(drop=True)
    return out

# --------------------------
# Train + Forecast
# --------------------------
def train_ts_model(target: str = "temp") -> dict:
    """
    Train the model in-memory. 
    🔐 FIRST RUN ONLY:
        - Uncomment the two lines marked 'SAVE ARTIFACT' to write a .pkl to disk.
        - Run this once per target to create: models/ts_<target>.pkl
        - Then COMMENT THEM OUT AGAIN to avoid overwriting on future runs.
    """
    target = target.lower()
    if target not in TARGETS:
        raise ValueError(f"target must be one of {list(TARGETS.keys())}")

    df = _fetch_daily_series(target)
    feat_df = _make_features(df)

    split_idx = int(math.floor(len(feat_df) * 0.8))
    train_df = feat_df.iloc[:split_idx]
    valid_df = feat_df.iloc[split_idx:]

    X_cols = [c for c in feat_df.columns if c not in ("daily_val", "d")]
    X_tr, y_tr = train_df[X_cols], train_df["daily_val"]
    X_va, y_va = valid_df[X_cols], valid_df["daily_val"]

    model = XGBRegressor(
        n_estimators=XGB_N_ESTIMATORS,
        max_depth=XGB_MAX_DEPTH,
        learning_rate=XGB_LR,
        subsample=XGB_SUBSAMPLE,
        colsample_bytree=XGB_COLSAMPLE,
        random_state=XGB_RANDOM_STATE,
        n_jobs=XGB_N_JOBS,
        reg_lambda=XGB_REG_LAMBDA,
    )
    model.fit(X_tr, y_tr)

    va_pred = model.predict(X_va)
    mae = float(np.mean(np.abs(va_pred - y_va)))
    rmse = float(np.sqrt(np.mean((va_pred - y_va) ** 2)))

    artifact = {
        "model": model,
        "X_cols": X_cols,
        "last_date": df["d"].max(),
        "target": target
    }

    # ====== SAVE ARTIFACT — FIRST RUN ONLY ======
    # out_path = _model_path(target)
    # joblib.dump(artifact, out_path)
    # print(f"Saved model → {os.path.abspath(out_path)}")
    # ============================================

    return {"target": target, "train_rows": int(len(train_df)), "valid_rows": int(len(valid_df)), "MAE": mae, "RMSE": rmse}

def forecast_days(target: str, horizon: str, since_days: int = MIN_BACK_DAYS) -> tuple[pd.DataFrame, pd.Timestamp, pd.DataFrame]:
    """
    Returns (predictions_df, last_trained_date, history_df_used)
    - predictions_df: columns [date, pred]
    - last_trained_date: pd.Timestamp (date)
    - history_df_used: df with index 'd' and column 'daily_val' up to last_trained_date
    """
    target = target.lower()
    if target not in TARGETS:
        raise ValueError(f"target must be one of {list(TARGETS.keys())}")

    blob = joblib.load(_model_path(target))
    model = blob["model"]
    X_cols = blob["X_cols"]
    last_trained_date = pd.to_datetime(blob["last_date"]).date()

    hist = _fetch_daily_series(target, since_days=since_days)
    hist = hist[hist["d"] <= pd.Timestamp(last_trained_date)]
    hist = hist.set_index("d").sort_index()

    min_history = max(max(TS_LAGS), max(TS_ROLLS))
    if len(hist) < min_history + 5:
        raise RuntimeError("Not enough history to generate lag/roll features.")

    days = _parse_horizon(horizon)
    preds = []
    current_series = hist["daily_val"].copy()

    for i in range(1, days + 1):
        next_day = hist.index.max() + pd.Timedelta(days=i)
        tmp = pd.DataFrame({"d": [next_day], "daily_val": [np.nan]}).set_index("d")

        s = pd.concat([current_series, tmp["daily_val"]]).sort_index()

        row = {}
        for lag in TS_LAGS:
            row[f"lag_{lag}"] = s.shift(lag).iloc[-1]
        for w in TS_ROLLS:
            row[f"roll{w}"] = s.rolling(w, min_periods=max(2, w // 2)).mean().iloc[-1]

        X_last = pd.DataFrame([row])[X_cols]
        y_hat = float(model.predict(X_last)[0])

        s.iloc[-1] = y_hat
        current_series = s

        preds.append({"date": next_day.date(), "pred": y_hat})

    preds_df = pd.DataFrame(preds)
    return preds_df, pd.Timestamp(last_trained_date), hist

# --------------------------
# Tiny interactive CLI
# --------------------------
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
    alias = {"day":"d","days":"d","week":"w","weeks":"w","month":"m","months":"m","year":"y","years":"y"}
    if re.fullmatch(r"\s*\d+\s*[dwmy]\s*", h):
        return re.sub(r"\s+", "", h)
    m = re.fullmatch(r"\s*(\d+)\s*([a-z]+)\s*", h)
    if m and m.group(2) in alias:
        return f"{int(m.group(1))}{alias[m.group(2)]}"
    raise ValueError("Time must look like: 5d | 3w | 6m | 1y (or '5 days', '3 weeks', etc.)")

if __name__ == "__main__":
    def _bool(s):
        return str(s).strip().lower() in ("1", "true", "yes", "y", "on")

    parser = argparse.ArgumentParser(description="Time-series predictions CLI")
    parser.add_argument("--variable", "--var", "-v", required=False, help="temperature | salinity | pressure")
    parser.add_argument("--horizon", "-t", required=False, help="e.g., '14 days' or '14d'")
    parser.add_argument("--since-days", type=int, default=MIN_BACK_DAYS)
    parser.add_argument("--return-history", default="true", help="true|false")
    parser.add_argument("--history-days", type=int, default=30)
    parser.add_argument("--json", action="store_true", help="Emit JSON to stdout")
    args, unknown = parser.parse_known_args()

    # Interactive fallback if no args provided
    interactive = not (args.variable and args.horizon)

    try:
        if interactive and not args.json:
            var_in = input("Variable [temperature | salinity | pressure]: ")
            horizon_in = input("Time (e.g., 5d | 3w | 6m | 1y, also accepts '5 days', '3 weeks'): ")
            target = _normalize_target(var_in)
            horizon_norm = _normalize_horizon(horizon_in)
            since_days = MIN_BACK_DAYS
            ret_hist = True
            hist_days = 30
        else:
            if not args.variable or not args.horizon:
                raise ValueError("Missing required arguments: --variable and --horizon")
            target = _normalize_target(args.variable)
            horizon_norm = _normalize_horizon(args.horizon)
            since_days = int(args.since_days or MIN_BACK_DAYS)
            ret_hist = _bool(args.return_history)
            hist_days = int(args.history_days or 30)

        pkl_path = _model_path(target)
        if not os.path.exists(pkl_path):
            msg = f"Model artifact not found for '{target}' at {os.path.abspath(pkl_path)}"
            if args.json:
                print(json.dumps({"success": False, "error": msg}))
                raise SystemExit(1)
            else:
                print(msg)
                raise SystemExit(1)

        preds_df, last_trained_date, hist_df = forecast_days(target, horizon_norm, since_days=since_days)

        # Prepare outputs
        preds_out = [
            {"date": (d.isoformat() if hasattr(d, "isoformat") else str(d)), "pred": float(v)}
            for d, v in zip(preds_df["date"], preds_df["pred"])
        ]

        history_out = None
        if ret_hist and isinstance(hist_df, pd.DataFrame) and not hist_df.empty:
            hist_tail = hist_df.copy()
            hist_tail = hist_tail[hist_tail.index <= pd.Timestamp(last_trained_date)].tail(hist_days)
            history_out = [
                {
                    "date": (idx.date().isoformat() if hasattr(idx, "date") else str(idx)),
                    "value": float(val) if pd.notnull(val) else None,
                }
                for idx, val in hist_tail["daily_val"].items()
            ]

        # Reverse-map variable label for UI friendliness
        reverse_label = {"temp": "temperature", "psal": "salinity", "pres": "pressure"}[target]
        unit = UNITS[target]

        out = {
            "success": True,
            "input": {
                "variable": reverse_label,
                "horizon": args.horizon if args.horizon else horizon_norm,
                "horizonDays": int(re.fullmatch(r"\s*(\d+)\s*[dwmy]\s*", horizon_norm).group(1)) if re.fullmatch(r"\s*(\d+)\s*[dwmy]\s*", horizon_norm) else None,
                "sinceDays": since_days,
                "returnHistory": ret_hist,
                "historyDays": hist_days,
            },
            "unit": unit,
            "predictions": preds_out,
            "history": history_out if ret_hist else None,
            "model": "XGBRegressor",
            "meta": {
                "rowsFetched": int(hist_df.shape[0]) if isinstance(hist_df, pd.DataFrame) else None,
                "lastTrainedDate": str(last_trained_date),
                "lags": TS_LAGS,
                "rolls": TS_ROLLS,
            },
        }

        if args.json:
            print(json.dumps(out, default=str))
        else:
            with pd.option_context('display.max_rows', None, 'display.max_columns', None):
                print(pd.DataFrame(preds_out).to_string(index=False))

    except Exception as e:
        err_payload = {"success": False, "error": str(e)}
        # Ensure JSON-only when requested by server
        if args.json:
            print(json.dumps(err_payload))
        else:
            print("Error:", e)
