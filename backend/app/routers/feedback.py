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
