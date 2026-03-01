"""
routers/feedback.py
===================
Receives feedback from the frontend and emails it via Resend.
"""

import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/feedback", tags=["feedback"])

RESEND_API_KEY   = os.getenv("RESEND_API_KEY", "")
FEEDBACK_TO      = "jesutumininu2@gmail.com"  # your email
FEEDBACK_FROM    = "Oxdemi Feedback <onboarding@resend.dev>"


class FeedbackPayload(BaseModel):
    type:    str
    message: str
    email:   str | None = None


@router.post("/")
async def submit_feedback(payload: FeedbackPayload, request: Request):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message is required.")

    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured.")

    emoji = {"bug": "🐛", "idea": "💡", "praise": "⭐", "other": "💬"}.get(payload.type, "💬")

    html = f"""
    <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #0f0f0e; color: #fff; padding: 8px 14px; border-radius: 6px; display: inline-block; font-size: 13px; margin-bottom: 20px;">
        <strong>OXD</strong> Oxdemi.io
      </div>
      <h2 style="font-size: 18px; margin-bottom: 4px;">
        {emoji} New {payload.type.capitalize()} Feedback
      </h2>
      <p style="color: #666; font-size: 13px; margin-bottom: 20px;">
        From: {payload.email or 'anonymous'}
      </p>
      <div style="background: #f5f5f3; border: 1px solid #e0e0db; border-radius: 8px; padding: 16px 20px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
        {payload.message}
      </div>
      <p style="color: #aaa; font-size: 11px; margin-top: 24px;">
        Sent from Oxdemi.io · Raw in. Clean out.
      </p>
    </div>
    """

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.resend.com/emails",
            json={
                "from":    FEEDBACK_FROM,
                "to":      [FEEDBACK_TO],
                "subject": f"{emoji} Oxdemi feedback: {payload.type} from {payload.email or 'anonymous'}",
                "html":    html,
            },
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type":  "application/json",
            },
        )

    if res.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to send feedback email.")

    return {"status": "sent"}


