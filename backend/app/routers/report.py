"""
routers/report.py
=================
Serves HTML report, CSV download, and PDF download.
All endpoints require a valid session_id from /upload.
"""

import io
import csv
import pandas as pd

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates

from app.engine import EnterpriseDataEngine
from app.config import CleaningConfig
from app.reporting import build_report_context
from app.session import session_store

router = APIRouter(prefix="/report", tags=["report"])
templates = Jinja2Templates(directory="templates")


def _get_result(session_id: str | None) -> dict:
    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="session_id is required. Upload a file first via POST /upload/",
        )

    # Return cached result if /clean was already called
    result = session_store.get_result(session_id)
    if result:
        return result

    # Not cleaned yet — run with defaults
    df = session_store.get_df(session_id)
    if df is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found or expired. Please upload again.",
        )

    try:
        result = EnterpriseDataEngine(df, CleaningConfig()).run()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")

    session_store.save_result(session_id, result)
    return result


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


@router.get("/pdf")
def download_pdf(request: Request, session_id: str | None = Query(default=None)):
    try:
        from weasyprint import HTML as WeasyHTML
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="PDF generation requires WeasyPrint. Install it with: pip install weasyprint",
        )

    result   = _get_result(session_id)
    context  = build_report_context(request, result)
    html_str = templates.get_template("report.html").render(context)

    try:
        pdf_bytes = WeasyHTML(string=html_str).write_pdf()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

    filename = f"report_{session_id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )