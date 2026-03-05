"""
routers/report.py
=================
Serves HTML report, CSV download, PDF download,
permanent shareable reports, and column explanations.
"""

import io
import csv
import os
import secrets
import json

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from app.engine import EnterpriseDataEngine
from app.config import CleaningConfig
from app.reporting import build_report_context
from app.session import session_store
from app.utils import explain_report

router = APIRouter(prefix="/report", tags=["report"])
templates = Jinja2Templates(directory="templates")

SUPABASE_URL         = "https://lisyiprowqxybfttenud.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
FRONTEND_URL         = "https://eure-mlytics.vercel.app"


# ─── Auth helper ─────────────────────────────────────────────

async def _get_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_SERVICE_KEY},
            timeout=8.0,
        )
    if r.status_code != 200:
        return None
    u = r.json()
    uid = u.get("id")
    return {"id": uid, "sub": uid, "email": u.get("email")}


def _sb_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


# ─── Session result helper ───────────────────────────────────

def _get_result(session_id: str | None) -> dict:
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")
    result = session_store.get_result(session_id)
    if result:
        return result
    df = session_store.get_df(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Session not found or expired.")
    try:
        result = EnterpriseDataEngine(df, CleaningConfig()).run()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")
    session_store.save_result(session_id, result)
    return result


# ─── CSV helper ──────────────────────────────────────────────

def _df_to_csv_string(cleaned_df) -> str:
    buf = io.StringIO()
    cleaned_df.to_csv(buf, index=False)
    return buf.getvalue()


# ─── Existing endpoints ──────────────────────────────────────

@router.get("/html", response_class=HTMLResponse)
def get_html_report(request: Request, session_id: str | None = Query(default=None)):
    result  = _get_result(session_id)
    context = build_report_context(request, result)
    return templates.TemplateResponse("report.html", context)


@router.get("/csv")
def download_csv(session_id: str | None = Query(default=None)):
    result     = _get_result(session_id)
    cleaned_df = result["cleaned_dataframe"]

    def csv_generator():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(cleaned_df.columns.tolist())
        yield buf.getvalue(); buf.seek(0); buf.truncate()
        for _, row in cleaned_df.iterrows():
            writer.writerow(row.tolist())
            yield buf.getvalue(); buf.seek(0); buf.truncate()

    filename = f"cleaned_{session_id[:8]}.csv"
    return StreamingResponse(
        csv_generator(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── NEW: Column explanations ────────────────────────────────

@router.get("/explain")
def get_explanations(session_id: str | None = Query(default=None)):
    """
    Returns human-readable explanations for every column —
    what was wrong, what was fixed, overall dataset health.
    """
    result = _get_result(session_id)
    explanation = explain_report(
        result.get("column_quality_summary", []),
        result.get("audit_log", []),
    )
    return JSONResponse(explanation)


# ─── NEW: Publish permanent shareable report ─────────────────

@router.post("/publish")
async def publish_report(request: Request, session_id: str | None = Query(default=None)):
    """
    Saves the clean result permanently to Supabase.
    Returns a public token: GET /report/shared/{token}
    Works for both authed and anonymous users.
    """
    result = _get_result(session_id)
    user   = await _get_user(request)

    # Generate short unique token e.g. "rpt_a3f9k2b1"
    token = "rpt_" + secrets.token_urlsafe(8)

    # Serialise the cleaned CSV
    csv_data = _df_to_csv_string(result["cleaned_dataframe"])

    # Store to Supabase
    payload = {
        "token":          token,
        "user_id":        user["id"] if user else None,
        "filename":       result.get("filename", "cleaned_data.csv"),
        "column_quality": result.get("column_quality_summary", []),
        "audit_log":      result.get("audit_log", []),
        "cleaned_shape":  list(result.get("cleaned_shape", [])),
        "eda_report":     result.get("eda_report", {}),
        "csv_data":       csv_data,
    }

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/reports",
            json=payload,
            headers={**_sb_headers(), "Prefer": "return=minimal"},
        )

    if r.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to save report.")

    share_url = f"{FRONTEND_URL}/report/{token}"
    return {"token": token, "url": share_url}


# ─── NEW: View shared report ─────────────────────────────────

@router.get("/shared/{token}", response_class=HTMLResponse)
async def view_shared_report(request: Request, token: str):
    """
    Public endpoint — renders a report page from a saved token.
    No authentication required.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/reports",
            params={"token": f"eq.{token}", "select": "*"},
            headers=_sb_headers(),
        )

    rows = r.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Report not found or link has expired.")

    row = rows[0]

    # Rebuild a result-like dict for the template
    result = {
        "filename":             row.get("filename", ""),
        "column_quality_summary": row.get("column_quality", []),
        "audit_log":            row.get("audit_log", []),
        "cleaned_shape":        tuple(row.get("cleaned_shape", [0, 0])),
        "eda_report":           row.get("eda_report", {}),
        "shared":               True,
        "token":                token,
        "created_at":           row.get("created_at", ""),
    }

    context = build_report_context(request, result)
    context["shared"]     = True
    context["token"]      = token
    context["share_url"]  = f"{FRONTEND_URL}/report/{token}"
    context["csv_url"]    = f"/report/shared/{token}/csv"
    return templates.TemplateResponse("report.html", context)


# ─── NEW: Re-download CSV from saved report ──────────────────

@router.get("/shared/{token}/csv")
async def download_shared_csv(token: str):
    """
    Re-download the cleaned CSV from a permanently saved report.
    No session required — works days or weeks after the original clean.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/reports",
            params={"token": f"eq.{token}", "select": "filename,csv_data"},
            headers=_sb_headers(),
        )

    rows = r.json()
    if not rows or not rows[0].get("csv_data"):
        raise HTTPException(status_code=404, detail="Report not found.")

    row      = rows[0]
    filename = row.get("filename", "cleaned_data.csv")
    # Ensure .csv extension
    if not filename.endswith(".csv"):
        filename = filename.rsplit(".", 1)[0] + "_cleaned.csv"

    return StreamingResponse(
        iter([row["csv_data"]]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



# ─── NEW: Get shared report as JSON (for frontend rendering) ─

@router.get("/shared/{token}/data")
async def get_shared_report_data(token: str):
    """
    Returns the saved report as JSON — used by the frontend
    SharedReportScreen to render the report without the backend template.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/reports",
            params={"token": f"eq.{token}", "select": "token,filename,created_at,cleaned_shape,column_quality,audit_log,eda_report"},
            headers=_sb_headers(),
        )

    rows = r.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Report not found.")

    row = rows[0]
    return {
        "token":          row["token"],
        "filename":       row.get("filename", ""),
        "created_at":     row.get("created_at", ""),
        "cleaned_shape":  row.get("cleaned_shape", [0, 0]),
        "column_quality": row.get("column_quality", []),
        "audit_log":      row.get("audit_log", []),
        "eda_report":     row.get("eda_report", {}),
    }

# ─── NEW: List user's saved reports ──────────────────────────

@router.get("/my")
async def list_my_reports(request: Request):
    """
    Returns all reports saved by the current user.
    Used to populate the history tab with re-download links.
    """
    user = await _get_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    user_id = user.get("id") or user.get("sub", "")
    if not user_id:
        return {"reports": []}

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/reports",
                params={
                    "user_id": f"eq.{user_id}",
                    "select":  "token,filename,created_at,cleaned_shape,column_quality",
                    "order":   "created_at.desc",
                    "limit":   "50",
                },
                headers=_sb_headers(),
                timeout=8.0,
            )

        # Supabase returns an error dict if the table doesn't exist
        rows = r.json()
        if not isinstance(rows, list):
            return {"reports": []}

        enriched = []
        for row in rows:
            try:
                quality   = row.get("column_quality", []) or []
                avg_score = sum(c.get("quality_score", 0) for c in quality) / max(len(quality), 1)
                shape     = row.get("cleaned_shape", [0, 0]) or [0, 0]
                enriched.append({
                    "token":      row["token"],
                    "filename":   row.get("filename", "cleaned_data.csv"),
                    "created_at": row.get("created_at", ""),
                    "rows":       shape[0] if len(shape) > 0 else 0,
                    "columns":    shape[1] if len(shape) > 1 else 0,
                    "avg_score":  round(avg_score, 4),
                    "share_url":  f"{FRONTEND_URL}/report/{row['token']}",
                    "csv_url":    f"/report/shared/{row['token']}/csv",
                })
            except Exception:
                continue

        return {"reports": enriched}

    except Exception:
        return {"reports": []}
