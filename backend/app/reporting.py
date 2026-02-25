"""
reporting.py
============
Builds the Jinja2 template context from raw engine output.
All data shaping, sorting, and formatting lives here.
The template stays logic-free.
"""

import pandas as pd
from fastapi.requests import Request


def _quality_css_class(score: float) -> str:
    if score >= 0.85:
        return "good"
    elif score >= 0.60:
        return "warn"
    return "bad"


def build_report_context(request: Request, result: dict) -> dict:
    cleaned_df: pd.DataFrame = result["cleaned_dataframe"]
    eda        = result["eda_report"]
    audit_log  = result["audit_log"]

    # Column quality — annotate css_class, sort best to worst
    quality = []
    for entry in result["column_quality_summary"]:
        q = dict(entry)
        q["css_class"] = _quality_css_class(q["quality_score"])
        quality.append(q)
    quality.sort(key=lambda x: x["quality_score"], reverse=True)

    # Missing values — post-clean, sorted by count descending
    missing = [
        {"column": col, "count": int(count)}
        for col, count in sorted(
            eda.get("missing_values", {}).items(),
            key=lambda x: x[1],
            reverse=True,
        )
        if count > 0
    ]

    # Correlation matrix
    corr      = eda.get("correlation_matrix", {})
    corr_cols = list(corr.keys())
    corr_rows = []
    for row_label in corr_cols:
        row = {"label": row_label}
        for col_label in corr_cols:
            raw = corr[row_label].get(col_label)
            row[col_label] = round(raw, 3) if isinstance(raw, float) else "—"
        corr_rows.append(row)

    # Value counts — stringify keys for Jinja2 safety
    value_counts = {}
    for col, counts in eda.get("value_counts", {}).items():
        value_counts[col] = {
            str(k) if k is not None else "NaN": v
            for k, v in counts.items()
        }

    preview_html = cleaned_df.head(10).to_html(
        classes="", index=False, border=0, na_rep="—"
    )

    return {
        "request":        request,
        "shape":          eda["shape"],
        "original_shape": eda.get("original_shape", eda["shape"]),
        "column_quality": quality,
        "missing_values": missing,
        "corr_columns":   corr_cols,
        "corr_rows":      corr_rows,
        "distributions":  eda.get("distributions", {}),
        "value_counts":   value_counts,
        "preview_html":   preview_html,
        "audit_log":      audit_log,
    }