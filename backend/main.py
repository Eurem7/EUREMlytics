"""
main.py
=======
FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, clean, report, payments

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
)

app.include_router(upload.router)
app.include_router(clean.router)
app.include_router(report.router)
app.include_router(payments.router)

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
