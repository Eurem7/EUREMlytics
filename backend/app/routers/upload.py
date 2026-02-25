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

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from app.session import session_store

router = APIRouter(prefix="/upload", tags=["upload"])

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
        for encoding in ("utf-8", "latin-1", "cp1252"):
            try:
                return pd.read_csv(
                    io.BytesIO(contents),
                    encoding=encoding,
                    engine="python",         # handles multiline quoted strings
                    on_bad_lines="warn",     # warn but don't crash on bad rows
                    quotechar='"',
                    skipinitialspace=True,
                )
            except UnicodeDecodeError:
                continue
            except Exception as e:
                # Last resort: skip bad lines entirely
                try:
                    return pd.read_csv(
                        io.BytesIO(contents),
                        encoding=encoding,
                        engine="python",
                        on_bad_lines="skip",
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