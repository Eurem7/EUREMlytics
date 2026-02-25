"""
main.py
=======
FastAPI application entry point.

Run with:
    uvicorn main:app --reload

Endpoints:
    POST /upload/          → Upload CSV/Excel, get session_id
    POST /clean/           → Run engine, get JSON result
    GET  /report/html      → HTML quality report
    GET  /report/csv       → Download cleaned CSV
    GET  /report/pdf       → Download PDF report
    GET  /health           → Health check
    GET  /docs             → Auto-generated Swagger UI
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, clean, report

# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

app = FastAPI(
    title="DataQuality API",
    description="Upload messy data, get a clean dataset and a quality report.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────

app.include_router(upload.router)
app.include_router(clean.router)
app.include_router(report.router)

# ─────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────

@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/", tags=["meta"])
def root():
    return {
        "message": "DataQuality API",
        "docs":    "/docs",
        "upload":  "POST /upload/",
        "clean":   "POST /clean/?session_id=<id>",
        "report":  "GET  /report/html?session_id=<id>",
    }