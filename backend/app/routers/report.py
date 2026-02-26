"""
routers/report.py
=================
Serves HTML report, CSV download, and PDF download.
"""

import io
import csv

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
    result = session_store.get_result(session_id)
    if result:
        return result

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
def download_pdf(session_id: str | None = Query(default=None)):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )

    result     = _get_result(session_id)
    cleaned_df = result["cleaned_dataframe"]
    quality    = result.get("column_quality_summary", [])
    audit      = result.get("audit_log", [])
    eda        = result.get("eda_report", {})

    orig_shape    = eda.get("original_shape", [0, 0])
    cleaned_shape = list(cleaned_df.shape)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    # ── Colour palette ──
    BLACK   = colors.HexColor("#0f0f0e")
    GREY    = colors.HexColor("#8c8c86")
    LGREY   = colors.HexColor("#efefec")
    BORDER  = colors.HexColor("#d1d1cc")
    GREEN   = colors.HexColor("#00875a")
    WARN    = colors.HexColor("#b45309")
    RED     = colors.HexColor("#c0392b")
    ACCENT  = colors.HexColor("#1a6bff")

    styles = getSampleStyleSheet()

    def sty(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    brand_sty    = sty("brand",    fontSize=14, fontName="Helvetica-Bold", textColor=BLACK, spaceAfter=2)
    tagline_sty  = sty("tagline",  fontSize=8,  fontName="Helvetica",      textColor=GREY)
    section_sty  = sty("section",  fontSize=7,  fontName="Helvetica-Bold", textColor=GREY,
                        spaceBefore=14, spaceAfter=6, textTransform="uppercase", letterSpacing=1.5)
    body_sty     = sty("body",     fontSize=8,  fontName="Helvetica",      textColor=BLACK)
    mono_sty     = sty("mono",     fontSize=7,  fontName="Courier",        textColor=BLACK)
    stat_val_sty = sty("statval",  fontSize=18, fontName="Helvetica-Bold", textColor=BLACK, leading=20)
    stat_lbl_sty = sty("statlbl",  fontSize=6,  fontName="Helvetica-Bold", textColor=GREY,
                        textTransform="uppercase", letterSpacing=1)

    def score_color(s):
        if s >= 0.85: return GREEN
        if s >= 0.60: return WARN
        return RED

    story = []

    # ── Header ──
    story.append(Paragraph("Oxdemi.io", brand_sty))
    story.append(Paragraph("Raw in. Clean out. — Quality Report", tagline_sty))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 4*mm))

    # ── Overview stats ──
    story.append(Paragraph("Overview", section_sty))

    n_good = len([q for q in quality if not q.get("dropped") and q.get("quality_score",0) >= 0.85])
    n_warn = len([q for q in quality if not q.get("dropped") and 0.60 <= q.get("quality_score",0) < 0.85])
    n_bad  = len([q for q in quality if not q.get("dropped") and q.get("quality_score",0) < 0.60])
    n_drop = len([q for q in quality if q.get("dropped")])

    stat_data = [
        [Paragraph(str(orig_shape[0]), stat_val_sty),
         Paragraph(str(cleaned_shape[0]), stat_val_sty),
         Paragraph(str(cleaned_shape[1]), stat_val_sty),
         Paragraph(str(n_good), stat_val_sty),
         Paragraph(str(len(audit)), stat_val_sty)],
        [Paragraph("Original Rows", stat_lbl_sty),
         Paragraph("Clean Rows", stat_lbl_sty),
         Paragraph("Columns", stat_lbl_sty),
         Paragraph("High Quality", stat_lbl_sty),
         Paragraph("Actions", stat_lbl_sty)],
    ]
    stat_tbl = Table(stat_data, colWidths=["20%","20%","20%","20%","20%"])
    stat_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.white),
        ("BOX",        (0,0), (-1,-1), 0.5, BORDER),
        ("INNERGRID",  (0,0), (-1,-1), 0.5, BORDER),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10),
        ("RIGHTPADDING",(0,0),(-1,-1),10),
        ("ALIGN",      (0,0), (-1,-1), "LEFT"),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(stat_tbl)
    story.append(Spacer(1, 4*mm))

    # ── Column quality ──
    story.append(Paragraph("Column Quality", section_sty))

    col_header = [
        Paragraph("Column",        sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
        Paragraph("Type",          sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
        Paragraph("Quality Score", sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
        Paragraph("Missing %",     sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
        Paragraph("Status",        sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
    ]
    col_rows = [col_header]
    for q in sorted(quality, key=lambda x: (-x.get("quality_score",0))):
        score = q.get("quality_score", 0)
        sc    = score_color(score)
        status = "Dropped" if q.get("dropped") else ("Good" if score >= 0.85 else "Review" if score >= 0.60 else "Poor")
        col_rows.append([
            Paragraph(str(q.get("column","")),      mono_sty),
            Paragraph(str(q.get("type","")),         body_sty),
            Paragraph(f"{score:.2f}",                sty("s", fontSize=8, fontName="Helvetica-Bold", textColor=sc)),
            Paragraph(f"{q.get('missing_pct','—')}{'%' if q.get('missing_pct') is not None else ''}", body_sty),
            Paragraph(status,                        sty("st", fontSize=7, fontName="Helvetica-Bold",
                                                         textColor=GREEN if status=="Good" else WARN if status=="Review" else RED)),
        ])

    col_tbl = Table(col_rows, colWidths=["32%","12%","16%","14%","12%"])
    col_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  LGREY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),  [colors.white, colors.HexColor("#fafaf8")]),
        ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
        ("INNERGRID",     (0,0), (-1,-1), 0.25, BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(col_tbl)
    story.append(Spacer(1, 4*mm))

    # ── Audit log ──
    story.append(Paragraph("Audit Log", section_sty))

    audit_header = [
        Paragraph("Time",   sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
        Paragraph("Action", sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
        Paragraph("Column", sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
        Paragraph("Detail", sty("h", fontSize=6, fontName="Helvetica-Bold", textColor=GREY)),
    ]
    audit_rows = [audit_header]
    for entry in audit[:50]:  # cap at 50 rows for PDF
        ts     = str(entry.get("timestamp",""))[-8:-3] or "—"
        action = str(entry.get("action","")).replace("_"," ")
        col    = str(entry.get("column","—"))
        detail = ", ".join(
            f"{k}={v}" for k,v in entry.items()
            if k not in ["action","column","timestamp"]
        )
        audit_rows.append([
            Paragraph(ts,     mono_sty),
            Paragraph(action, body_sty),
            Paragraph(col,    mono_sty),
            Paragraph(detail[:80], sty("d", fontSize=6, fontName="Helvetica", textColor=GREY)),
        ])

    audit_tbl = Table(audit_rows, colWidths=["10%","22%","22%","46%"])
    audit_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  LGREY),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),  [colors.white, colors.HexColor("#fafaf8")]),
        ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
        ("INNERGRID",     (0,0), (-1,-1), 0.25, BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
    ]))
    story.append(audit_tbl)
    story.append(Spacer(1, 6*mm))

    # ── Footer ──
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("Generated by Oxdemi.io · Raw in. Clean out.", tagline_sty))

    doc.build(story)
    buf.seek(0)

    filename = f"oxdemi_report_{session_id[:8]}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
