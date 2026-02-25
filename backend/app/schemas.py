"""
schemas.py
==========
Pydantic response models for the API.
"""

from typing import Any
from pydantic import BaseModel


class CleaningResponse(BaseModel):
    session_id:             str
    cleaned_dataframe:      list[dict[str, Any]]
    audit_log:              list[dict[str, Any]]
    column_quality_summary: list[dict[str, Any]]
    eda_report:             dict[str, Any]
    original_shape:         list[int]
    cleaned_shape:          list[int]
    rows_removed:           int
    columns_dropped:        int

    model_config = {"arbitrary_types_allowed": True}