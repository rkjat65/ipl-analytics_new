"""Live cricket scores — served from the local SQLite cache.

The background poller (live_poller.py) writes data into the cache DB.
These endpoints only read from SQLite, so they are fast and never hit
the external cricket API on behalf of a user request.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..cricket_api import get_cricket_api
from ..ipl_schedule import compute_schedule_with_status
from ..live_db import (
    get_all_matches,
    get_last_poll_time,
    get_match,
    get_matches_for_admin,
    get_scorecard,
    get_today_api_hits,
    set_match_tracking,
)
from ..live_poller import (
    pause_poller,
    poller_state,
    refresh_match_list,
    resume_poller,
    set_poll_interval,
    trigger_force_poll,
)
from .auth import get_current_user, _is_admin

router = APIRouter(prefix="/api/live", tags=["live"])


def _require_admin(authorization: Optional[str]) -> dict:
    """Validate token and ensure the caller is the platform admin."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if not _is_admin(user):
        raise HTTPException(403, "Admin access only")
    return user


@router.get("/status")
def live_status():
    """Check whether live scores are available."""
    api = get_cricket_api()
    return {
        "available": api.is_configured(),
        "poller": poller_state.to_dict(),
    }


@router.get("/matches")
def live_matches():
    """Return cached match list from the DB (updated by the poller)."""
    matches = get_all_matches()
    return {"matches": matches}


@router.get("/scorecard/{match_id}")
def live_scorecard(match_id: str):
    """Return a cached scorecard for *match_id*."""
    sc = get_scorecard(match_id)
    if sc is None:
        match = get_match(match_id)
        if match is None:
            raise HTTPException(404, "Match not found")
        return match
    return sc


@router.get("/info/{match_id}")
def live_match_info(match_id: str):
    """Lightweight match info — falls back to the cached match row."""
    match = get_match(match_id)
    if match is None:
        raise HTTPException(404, "Match not found")
    return match


@router.get("/schedule")
def ipl_schedule():
    """Return IPL 2026 league-stage schedule with computed status."""
    return compute_schedule_with_status()


@router.get("/poller-status")
def poller_status():
    """Debugging endpoint — shows the current state of the background poller."""
    return {
        **poller_state.to_dict(),
        "lastPollAt": get_last_poll_time(),
        "apiHitsToday": get_today_api_hits(),
    }


# ── Admin controls ───────────────────────────────────────────────────

@router.get("/admin/config")
def admin_poller_config(authorization: Optional[str] = Header(None)):
    """Get the full poller configuration. Admin only."""
    _require_admin(authorization)
    return {
        **poller_state.to_dict(),
        "lastPollAt": get_last_poll_time(),
        "apiHitsToday": get_today_api_hits(),
    }


@router.post("/admin/start")
def admin_start_poller(authorization: Optional[str] = Header(None)):
    """Resume the poller. Admin only."""
    _require_admin(authorization)
    resume_poller()
    return {"detail": "Poller resumed", **poller_state.to_dict()}


@router.post("/admin/stop")
def admin_stop_poller(authorization: Optional[str] = Header(None)):
    """Pause the poller. Admin only."""
    _require_admin(authorization)
    pause_poller()
    return {"detail": "Poller paused", **poller_state.to_dict()}


class IntervalRequest(BaseModel):
    interval_ms: int


@router.post("/admin/interval")
def admin_set_interval(
    body: IntervalRequest,
    authorization: Optional[str] = Header(None),
):
    """Change the polling interval (in milliseconds). Admin only.

    Clamped to [5 000 ms, 900 000 ms].
    """
    _require_admin(authorization)
    actual = set_poll_interval(body.interval_ms)
    return {"detail": f"Interval set to {actual} ms", "pollIntervalMs": actual}


@router.post("/admin/force-poll")
def admin_force_poll(authorization: Optional[str] = Header(None)):
    """Trigger one poll cycle immediately (ignores window & pause). Admin only."""
    _require_admin(authorization)
    trigger_force_poll()
    return {"detail": "Force poll triggered — cycle will run momentarily"}


@router.post("/admin/refresh-matches")
async def admin_refresh_matches(authorization: Optional[str] = Header(None)):
    """Fetch the match list from the external API (1 API hit) and cache it.

    Admin calls this to populate the match list, then selects which
    matches to track.  This is NOT part of the regular poll loop.
    """
    _require_admin(authorization)
    try:
        count = await refresh_match_list()
    except Exception as exc:
        raise HTTPException(502, f"External API error: {exc}")
    return {"detail": f"Match list refreshed — {count} matches cached", "matchCount": count}


@router.get("/admin/matches")
def admin_list_matches(authorization: Optional[str] = Header(None)):
    """List all cached matches with their tracking status + upcoming schedule. Admin only."""
    _require_admin(authorization)
    schedule = compute_schedule_with_status()
    upcoming = [
        {
            "match": m["match"],
            "home": m["home"],
            "away": m["away"],
            "venue": m["venue"],
            "date": m["date"],
            "time": m["time"],
            "dateTimeGMT": m["dateTimeGMT"],
            "status": m["status"],
        }
        for m in schedule.get("matches", [])
        if m["status"] in ("upcoming", "live")
    ]
    return {"matches": get_matches_for_admin(), "upcoming": upcoming}


class TrackRequest(BaseModel):
    match_id: str
    tracked: bool | None = None  # True = force on, False = force off, None = auto


@router.post("/admin/matches/track")
def admin_track_match(
    body: TrackRequest,
    authorization: Optional[str] = Header(None),
):
    """Set scorecard tracking for a match. Admin only.

    tracked=true  → always poll scorecard (pinned)
    tracked=false → never poll scorecard (disabled)
    tracked=null  → auto (poll if IPL & live)
    """
    _require_admin(authorization)
    set_match_tracking(body.match_id, body.tracked)
    label = "pinned" if body.tracked is True else ("disabled" if body.tracked is False else "auto")
    return {"detail": f"Match {body.match_id} tracking set to {label}"}
