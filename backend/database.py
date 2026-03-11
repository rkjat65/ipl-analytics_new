"""
DuckDB connection management.

DuckDB connections are NOT thread-safe, but FastAPI runs synchronous handlers
in a thread pool. We use thread-local storage so each OS thread gets its own
connection — safe, efficient, and no contention between concurrent requests.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path

import duckdb
from fastapi import HTTPException

# Resolve DB path relative to the project root (one level above this file)
_PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = os.environ.get("IPL_DB_PATH", str(_PROJECT_ROOT / "ipl.duckdb"))

# One connection per thread — eliminates all race conditions
_local = threading.local()


def get_connection() -> duckdb.DuckDBPyConnection:
    """Return (or lazily create) a per-thread read-only DuckDB connection."""
    if not hasattr(_local, "connection") or _local.connection is None:
        if not Path(DB_PATH).exists():
            raise RuntimeError(
                f"Database not found at {DB_PATH}. "
                "Run `python ingest.py` first to build the database."
            )
        _local.connection = duckdb.connect(DB_PATH, read_only=True)
    return _local.connection


def close_connection() -> None:
    """Close the current thread's connection (called on app shutdown)."""
    if hasattr(_local, "connection") and _local.connection is not None:
        try:
            _local.connection.close()
        except Exception:
            pass
        _local.connection = None


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db() -> duckdb.DuckDBPyConnection:
    """FastAPI dependency that yields a per-thread DB connection."""
    try:
        yield get_connection()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Tiny query helper
# ---------------------------------------------------------------------------

def query(con: duckdb.DuckDBPyConnection, sql: str, params: list | None = None):
    """Execute *sql* and return a list of dicts (JSON-serialisable)."""
    result = con.execute(sql, params or [])
    cols = [d[0] for d in result.description]
    return [dict(zip(cols, row)) for row in result.fetchall()]
