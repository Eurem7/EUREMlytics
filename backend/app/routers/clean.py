"""
routers/clean.py
================
Runs the EnterpriseDataEngine on an uploaded file and returns
the full cleaning result as JSON.
"""

import os
import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request
from app.engine import EnterpriseDataEngine
from app.config import CleaningConfig
from app.schemas import CleaningResponse
from app.session import session_store

router = APIRouter(prefix="/clean", tags=["clean"])


def _get_dataframe(session_id: str | None) -> pd.DataFrame:
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id is required. Upload a file first via POST /upload/",
        )
    df = session_store.get_df(session_id)
    if df is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found or expired. Please upload the file again.",
        )
    return df


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
        # Check subscription via Supabase
        import httpx as _httpx
        from app.auth import get_current_user as _get_user
        user = _get_user(request)
        if not user:
            raise HTTPException(
                status_code=403,
                detail=f"Free tier limit is {FREE_ROW_LIMIT} rows. Sign in and upgrade to Pro to clean larger files."
            )
        user_id = user.get("sub", "")
        SUPABASE_URL = "https://lisyiprowqxybfttenud.supabase.co"
        SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
        r = _httpx.get(
            f"{SUPABASE_URL}/rest/v1/subscriptions",
            params={"user_id": f"eq.{user_id}", "select": "status,current_period_end"},
            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
        )
        rows_data = r.json() if r.status_code == 200 else []
        is_active = False
        if rows_data:
            from datetime import datetime, timezone
            sub = rows_data[0]
            if sub.get("status") == "active":
                period_end = sub.get("current_period_end")
                if period_end:
                    if datetime.fromisoformat(period_end) > datetime.now(timezone.utc):
                        is_active = True
                else:
                    is_active = True
        if not is_active:
            raise HTTPException(
                status_code=403,
                detail=f"Free tier limit is {FREE_ROW_LIMIT} rows. Upgrade to Pro to clean larger files."
            )

    # Snapshot raw data BEFORE engine runs — engine may modify df in place
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

    return CleaningResponse(
        session_id=session_id,
        raw_dataframe=raw_preview,
        cleaned_dataframe=cleaned_df.to_dict(orient="records"),
        audit_log=result["audit_log"],
        column_quality_summary=result["column_quality_summary"],
        eda_report=result["eda_report"],
        original_shape=list(result["eda_report"].get("original_shape", [len(df), len(df.columns)])),
        cleaned_shape=list(cleaned_df.shape),
        rows_removed=len(df) - len(cleaned_df),
        columns_dropped=len(df.columns) - len(cleaned_df.columns),
    )
