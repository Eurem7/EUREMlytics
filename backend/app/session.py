"""
session.py
==========
Simple in-memory session store that maps session_id → (DataFrame, engine result).

For the free tier this is sufficient. For production multi-worker deployments,
swap the dict for Redis or a database-backed store.

Entries expire after SESSION_TTL_SECONDS to prevent unbounded memory growth.
"""

import time
import threading
import pandas as pd
from typing import Optional

# ── Config ──
SESSION_TTL_SECONDS = 60 * 60  # 1 hour
MAX_SESSIONS = 200              # evict oldest when limit reached


class SessionStore:
    """Thread-safe in-memory store for uploaded DataFrames and engine results."""

    def __init__(self):
        self._lock   = threading.Lock()
        self._frames: dict[str, dict] = {}   # session_id → {df, result, ts}

    # ──────────────────────────────────────
    # DataFrame storage (set on upload)
    # ──────────────────────────────────────

    def save(self, session_id: str, df: pd.DataFrame) -> None:
        """Store a raw DataFrame under session_id."""
        with self._lock:
            self._evict_expired()
            if len(self._frames) >= MAX_SESSIONS:
                self._evict_oldest()
            self._frames[session_id] = {
                "df":     df,
                "result": None,
                "ts":     time.time(),
            }

    def get_df(self, session_id: str) -> Optional[pd.DataFrame]:
        """Retrieve the raw DataFrame. Returns None if not found or expired."""
        with self._lock:
            entry = self._frames.get(session_id)
            if not entry:
                return None
            if time.time() - entry["ts"] > SESSION_TTL_SECONDS:
                del self._frames[session_id]
                return None
            return entry["df"]

    # ──────────────────────────────────────
    # Engine result cache (set on /clean)
    # ──────────────────────────────────────

    def save_result(self, session_id: str, result: dict) -> None:
        """Cache the engine result so /report doesn't re-run the pipeline."""
        with self._lock:
            entry = self._frames.get(session_id)
            if entry:
                entry["result"] = result
                entry["ts"]     = time.time()  # refresh TTL

    def get_result(self, session_id: str) -> Optional[dict]:
        """Retrieve a cached engine result. Returns None if not found."""
        with self._lock:
            entry = self._frames.get(session_id)
            if not entry:
                return None
            return entry.get("result")

    # ──────────────────────────────────────
    # Eviction
    # ──────────────────────────────────────

    def _evict_expired(self) -> None:
        """Remove entries older than SESSION_TTL_SECONDS. Call while holding lock."""
        now = time.time()
        expired = [sid for sid, e in self._frames.items()
                   if now - e["ts"] > SESSION_TTL_SECONDS]
        for sid in expired:
            del self._frames[sid]

    def _evict_oldest(self) -> None:
        """Remove the oldest entry. Call while holding lock."""
        if not self._frames:
            return
        oldest = min(self._frames, key=lambda sid: self._frames[sid]["ts"])
        del self._frames[oldest]

    def __len__(self) -> int:
        with self._lock:
            return len(self._frames)


# Singleton — imported by all routers
session_store = SessionStore()