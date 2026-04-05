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

# All IPL franchise names (current + historical) for team-name-based detection
_IPL_TEAMS: frozenset[str] = frozenset({
    "Chennai Super Kings", "Mumbai Indians",
    "Royal Challengers Bangalore", "Royal Challengers Bengaluru",
    "Kolkata Knight Riders", "Delhi Capitals", "Delhi Daredevils",
    "Punjab Kings", "Kings XI Punjab",
    "Rajasthan Royals", "Sunrisers Hyderabad",
    "Gujarat Titans", "Lucknow Super Giants",
    "Rising Pune Supergiants", "Rising Pune Supergiant",
    "Pune Warriors India", "Pune Warriors",
    "Deccan Chargers", "Kochi Tuskers Kerala",
})
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS live_balls (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id        TEXT NOT NULL,
            ball_id         INTEGER NOT NULL,
            innings         INTEGER NOT NULL,
            scoreboard      TEXT NOT NULL,
            over_num        INTEGER NOT NULL,
            ball_in_over    INTEGER NOT NULL,
            ball_decimal    REAL NOT NULL,
            batter          TEXT,
            bowler          TEXT,
            non_striker     TEXT,
            runs_batter     INTEGER DEFAULT 0,
            runs_extras     INTEGER DEFAULT 0,
            runs_total      INTEGER DEFAULT 0,
            extra_type      TEXT,
            extra_runs      INTEGER DEFAULT 0,
            is_wicket       INTEGER DEFAULT 0,
            wicket_kind     TEXT,
            player_out      TEXT,
            fielder         TEXT,
            team_score      INTEGER,
            team_wickets    INTEGER,
            team_id         INTEGER,
            batting_team    TEXT,
            raw_data        TEXT,
            created_at      TEXT NOT NULL,
            UNIQUE(match_id, ball_id)
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_live_balls_match
        ON live_balls(match_id, scoreboard, ball_decimal)
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ball_sync_state (
            match_id        TEXT PRIMARY KEY,
            is_synced       INTEGER DEFAULT 0,
            last_ball_id    INTEGER,
            last_ball_count INTEGER DEFAULT 0,
            synced_at       TEXT,
            sync_mode       TEXT DEFAULT 'manual'
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


def _detect_ipl(m: dict) -> bool:
    """Return True if match is an IPL match — by flag OR by team names."""
    if m.get("isIPL"):
        return True
    teams = set(m.get("teams") or [])
    return len(teams & _IPL_TEAMS) == 2


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
    """Insert or update match rows from a poller fetch.

    Also marks previously-live matches that no longer appear in the
    livescores response as "completed" so they stop wasting API hits.
    """
    conn = get_live_db()
    now = _now_iso()
    seen_ids: set[str] = set()
    for m in matches:
        mid = m.get("id", "")
        if not mid:
            continue
        seen_ids.add(str(mid))
        conn.execute(
            """INSERT INTO live_matches (match_id, data, is_ipl, match_status, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(match_id) DO UPDATE SET
                 data         = excluded.data,
                 is_ipl       = excluded.is_ipl,
                 match_status = excluded.match_status,
                 updated_at   = excluded.updated_at""",
            (str(mid), json.dumps(m), int(_detect_ipl(m)), _match_status_label(m), now),
        )

    if seen_ids:
        stale = conn.execute(
            "SELECT match_id FROM live_matches WHERE match_status = 'live'"
        ).fetchall()
        for row in stale:
            if row["match_id"] not in seen_ids:
                conn.execute(
                    "UPDATE live_matches SET match_status = 'completed' WHERE match_id = ?",
                    (row["match_id"],),
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


def _schedule_dates_close(schedule_date: str, api_date_prefix: str) -> bool:
    """True if API date string (YYYY-MM-DD…) matches schedule day or adjacent (IST vs UTC)."""
    if not api_date_prefix or len(api_date_prefix) < 10:
        return False
    api_d = api_date_prefix[:10]
    if api_d == schedule_date:
        return True
    try:
        from datetime import datetime, timedelta

        s = datetime.strptime(schedule_date, "%Y-%m-%d").date()
        a = datetime.strptime(api_d, "%Y-%m-%d").date()
        return abs((s - a).days) <= 1
    except ValueError:
        return False


def find_scorecard_for_schedule_fixture(
    date_str: str, home: str, away: str,
) -> tuple[str | None, dict | None]:
    """Find cached scorecard by normalized team names + date (for schedule RESULT / REPORT)."""
    from .database import normalize_team

    want = {normalize_team(home), normalize_team(away)}
    conn = get_live_db()
    rows = conn.execute("SELECT match_id, data FROM live_scorecards").fetchall()
    for r in rows:
        sc = json.loads(r["data"])
        teams = sc.get("teams") or []
        if len(teams) < 2:
            continue
        got = {normalize_team(teams[0]), normalize_team(teams[1])}
        if got != want:
            continue
        api_date = (sc.get("dateTimeGMT") or sc.get("date") or "")[:10]
        if _schedule_dates_close(date_str, api_date):
            return (r["match_id"], sc)
    return (None, None)


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


# ── ball-by-ball operations ───────────────────────────────────

def upsert_balls(match_id: str, balls: list[dict]) -> int:
    """Insert or ignore ball rows. Returns number of new rows inserted."""
    conn = get_live_db()
    now = _now_iso()
    inserted = 0
    for b in balls:
        try:
            # Content-based deduplication: skip if ID differs but scoreboard, decimal, and runs match
            # This handles cases where the provider rotates IDs for the same match events.
            # We allow multiple entries at the same decimal ONLY if they have different extra_types (e.g. wide vs legal)
            existing = conn.execute(
                "SELECT ball_id FROM live_balls WHERE match_id=? AND scoreboard=? AND ball_decimal=? AND extra_type IS ? AND runs_total=?",
                (match_id, b["scoreboard"], b["ball_decimal"], b["extra_type"], b.get("runs_total", 0))
            ).fetchall()
            if existing:
                if any(row[0] != b["ball_id"] for row in existing):
                    continue

            conn.execute(
                """INSERT OR IGNORE INTO live_balls
                   (match_id, ball_id, innings, scoreboard, over_num, ball_in_over,
                    ball_decimal, batter, bowler, non_striker,
                    runs_batter, runs_extras, runs_total,
                    extra_type, extra_runs, is_wicket, wicket_kind,
                    player_out, fielder, team_score, team_wickets,
                    team_id, batting_team, raw_data, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    match_id, b["ball_id"], b["innings"], b["scoreboard"],
                    b["over_num"], b["ball_in_over"], b["ball_decimal"],
                    b.get("batter"), b.get("bowler"), b.get("non_striker"),
                    b.get("runs_batter", 0), b.get("runs_extras", 0), b.get("runs_total", 0),
                    b.get("extra_type"), b.get("extra_runs", 0),
                    int(bool(b.get("is_wicket"))), b.get("wicket_kind"),
                    b.get("player_out"), b.get("fielder"),
                    b.get("team_score"), b.get("team_wickets"),
                    b.get("team_id"), b.get("batting_team"),
                    b.get("raw_data"), now,
                ),
            )
            inserted += 1 # approximate if it didn't exist
        except Exception:
            pass
    conn.commit()
    return inserted


def upsert_ball_sync_state(
    match_id: str, *, is_synced: int = 1, last_ball_id: int | None = None,
    ball_count: int = 0, mode: str = "manual",
):
    conn = get_live_db()
    conn.execute(
        """INSERT INTO ball_sync_state
           (match_id, is_synced, last_ball_id, last_ball_count, synced_at, sync_mode)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(match_id) DO UPDATE SET
             is_synced       = excluded.is_synced,
             last_ball_id    = excluded.last_ball_id,
             last_ball_count = excluded.last_ball_count,
             synced_at       = excluded.synced_at,
             sync_mode       = excluded.sync_mode""",
        (match_id, is_synced, last_ball_id, ball_count, _now_iso(), mode),
    )
    conn.commit()


def get_ball_sync_state(match_id: str) -> dict | None:
    conn = get_live_db()
    row = conn.execute(
        "SELECT * FROM ball_sync_state WHERE match_id = ?", (match_id,)
    ).fetchone()
    if not row:
        return None
    return dict(row)


def get_synced_match_ids() -> list[str]:
    """Return match IDs that have ball sync enabled."""
    conn = get_live_db()
    rows = conn.execute(
        "SELECT match_id FROM ball_sync_state WHERE is_synced = 1"
    ).fetchall()
    return [r["match_id"] for r in rows]


def delete_balls_for_match(match_id: str) -> int:
    """Delete all stored balls for a match so the poller re-fetches them."""
    conn = get_live_db()
    cur = conn.execute("DELETE FROM live_balls WHERE match_id = ?", (match_id,))
    conn.execute("DELETE FROM ball_sync_state WHERE match_id = ?", (match_id,))
    conn.commit()
    return cur.rowcount


def get_balls_for_match(match_id: str) -> list[dict]:
    """Return all balls for a match ordered by scoreboard and ball position.

    NOTE: Sportmonks stores a wide and the subsequent legal delivery at the same
    ball_decimal position (e.g., wide at 1.4 and the next ball also 1.4).
    Do NOT deduplicate by ball_decimal — that would drop valid wide/noball events.
    True duplicates (same ball_id) are already prevented by UNIQUE(match_id, ball_id).
    """
    conn = get_live_db()
    rows = conn.execute(
        """SELECT * FROM live_balls
           WHERE match_id = ?
           ORDER BY scoreboard, ball_decimal, ball_id""",
        (match_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_ball_count(match_id: str) -> int:
    conn = get_live_db()
    row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM live_balls WHERE match_id = ?", (match_id,)
    ).fetchone()
    return row["cnt"] if row else 0


def get_max_ball_id(match_id: str) -> int | None:
    conn = get_live_db()
    row = conn.execute(
        "SELECT MAX(ball_id) AS mx FROM live_balls WHERE match_id = ?", (match_id,)
    ).fetchone()
    return row["mx"] if row else None


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

        bs = get_ball_sync_state(r["match_id"])
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
            "ballSync": {
                "synced": bool(bs and bs["is_synced"]),
                "ballCount": bs["last_ball_count"] if bs else 0,
                "lastSyncedAt": bs["synced_at"] if bs else None,
            } if bs else None,
        })
    return result
