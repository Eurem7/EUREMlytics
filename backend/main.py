"""
main.py
=======
FastAPI application entry point.
"""

import threading
import time
import urllib.request
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, clean, report, payments, feedback, workspace

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Oxdemi API",
    description="Raw in. Clean out. Upload messy data, get a clean dataset and quality report instantly.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://eure-mlytics.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(upload.router)
app.include_router(clean.router)
app.include_router(report.router)
app.include_router(payments.router)
app.include_router(feedback.router)
app.include_router(workspace.router)


# ─────────────────────────────────────────────────────────────
# Self keep-alive — pings /health every 4 minutes.
# Render free tier sleeps after 15min of inactivity.
# Self-pings don't count as "external" traffic on Render,
# so also set up UptimeRobot (free) to ping /health every 5min.
# Together these guarantee the server never sleeps.
# ─────────────────────────────────────────────────────────────

SELF_URL      = "https://euremlytics-2.onrender.com/health"
PING_INTERVAL = 4 * 60  # 4 minutes — well under the 15min sleep threshold


def _keep_alive_loop():
    # Wait 20s after startup before first ping so the server is ready
    time.sleep(20)
    while True:
        try:
            with urllib.request.urlopen(SELF_URL, timeout=10) as resp:
                logger.info(f"[keep-alive] ping ok — {resp.status}")
        except Exception as e:
            logger.warning(f"[keep-alive] ping failed — {e}")
        time.sleep(PING_INTERVAL)


_ka_thread = threading.Thread(target=_keep_alive_loop, daemon=True)
_ka_thread.start()


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/", tags=["meta"])
def root():
    return {
        "message": "Oxdemi API",
        "docs":    "/docs",
        "upload":  "POST /upload/",
        "clean":   "POST /clean/?session_id=<id>",
        "report":  "GET  /report/html?session_id=<id>",
    }
