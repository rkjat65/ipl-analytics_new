"""Live cricket scores via CricAPI (cricapi.com) with in-memory caching."""

import os
import time
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/live", tags=["live"])

# ── Config ──────────────────────────────────────────────────────
CRICAPI_KEY = os.getenv("CRICAPI_KEY", "")
CRICAPI_BASE = "https://api.cricapi.com/v1"

# ── In-memory TTL cache ─────────────────────────────────────────
_cache: dict[str, tuple[float, object]] = {}
CACHE_TTL_MATCHES = 900      # list of matches: 15 min (100 hits/day limit)
CACHE_TTL_SCORECARD = 900    # individual scorecard: 15 min


def _get_cached(key: str, ttl: int):
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < ttl:
        return entry[1]
    return None


def _set_cache(key: str, value: object):
    _cache[key] = (time.time(), value)


def _api_available():
    return bool(CRICAPI_KEY)


async def _fetch(endpoint: str, params: dict | None = None):
    """Call CricAPI with API key."""
    if not _api_available():
        raise HTTPException(503, "CricAPI key not configured. Set CRICAPI_KEY in .env")
    p = {"apikey": CRICAPI_KEY}
    if params:
        p.update(params)
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{CRICAPI_BASE}/{endpoint}", params=p)
        if r.status_code != 200:
            raise HTTPException(502, f"CricAPI returned {r.status_code}")
        data = r.json()
        if data.get("status") != "success":
            raise HTTPException(502, data.get("reason", "CricAPI request failed"))
        return data


def _match_state(ms: str):
    """Convert CricAPI 'ms' field to matchStarted/matchEnded."""
    ms = (ms or "").lower()
    if ms == "result":
        return True, True
    if ms == "live":
        return True, False
    # fixture, default
    return False, False


# ── Endpoints ───────────────────────────────────────────────────

@router.get("/status")
def live_status():
    """Check if live scores API is configured."""
    return {"available": _api_available()}


@router.get("/matches")
async def live_matches():
    """Get current / recent / upcoming cricket matches."""
    cached = _get_cached("matches", CACHE_TTL_MATCHES)
    if cached is not None:
        return cached

    data = await _fetch("cricScore")
    matches_raw = data.get("data", [])

    matches = []
    for m in matches_raw:
        series = (m.get("series", "") or "").lower()
        t1 = m.get("t1", "")
        t2 = m.get("t2", "")
        is_ipl = "ipl" in series or "indian premier league" in series
        started, ended = _match_state(m.get("ms", ""))

        match_info = {
            "id": m.get("id", ""),
            "name": f"{t1} vs {t2}",
            "status": m.get("status", ""),
            "dateTimeGMT": m.get("dateTimeGMT", ""),
            "matchType": m.get("matchType", ""),
            "series": m.get("series", ""),
            "teams": [t1, t2],
            "teamInfo": [
                {"name": t1, "img": m.get("t1img", "")},
                {"name": t2, "img": m.get("t2img", "")},
            ],
            "score": [],
            "matchStarted": started,
            "matchEnded": ended,
            "isIPL": is_ipl,
        }

        # Build score entries from t1s / t2s
        t1s = m.get("t1s", "")
        t2s = m.get("t2s", "")
        if t1s:
            match_info["score"].append({"inning": t1, "score": t1s})
        if t2s:
            match_info["score"].append({"inning": t2, "score": t2s})

        matches.append(match_info)

    # Sort: IPL first, then live, then upcoming, then completed
    matches.sort(key=lambda x: (
        0 if x.get("isIPL") else 1,
        0 if x.get("matchStarted") and not x.get("matchEnded") else 1,
        0 if not x.get("matchStarted") else 1,
    ))

    result = {"matches": matches}
    _set_cache("matches", result)
    return result


@router.get("/scorecard/{match_id}")
async def live_scorecard(match_id: str):
    """Get detailed scorecard for a specific match."""
    cache_key = f"scorecard:{match_id}"
    cached = _get_cached(cache_key, CACHE_TTL_SCORECARD)
    if cached is not None:
        return cached

    data = await _fetch("match_scorecard", {"id": match_id})
    match_data = data.get("data", {})

    result = {
        "id": match_data.get("id", match_id),
        "name": match_data.get("name", ""),
        "status": match_data.get("status", ""),
        "venue": match_data.get("venue", ""),
        "date": match_data.get("date", ""),
        "dateTimeGMT": match_data.get("dateTimeGMT", ""),
        "teams": match_data.get("teams", []),
        "teamInfo": match_data.get("teamInfo", []),
        "score": match_data.get("score", []),
        "tossWinner": match_data.get("tossWinner", ""),
        "tossChoice": match_data.get("tossChoice", ""),
        "matchWinner": match_data.get("matchWinner", ""),
        "scorecard": match_data.get("scorecard", []),
        "matchStarted": match_data.get("matchStarted", False),
        "matchEnded": match_data.get("matchEnded", False),
    }
    _set_cache(cache_key, result)
    return result


@router.get("/info/{match_id}")
async def live_match_info(match_id: str):
    """Get match info (lighter than scorecard — for polling)."""
    cache_key = f"info:{match_id}"
    cached = _get_cached(cache_key, CACHE_TTL_SCORECARD)
    if cached is not None:
        return cached

    data = await _fetch("match_info", {"id": match_id})
    match_data = data.get("data", {})

    result = {
        "id": match_data.get("id", match_id),
        "name": match_data.get("name", ""),
        "status": match_data.get("status", ""),
        "venue": match_data.get("venue", ""),
        "teams": match_data.get("teams", []),
        "teamInfo": match_data.get("teamInfo", []),
        "score": match_data.get("score", []),
        "tossWinner": match_data.get("tossWinner", ""),
        "tossChoice": match_data.get("tossChoice", ""),
        "matchWinner": match_data.get("matchWinner", ""),
        "matchStarted": match_data.get("matchStarted", False),
        "matchEnded": match_data.get("matchEnded", False),
    }
    _set_cache(cache_key, result)
    return result