@router.post("/email-summary")
async def email_clean_summary(request: Request):
    """
    Send a clean summary email after a successful clean.
    Called from the frontend after the pipeline completes.
    """
    body = await request.json()
    to_email   = body.get("email")
    filename   = body.get("filename", "your file")
    orig_rows  = body.get("orig_rows", 0)
    clean_rows = body.get("clean_rows", 0)
    columns    = body.get("columns", 0)
    avg_score  = body.get("avg_score", 0)
    actions    = body.get("actions", 0)
    session_id = body.get("session_id", "")
    report_url = f"https://euremlytics-2.onrender.com/report/html?session_id={session_id}"

    if not to_email:
        raise HTTPException(status_code=400, detail="Email is required.")
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured.")

    score_pct   = int(float(avg_score) * 100)
    score_color = "#0F9D58" if score_pct >= 85 else "#F4B400" if score_pct >= 60 else "#DB4437"
    rows_removed = orig_rows - clean_rows

    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background: #fafaf8; border: 1px solid #e8e8e3; border-radius: 12px; overflow: hidden;">
      <!-- Header -->
      <div style="background: #1a1a18; padding: 24px 28px; display: flex; align-items: center; gap: 12px;">
        <div style="background: #fff; border-radius: 6px; padding: 5px 10px; font-family: monospace; font-size: 11px; font-weight: 700; color: #1a1a18; letter-spacing: 0.05em;">OXD</div>
        <span style="color: rgba(255,255,255,0.5); font-size: 12px; font-family: monospace;">Oxdemi.io</span>
      </div>

      <!-- Body -->
      <div style="padding: 28px;">
        <h2 style="font-size: 18px; font-weight: 700; color: #1a1a18; letter-spacing: -0.02em; margin: 0 0 6px;">Your data is clean ✨</h2>
        <p style="font-size: 13px; color: #666; margin: 0 0 24px;">Here's a summary of what Oxdemi did to <strong style="color: #1a1a18;">{filename}</strong>.</p>

        <!-- Stats grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e8e8e3; border: 1px solid #e8e8e3; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
          <div style="background: #fff; padding: 14px 16px;">
            <div style="font-family: monospace; font-size: 22px; font-weight: 700; color: #1a1a18; letter-spacing: -0.03em;">{clean_rows:,}</div>
            <div style="font-size: 11px; color: #999; margin-top: 3px;">Clean rows</div>
          </div>
          <div style="background: #fff; padding: 14px 16px;">
            <div style="font-family: monospace; font-size: 22px; font-weight: 700; color: {score_color}; letter-spacing: -0.03em;">{score_pct}%</div>
            <div style="font-size: 11px; color: #999; margin-top: 3px;">Avg quality score</div>
          </div>
          <div style="background: #fff; padding: 14px 16px;">
            <div style="font-family: monospace; font-size: 22px; font-weight: 700; color: #1a1a18; letter-spacing: -0.03em;">{columns}</div>
            <div style="font-size: 11px; color: #999; margin-top: 3px;">Columns processed</div>
          </div>
          <div style="background: #fff; padding: 14px 16px;">
            <div style="font-family: monospace; font-size: 22px; font-weight: 700; color: #1a1a18; letter-spacing: -0.03em;">{actions}</div>
            <div style="font-size: 11px; color: #999; margin-top: 3px;">Actions taken</div>
          </div>
        </div>

        {f'<p style="font-size: 12px; color: #999; background: #f5f5f3; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px;">⚠ {rows_removed:,} rows were removed during deduplication or quality filtering.</p>' if rows_removed > 0 else ''}

        <a href="{report_url}" style="display: block; text-align: center; background: #1a1a18; color: #fff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 13px; border-radius: 8px; margin-bottom: 24px;">
          View Full Quality Report →
        </a>

        <p style="font-size: 11px; color: #bbb; text-align: center; margin: 0;">
          Sent by Oxdemi.io · Raw in. Clean out.<br/>
          <a href="mailto:hello@oxdemi.io" style="color: #bbb;">hello@oxdemi.io</a>
        </p>
      </div>
    </div>
    """

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.resend.com/emails",
            json={
                "from":    FEEDBACK_FROM,
                "to":      [to_email],
                "subject": f"✨ Your file '{filename}' is clean — Oxdemi report",
                "html":    html,
            },
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type":  "application/json",
            },
        )

    if res.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to send summary email.")

    return {"status": "sent"}


class EmailSummaryPayload(BaseModel):
    email:      str
    filename:   str
    orig_rows:  int
    clean_rows: int
    columns:    int
    avg_score:  str
    actions:    int
    session_id: str


@router.post("/email-summary")
async def send_email_summary(payload: EmailSummaryPayload):
    if not RESEND_API_KEY:
        return {"status": "skipped"}

    score_pct = float(payload.avg_score) * 100
    score_color = "#00875a" if score_pct >= 80 else "#b45309" if score_pct >= 60 else "#c0392b"
    rows_removed = payload.orig_rows - payload.clean_rows

    html = f"""
    <div style="font-family: 'DM Sans', system-ui, sans-serif; max-width: 560px; margin: 0 auto; background: #f5f5f3; padding: 24px;">

      <!-- Header -->
      <div style="background: #0f0f0e; border-radius: 10px 10px 0 0; padding: 20px 24px; display: flex; align-items: center; gap: 12px;">
        <div style="background: #fff; border-radius: 6px; padding: 4px 8px; font-family: monospace; font-size: 11px; font-weight: 800; color: #0f0f0e;">OXD</div>
        <span style="color: rgba(255,255,255,0.5); font-size: 12px; font-family: monospace;">Oxdemi.io</span>
      </div>

      <!-- Body -->
      <div style="background: #fff; border: 1px solid rgba(0,0,0,0.08); border-top: none; border-radius: 0 0 10px 10px; padding: 28px 24px;">
        <h2 style="font-size: 20px; font-weight: 800; letter-spacing: -0.03em; color: #0f0f0e; margin: 0 0 6px;">
          Your dataset is clean ✓
        </h2>
        <p style="font-size: 13px; color: #555550; margin: 0 0 24px; line-height: 1.6;">
          Here's a summary of what Oxdemi did to <strong style="color:#0f0f0e;">{payload.filename}</strong>.
        </p>

        <!-- Stats grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px;">
          {''.join([
            f'''<div style="background: #f5f5f3; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 14px 16px;">
              <div style="font-family: monospace; font-size: 22px; font-weight: 800; color: {vc}; letter-spacing: -0.03em;">{vv}</div>
              <div style="font-size: 11px; color: #8c8c86; margin-top: 4px;">{lbl}</div>
            </div>'''
            for vv, vc, lbl in [
              (f"{payload.clean_rows:,}", "#0f0f0e", "Clean rows"),
              (f"{score_pct:.0f}%",       score_color, "Avg quality score"),
              (f"{payload.actions}",       "#1a6bff",   "Actions taken"),
              (f"{rows_removed:,}" if rows_removed > 0 else "0", "#c0392b" if rows_removed > 0 else "#00875a", "Rows removed"),
            ]
          ])}
        </div>

        <!-- CTA -->
        <div style="text-align: center; margin-bottom: 8px;">
          <a href="https://eure-mlytics.vercel.app"
             style="display: inline-block; background: #0f0f0e; color: #fff; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none; letter-spacing: -0.01em;">
            View your report →
          </a>
        </div>
        <p style="font-size: 11px; color: #8c8c86; text-align: center; margin: 0;">
          Session ID: <span style="font-family: monospace;">{payload.session_id}</span>
        </p>
      </div>

      <!-- Footer -->
      <p style="font-size: 11px; color: #aaa; text-align: center; margin: 16px 0 0;">
        Oxdemi.io · Raw in. Clean out. · You're receiving this because you cleaned a file.
      </p>
    </div>
    """

    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.resend.com/emails",
            json={
                "from":    FEEDBACK_FROM,
                "to":      [payload.email],
                "subject": f"✓ Your dataset is clean — {payload.filename}",
                "html":    html,
            },
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type":  "application/json",
            },
        )

    return {"status": "sent"}
