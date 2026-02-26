"""
routers/clean.py
================
Runs the EnterpriseDataEngine on an uploaded file and returns
the full cleaning result as JSON.
"""

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
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
        raw_dataframe=df.head(10).to_dict(orient="records"),
        cleaned_dataframe=cleaned_df.to_dict(orient="records"),
        audit_log=result["audit_log"],
        column_quality_summary=result["column_quality_summary"],
        eda_report=result["eda_report"],
        original_shape=list(result["eda_report"].get("original_shape", [len(df), len(df.columns)])),
        cleaned_shape=list(cleaned_df.shape),
        rows_removed=len(df) - len(cleaned_df),
        columns_dropped=len(df.columns) - len(cleaned_df.columns),
    )
