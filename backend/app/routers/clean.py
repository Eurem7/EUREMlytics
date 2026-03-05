"""
routers/clean.py
================
Runs the EnterpriseDataEngine on an uploaded file and returns
the full cleaning result as JSON.
"""

import os
import math
import secrets
import io
import pandas as pd
import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from app.engine import EnterpriseDataEngine
from app.config import CleaningConfig
from app.schemas import CleaningResponse
from app.session import session_store

router = APIRouter(prefix="/clean", tags=["clean"])

SUPABASE_URL         = "https://lisyiprowqxybfttenud.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_JWT_SECRET  = os.getenv("SUPABASE_JWT_SECRET", "")


def _get_user(request: Request):
    """Extract user from Bearer JWT — no external module needed."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        from jose import jwt, JWTError
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                             options={"verify_aud": False})
        return payload
    except Exception:
        return None


def _get_dataframe(session_id: str | None) -> pd.DataFrame:
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")
    df = session_store.get_df(session_id)
    if df is None:
        raise HTTPException(status_code=404,
            detail=f"Session '{session_id}' not found or expired. Please re-upload your file.")
    return df


def _safe_val(v):
    """Convert a single value to JSON-serialisable type."""
    if v is None:
        return None
    try:
        import numpy as _np
        if isinstance(v, _np.integer): return int(v)
        if isinstance(v, _np.floating):
            f = float(v)
            return None if (math.isnan(f) or math.isinf(f)) else f
        if isinstance(v, _np.bool_): return bool(v)
    except Exception:
        pass
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    try:
        import pandas as _pd
        if _pd.isna(v): return None
    except Exception:
        pass
    return v


def _safe_rows(rows):
    return [{k: _safe_val(v) for k, v in row.items()} for row in rows]


@router.post("/", response_model=CleaningResponse)
def clean_data(
    request: Request,
    session_id: str | None = Query(default=None),
    outlier_method:              str   | None = Query(default=None, enum=["iqr", "zscore"]),
    outlier_action:              str   | None = Query(default=None, enum=["flag", "cap", "remove", "none"]),
    outlier_iqr_multiplier:      float | None = Query(default=None, ge=0.5, le=10.0),
    outlier_zscore_threshold:    float | None = Query(default=None, ge=1.0, le=10.0),
    impute_numeric_strategy:     str   | None = Query(default=None, enum=["median", "mean", "zero"]),
    impute_categorical_strategy: str   | None = Query(default=None, enum=["mode", "none"]),
    missing_drop_threshold:      float | None = Query(default=None, ge=0.0, le=1.0),
):
    df = _get_dataframe(session_id)

    # ── Row limit enforcement ──
    FREE_ROW_LIMIT = 500
    if len(df) > FREE_ROW_LIMIT:
        user = _get_user(request)
        if not user:
            raise HTTPException(status_code=403,
                detail=f"Free tier limit is {FREE_ROW_LIMIT} rows. Sign in and upgrade to Pro.")
        user_id = user.get("sub", "")
        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/subscriptions",
            params={"user_id": f"eq.{user_id}", "select": "status,current_period_end"},
            headers={"apikey": SUPABASE_SERVICE_KEY,
                     "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
        )
        rows_data = r.json() if r.status_code == 200 else []
        is_active = False
        if rows_data:
            from datetime import datetime, timezone
            sub = rows_data[0]
            if sub.get("status") == "active":
                period_end = sub.get("current_period_end")
                if period_end:
                    is_active = datetime.fromisoformat(period_end) > datetime.now(timezone.utc)
                else:
                    is_active = True
        if not is_active:
            raise HTTPException(status_code=403,
                detail=f"Free tier limit is {FREE_ROW_LIMIT} rows. Upgrade to Pro.")

    # Snapshot raw data BEFORE engine modifies df
    raw_preview = df.head(10).copy().to_dict(orient="records")

    config = CleaningConfig()
    if outlier_method:              config.outlier_method = outlier_method
    if outlier_action:              config.outlier_action = outlier_action
    if outlier_iqr_multiplier:      config.outlier_iqr_multiplier = outlier_iqr_multiplier
    if outlier_zscore_threshold:    config.outlier_zscore_threshold = outlier_zscore_threshold
    if impute_numeric_strategy:     config.impute_numeric_strategy = impute_numeric_strategy
    if impute_categorical_strategy: config.impute_categorical_strategy = impute_categorical_strategy
    if missing_drop_threshold:      config.missing_drop_threshold = missing_drop_threshold

    try:
        engine = EnterpriseDataEngine(df, config)
        result = engine.run()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")

    if session_id:
        session_store.save_result(session_id, result)

    cleaned_df = result["cleaned_dataframe"]
    safe_cleaned = _safe_rows(cleaned_df.to_dict(orient="records"))
    safe_raw     = _safe_rows(raw_preview)

    # ── Auto-publish permanent report to Supabase ──
    share_token = None
    try:
        user = _get_user(request)
        token  = "rpt_" + secrets.token_urlsafe(8)
        buf = io.StringIO()
        cleaned_df.to_csv(buf, index=False)
        csv_str = buf.getvalue()
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/reports",
            json={
                "token":          token,
                "user_id":        user.get("sub") if user else None,
                "filename":       session_store.get_filename(session_id) or "cleaned_data.csv",
                "column_quality": result.get("column_quality_summary", []),
                "audit_log":      result.get("audit_log", []),
                "cleaned_shape":  list(cleaned_df.shape),
                "eda_report":     result.get("eda_report", {}),
                "csv_data":       csv_str,
            },
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            timeout=8.0,
        )
        if resp.status_code in (200, 201):
            share_token = token
    except Exception:
        pass  # Never block clean result over publish failure

    return CleaningResponse(
        session_id=session_id,
        raw_dataframe=safe_raw,
        cleaned_dataframe=safe_cleaned,
        audit_log=result["audit_log"],
        column_quality_summary=result["column_quality_summary"],
        eda_report=result["eda_report"],
        original_shape=list(result["eda_report"].get("original_shape", [len(df), len(df.columns)])),
        cleaned_shape=list(cleaned_df.shape),
        rows_removed=len(df) - len(cleaned_df),
        columns_dropped=len(df.columns) - len(cleaned_df.columns),
        share_token=share_token,
    )
