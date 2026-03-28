"""SQLite database for caching live cricket scores.

The poller writes here; the /api/live/* endpoints read from here.
This keeps user requests completely decoupled from the external API.
"""

import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone

_default_path = os.path.join(os.path.dirname(__file__), "data", "live_scores.db")
LIVE_DB_PATH = os.environ.get("LIVE_DB_PATH", _default_path)
_local = threading.local()


def get_live_db() -> sqlite3.Connection:
    """Return a thread-local SQLite connection for the live-scores database."""
    if not hasattr(_local, "live_conn") or _local.live_conn is None:
        os.makedirs(os.path.dirname(LIVE_DB_PATH), exist_ok=True)
        _local.live_conn = sqlite3.connect(LIVE_DB_PATH)
        _local.live_conn.row_factory = sqlite3.Row
    return _local.live_conn


def init_live_db():
    """Create live-score tables if they don't exist."""
    os.makedirs(os.path.dirname(LIVE_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(LIVE_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS live_matches (
            match_id     TEXT PRIMARY KEY,
            data         TEXT NOT NULL,
            is_ipl       INTEGER DEFAULT 0,
            match_status TEXT,
            updated_at   TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS live_scorecards (
            match_id     TEXT PRIMARY KEY,
            data         TEXT NOT NULL,
            updated_at   TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS poll_log (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            poll_type    TEXT,
            match_id     TEXT,
            status       TEXT,
            hits_used    INTEGER DEFAULT 1,
            error_msg    TEXT,
            created_at   TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    # Migration: add is_tracked column (NULL = auto, 1 = force on, 0 = force off)
    try:
        conn.execute("ALTER TABLE live_matches ADD COLUMN is_tracked INTEGER")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()


# ── helpers ──────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _match_status_label(m: dict) -> str:
    if m.get("matchStarted") and not m.get("matchEnded"):
        return "live"
    if m.get("matchEnded"):
        return "completed"
    return "upcoming"


# ── write operations (called by the poller) ──────────────────────────

def clear_matches():
    """Delete all rows from live_matches and live_scorecards."""
    conn = get_live_db()
    conn.execute("DELETE FROM live_matches")
    conn.execute("DELETE FROM live_scorecards")
    conn.commit()


def upsert_matches(matches: list[dict]):
    """Insert or update match rows from a poller fetch."""
    conn = get_live_db()
    now = _now_iso()
    for m in matches:
        mid = m.get("id", "")
        if not mid:
            continue
        conn.execute(
            """INSERT INTO live_matches (match_id, data, is_ipl, match_status, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(match_id) DO UPDATE SET
                 data         = excluded.data,
                 is_ipl       = excluded.is_ipl,
                 match_status = excluded.match_status,
                 updated_at   = excluded.updated_at""",
            (mid, json.dumps(m), int(bool(m.get("isIPL"))), _match_status_label(m), now),
        )
    conn.commit()


def upsert_scorecard(match_id: str, scorecard: dict):
    conn = get_live_db()
    now = _now_iso()
    conn.execute(
        """INSERT INTO live_scorecards (match_id, data, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(match_id) DO UPDATE SET
             data       = excluded.data,
             updated_at = excluded.updated_at""",
        (match_id, json.dumps(scorecard), now),
    )
    conn.commit()


def log_poll(
    poll_type: str,
    status: str,
    match_id: str | None = None,
    error_msg: str | None = None,
    hits: int = 1,
):
    conn = get_live_db()
    conn.execute(
        """INSERT INTO poll_log
           (poll_type, match_id, status, hits_used, error_msg, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (poll_type, match_id, status, hits, error_msg, _now_iso()),
    )
    conn.commit()


# ── read operations (called by API endpoints) ───────────────────────

def get_all_matches() -> list[dict]:
    """Return all cached matches sorted: IPL first → live → upcoming → completed."""
    conn = get_live_db()
    rows = conn.execute(
        """SELECT data FROM live_matches
           ORDER BY is_ipl DESC,
                    CASE match_status
                      WHEN 'live'      THEN 0
                      WHEN 'upcoming'  THEN 1
                      WHEN 'completed' THEN 2
                    END,
                    updated_at DESC"""
    ).fetchall()
    return [json.loads(r["data"]) for r in rows]


def get_live_ipl_match_ids() -> list[str]:
    """Return match IDs for IPL matches that are currently live."""
    conn = get_live_db()
    rows = conn.execute(
        "SELECT match_id FROM live_matches WHERE is_ipl = 1 AND match_status = 'live'"
    ).fetchall()
    return [r["match_id"] for r in rows]


def get_scorecard(match_id: str) -> dict | None:
    conn = get_live_db()
    row = conn.execute(
        "SELECT data FROM live_scorecards WHERE match_id = ?", (match_id,)
    ).fetchone()
    return json.loads(row["data"]) if row else None


def get_match(match_id: str) -> dict | None:
    conn = get_live_db()
    row = conn.execute(
        "SELECT data FROM live_matches WHERE match_id = ?", (match_id,)
    ).fetchone()
    return json.loads(row["data"]) if row else None


def get_today_api_hits() -> int:
    conn = get_live_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = conn.execute(
        "SELECT COALESCE(SUM(hits_used), 0) AS total "
        "FROM poll_log WHERE created_at >= ? AND status = 'success'",
        (today,),
    ).fetchone()
    return row["total"] if row else 0


def get_last_poll_time() -> str | None:
    conn = get_live_db()
    row = conn.execute(
        "SELECT created_at FROM poll_log WHERE status = 'success' "
        "ORDER BY id DESC LIMIT 1"
    ).fetchone()
    return row["created_at"] if row else None


# ── match tracking (admin controls which matches get scorecard-polled) ─

def get_tracked_match_ids() -> list[str]:
    """Return match IDs that should have their scorecards polled.

    Tracking logic (3-state):
      is_tracked = 1    → always tracked (admin pinned)
      is_tracked = NULL  → auto: IPL and (live or recently completed, for MOTM/final card)
      is_tracked = 0    → never tracked (admin disabled)
    """
    conn = get_live_db()
    rows = conn.execute(
        """SELECT match_id, is_tracked, is_ipl, match_status, updated_at
           FROM live_matches"""
    ).fetchall()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=18)
    out: list[str] = []
    seen: set[str] = set()

    for r in rows:
        mid = r["match_id"]
        tracked = r["is_tracked"]
        if tracked == 0:
            continue
        if tracked == 1:
            if mid not in seen:
                seen.add(mid)
                out.append(mid)
            continue
        if not r["is_ipl"]:
            continue
        st = r["match_status"]
        if st == "live":
            if mid not in seen:
                seen.add(mid)
                out.append(mid)
        elif st == "completed":
            raw_u = r["updated_at"] or ""
            try:
                u = datetime.fromisoformat(raw_u.replace("Z", "+00:00"))
            except ValueError:
                continue
            if u >= cutoff and mid not in seen:
                seen.add(mid)
                out.append(mid)
    return out


def set_match_tracking(match_id: str, tracked: bool | None):
    """Set tracking for a match. None resets to auto behaviour."""
    conn = get_live_db()
    val = None if tracked is None else (1 if tracked else 0)
    conn.execute(
        "UPDATE live_matches SET is_tracked = ? WHERE match_id = ?",
        (val, match_id),
    )
    conn.commit()


def get_setting(key: str, default: str | None = None) -> str | None:
    """Read a persisted setting by key."""
    conn = get_live_db()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str):
    """Write a persisted setting (upsert)."""
    conn = get_live_db()
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()


def get_matches_for_admin() -> list[dict]:
    """Return all matches with their tracking state for the admin UI."""
    conn = get_live_db()
    rows = conn.execute(
        """SELECT match_id, data, is_ipl, match_status, is_tracked, updated_at
           FROM live_matches
           ORDER BY is_ipl DESC,
                    CASE match_status
                      WHEN 'live'      THEN 0
                      WHEN 'upcoming'  THEN 1
                      WHEN 'completed' THEN 2
                    END,
                    updated_at DESC"""
    ).fetchall()
    result = []
    for r in rows:
        match_data = json.loads(r["data"])
        is_ipl = bool(r["is_ipl"])
        status = r["match_status"]
        raw_tracked = r["is_tracked"]

        if raw_tracked == 1:
            effective = True
        elif raw_tracked == 0:
            effective = False
        else:
            effective = is_ipl and status == "live"

        result.append({
            "matchId": r["match_id"],
            "name": match_data.get("name", ""),
            "series": match_data.get("series", ""),
            "status": match_data.get("status", ""),
            "matchStatus": status,
            "isIPL": is_ipl,
            "teams": match_data.get("teams", []),
            "teamInfo": match_data.get("teamInfo", []),
            "score": match_data.get("score", []),
            "trackingMode": "pinned" if raw_tracked == 1 else ("disabled" if raw_tracked == 0 else "auto"),
            "effectivelyTracked": effective,
            "updatedAt": r["updated_at"],
        })
    return result
