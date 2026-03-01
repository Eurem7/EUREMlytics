"""
routers/upload.py
=================
Handles file uploads. Validates format, size, and readability,
then stores the raw DataFrame in the session store for downstream
/clean and /report endpoints to consume.
"""

import io
import hashlib
import pandas as pd

from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse

from app.session import session_store

router = APIRouter(prefix="/upload", tags=["upload"])

import re
import httpx

SHEETS_EXPORT_URL = "https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"

def _extract_sheet_id(url: str) -> tuple[str, str]:
    """
    Extract sheet ID and optional gid from a Google Sheets URL.
    Handles formats:
      https://docs.google.com/spreadsheets/d/{ID}/edit
      https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
      https://docs.google.com/spreadsheets/d/{ID}/pub
    Returns (sheet_id, gid) — gid defaults to "0"
    """
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Google Sheets URL. Make sure it contains /spreadsheets/d/{ID}.")
    sheet_id = match.group(1)
    gid_match = re.search(r"[#&?]gid=([0-9]+)", url)
    gid = gid_match.group(1) if gid_match else "0"
    return sheet_id, gid

MAX_FILE_SIZE_MB    = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS  = {".csv", ".xlsx", ".xls"}


def _read_file(contents: bytes, filename: str) -> pd.DataFrame:
    """
    Parse bytes into a DataFrame.

    CSV strategy:
      - Use the Python engine (not C) which correctly handles multiline
        quoted fields — e.g. FIFA club names stored as '\n\n\nFC Barcelona'
        inside double-quoted CSV cells. The C engine raises
        'EOF inside string' on these files.
      - Try UTF-8 → latin-1 → cp1252 encoding fallback chain.
      - Use on_bad_lines='warn' to skip unparseable rows rather than crash.
    """
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""

    if ext == ".csv":
        import csv as _csv

        def _detect_delimiter(raw: bytes, encoding: str) -> str:
            """
            Sniff the delimiter from the first 4KB of the file.
            Falls back to comma if sniffer fails.
            Candidate delimiters: , ; | \t
            """
            sample = raw[:4096].decode(encoding, errors="replace")
            try:
                dialect = _csv.Sniffer().sniff(sample, delimiters=",;|\t")
                return dialect.delimiter
            except _csv.Error:
                # Manual fallback: count occurrences per line
                first_line = sample.split("\n")[0]
                counts = {d: first_line.count(d) for d in [",", ";", "|", "\t"]}
                return max(counts, key=counts.get)

        for encoding in ("utf-8", "latin-1", "cp1252"):
            try:
                sep = _detect_delimiter(contents, encoding)
                return pd.read_csv(
                    io.BytesIO(contents),
                    encoding=encoding,
                    engine="python",         # handles multiline quoted strings
                    on_bad_lines="warn",     # warn but don't crash on bad rows
                    sep=sep,
                    quotechar='"',
                    skipinitialspace=True,
                )
            except UnicodeDecodeError:
                continue
            except Exception as e:
                # Last resort: skip bad lines entirely
                try:
                    sep = _detect_delimiter(contents, encoding)
                    return pd.read_csv(
                        io.BytesIO(contents),
                        encoding=encoding,
                        engine="python",
                        on_bad_lines="skip",
                        sep=sep,
                        skipinitialspace=True,
                    )
                except Exception:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not parse CSV: {e}",
                    )
        raise HTTPException(
            status_code=400,
            detail="Could not decode CSV — try saving as UTF-8.",
        )

    elif ext in (".xlsx", ".xls"):
        try:
            return pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Could not parse Excel file: {e}",
            )

    else:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )


@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a CSV or Excel file.
    Returns a session_id to use in subsequent /clean and /report calls.
    """
    filename = file.filename or "upload"
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    contents = await file.read()

    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents)/1024/1024:.1f} MB). Max is {MAX_FILE_SIZE_MB} MB.",
        )

    df = _read_file(contents, filename)

    if df.shape[0] == 0:
        raise HTTPException(status_code=400, detail="File has no data rows.")
    if df.shape[1] == 0:
        raise HTTPException(status_code=400, detail="File has no columns.")

    session_id = hashlib.sha256(contents).hexdigest()[:16]
    session_store.save(session_id, df)

    return JSONResponse(content={
        "session_id":   session_id,
        "filename":     filename,
        "rows":         df.shape[0],
        "columns":      df.shape[1],
        "column_names": list(df.columns),
        "size_kb":      round(len(contents) / 1024, 1),
        "message":      "File uploaded successfully.",
    })


@router.post("/sheets")
async def upload_from_sheets(request: Request):
    """
    Pull data directly from a public Google Sheets URL.
    The sheet must be set to "Anyone with the link can view".
    """
    body = await request.json()
    url  = (body.get("url") or "").strip()

    if not url:
        raise HTTPException(status_code=400, detail="Google Sheets URL is required.")

    if "docs.google.com/spreadsheets" not in url:
        raise HTTPException(status_code=400, detail="Not a valid Google Sheets URL.")

    sheet_id, gid = _extract_sheet_id(url)
    export_url = SHEETS_EXPORT_URL.format(sheet_id=sheet_id, gid=gid)

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            res = await client.get(export_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not reach Google Sheets: {e}")

    if res.status_code == 401 or res.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail="This sheet is private. Set sharing to \'Anyone with the link can view\' and try again."
        )
    if res.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Google Sheets returned status {res.status_code}. Make sure the sheet is publicly shared.")

    contents = res.content
    filename = f"sheets_{sheet_id[:8]}.csv"

    try:
        df = _read_file(contents, filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse sheet data: {e}")

    if df.shape[0] == 0:
        raise HTTPException(status_code=400, detail="Sheet appears to be empty.")
    if df.shape[1] == 0:
        raise HTTPException(status_code=400, detail="Sheet has no columns.")

    import hashlib
    session_id = hashlib.sha256(contents).hexdigest()[:16]
    session_store.save(session_id, df)

    return JSONResponse(content={
        "session_id":   session_id,
        "filename":     filename,
        "rows":         df.shape[0],
        "columns":      df.shape[1],
        "column_names": list(df.columns),
        "size_kb":      round(len(contents) / 1024, 1),
        "message":      "Sheet imported successfully.",
        "source":       "google_sheets",
    })
