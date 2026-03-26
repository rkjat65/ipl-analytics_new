"""Live cricket scores via CricAPI (cricapi.com) with in-memory caching."""

import os
import time
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/live", tags=["live"])

# ── Config ──────────────────────────────────────────────────────
CRICAPI_BASE = "https://api.cricapi.com/v1"


def _get_key():
    return os.getenv("CRICAPI_KEY", "")

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
    return bool(_get_key())


async def _fetch(endpoint: str, params: dict | None = None):
    """Call CricAPI with API key."""
    key = _get_key()
    if not key:
        raise HTTPException(503, "CricAPI key not configured. Set CRICAPI_KEY in .env")
    p = {"apikey": key}
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


# ── IPL 2026 Schedule ────────────────────────────────────────────
IPL_2026_SCHEDULE = [
    {"match": 1,  "date": "2026-03-28", "time": "19:30", "home": "Royal Challengers Bengaluru", "away": "Sunrisers Hyderabad", "venue": "Bengaluru"},
    {"match": 2,  "date": "2026-03-29", "time": "19:30", "home": "Mumbai Indians", "away": "Kolkata Knight Riders", "venue": "Mumbai"},
    {"match": 3,  "date": "2026-03-30", "time": "19:30", "home": "Rajasthan Royals", "away": "Chennai Super Kings", "venue": "Guwahati"},
    {"match": 4,  "date": "2026-03-31", "time": "19:30", "home": "Punjab Kings", "away": "Gujarat Titans", "venue": "New Chandigarh"},
    {"match": 5,  "date": "2026-04-01", "time": "19:30", "home": "Lucknow Super Giants", "away": "Delhi Capitals", "venue": "Lucknow"},
    {"match": 6,  "date": "2026-04-02", "time": "19:30", "home": "Kolkata Knight Riders", "away": "Sunrisers Hyderabad", "venue": "Kolkata"},
    {"match": 7,  "date": "2026-04-03", "time": "19:30", "home": "Chennai Super Kings", "away": "Punjab Kings", "venue": "Chennai"},
    {"match": 8,  "date": "2026-04-04", "time": "15:30", "home": "Delhi Capitals", "away": "Mumbai Indians", "venue": "Delhi"},
    {"match": 9,  "date": "2026-04-04", "time": "19:30", "home": "Gujarat Titans", "away": "Rajasthan Royals", "venue": "Ahmedabad"},
    {"match": 10, "date": "2026-04-05", "time": "15:30", "home": "Sunrisers Hyderabad", "away": "Lucknow Super Giants", "venue": "Hyderabad"},
    {"match": 11, "date": "2026-04-05", "time": "19:30", "home": "Royal Challengers Bengaluru", "away": "Chennai Super Kings", "venue": "Bengaluru"},
    {"match": 12, "date": "2026-04-06", "time": "19:30", "home": "Kolkata Knight Riders", "away": "Punjab Kings", "venue": "Kolkata"},
    {"match": 13, "date": "2026-04-07", "time": "19:30", "home": "Rajasthan Royals", "away": "Mumbai Indians", "venue": "Guwahati"},
    {"match": 14, "date": "2026-04-08", "time": "19:30", "home": "Delhi Capitals", "away": "Gujarat Titans", "venue": "Delhi"},
    {"match": 15, "date": "2026-04-09", "time": "19:30", "home": "Kolkata Knight Riders", "away": "Lucknow Super Giants", "venue": "Kolkata"},
    {"match": 16, "date": "2026-04-10", "time": "19:30", "home": "Rajasthan Royals", "away": "Royal Challengers Bengaluru", "venue": "Guwahati"},
    {"match": 17, "date": "2026-04-11", "time": "15:30", "home": "Punjab Kings", "away": "Sunrisers Hyderabad", "venue": "New Chandigarh"},
    {"match": 18, "date": "2026-04-11", "time": "19:30", "home": "Chennai Super Kings", "away": "Delhi Capitals", "venue": "Chennai"},
    {"match": 19, "date": "2026-04-12", "time": "15:30", "home": "Lucknow Super Giants", "away": "Gujarat Titans", "venue": "Lucknow"},
    {"match": 20, "date": "2026-04-12", "time": "19:30", "home": "Mumbai Indians", "away": "Royal Challengers Bengaluru", "venue": "Mumbai"},
    {"match": 21, "date": "2026-04-13", "time": "19:30", "home": "Sunrisers Hyderabad", "away": "Rajasthan Royals", "venue": "Hyderabad"},
    {"match": 22, "date": "2026-04-14", "time": "19:30", "home": "Chennai Super Kings", "away": "Kolkata Knight Riders", "venue": "Chennai"},
    {"match": 23, "date": "2026-04-15", "time": "19:30", "home": "Royal Challengers Bengaluru", "away": "Lucknow Super Giants", "venue": "Bengaluru"},
    {"match": 24, "date": "2026-04-16", "time": "19:30", "home": "Mumbai Indians", "away": "Punjab Kings", "venue": "Mumbai"},
    {"match": 25, "date": "2026-04-17", "time": "19:30", "home": "Gujarat Titans", "away": "Kolkata Knight Riders", "venue": "Ahmedabad"},
    {"match": 26, "date": "2026-04-18", "time": "15:30", "home": "Royal Challengers Bengaluru", "away": "Delhi Capitals", "venue": "Bengaluru"},
    {"match": 27, "date": "2026-04-18", "time": "19:30", "home": "Sunrisers Hyderabad", "away": "Chennai Super Kings", "venue": "Hyderabad"},
    {"match": 28, "date": "2026-04-19", "time": "15:30", "home": "Kolkata Knight Riders", "away": "Rajasthan Royals", "venue": "Kolkata"},
    {"match": 29, "date": "2026-04-19", "time": "19:30", "home": "Punjab Kings", "away": "Lucknow Super Giants", "venue": "New Chandigarh"},
    {"match": 30, "date": "2026-04-20", "time": "19:30", "home": "Gujarat Titans", "away": "Mumbai Indians", "venue": "Ahmedabad"},
    {"match": 31, "date": "2026-04-21", "time": "19:30", "home": "Sunrisers Hyderabad", "away": "Delhi Capitals", "venue": "Hyderabad"},
    {"match": 32, "date": "2026-04-22", "time": "19:30", "home": "Lucknow Super Giants", "away": "Rajasthan Royals", "venue": "Lucknow"},
    {"match": 33, "date": "2026-04-23", "time": "19:30", "home": "Mumbai Indians", "away": "Chennai Super Kings", "venue": "Mumbai"},
    {"match": 34, "date": "2026-04-24", "time": "19:30", "home": "Royal Challengers Bengaluru", "away": "Gujarat Titans", "venue": "Bengaluru"},
    {"match": 35, "date": "2026-04-25", "time": "15:30", "home": "Delhi Capitals", "away": "Punjab Kings", "venue": "Delhi"},
    {"match": 36, "date": "2026-04-25", "time": "19:30", "home": "Rajasthan Royals", "away": "Sunrisers Hyderabad", "venue": "Jaipur"},
    {"match": 37, "date": "2026-04-26", "time": "15:30", "home": "Gujarat Titans", "away": "Chennai Super Kings", "venue": "Ahmedabad"},
    {"match": 38, "date": "2026-04-26", "time": "19:30", "home": "Lucknow Super Giants", "away": "Kolkata Knight Riders", "venue": "Lucknow"},
    {"match": 39, "date": "2026-04-27", "time": "19:30", "home": "Delhi Capitals", "away": "Royal Challengers Bengaluru", "venue": "Delhi"},
    {"match": 40, "date": "2026-04-28", "time": "19:30", "home": "Punjab Kings", "away": "Rajasthan Royals", "venue": "New Chandigarh"},
    {"match": 41, "date": "2026-04-29", "time": "19:30", "home": "Mumbai Indians", "away": "Sunrisers Hyderabad", "venue": "Mumbai"},
    {"match": 42, "date": "2026-04-30", "time": "19:30", "home": "Gujarat Titans", "away": "Royal Challengers Bengaluru", "venue": "Ahmedabad"},
    {"match": 43, "date": "2026-05-01", "time": "19:30", "home": "Rajasthan Royals", "away": "Delhi Capitals", "venue": "Jaipur"},
    {"match": 44, "date": "2026-05-02", "time": "19:30", "home": "Chennai Super Kings", "away": "Mumbai Indians", "venue": "Chennai"},
    {"match": 45, "date": "2026-05-03", "time": "15:30", "home": "Sunrisers Hyderabad", "away": "Kolkata Knight Riders", "venue": "Hyderabad"},
    {"match": 46, "date": "2026-05-03", "time": "19:30", "home": "Gujarat Titans", "away": "Punjab Kings", "venue": "Ahmedabad"},
    {"match": 47, "date": "2026-05-04", "time": "19:30", "home": "Mumbai Indians", "away": "Lucknow Super Giants", "venue": "Mumbai"},
    {"match": 48, "date": "2026-05-05", "time": "19:30", "home": "Delhi Capitals", "away": "Chennai Super Kings", "venue": "Delhi"},
    {"match": 49, "date": "2026-05-06", "time": "19:30", "home": "Sunrisers Hyderabad", "away": "Punjab Kings", "venue": "Hyderabad"},
    {"match": 50, "date": "2026-05-07", "time": "19:30", "home": "Lucknow Super Giants", "away": "Royal Challengers Bengaluru", "venue": "Lucknow"},
    {"match": 51, "date": "2026-05-08", "time": "19:30", "home": "Delhi Capitals", "away": "Kolkata Knight Riders", "venue": "Delhi"},
    {"match": 52, "date": "2026-05-09", "time": "19:30", "home": "Rajasthan Royals", "away": "Gujarat Titans", "venue": "Jaipur"},
    {"match": 53, "date": "2026-05-10", "time": "15:30", "home": "Chennai Super Kings", "away": "Lucknow Super Giants", "venue": "Chennai"},
    {"match": 54, "date": "2026-05-10", "time": "19:30", "home": "Royal Challengers Bengaluru", "away": "Mumbai Indians", "venue": "Raipur"},
    {"match": 55, "date": "2026-05-11", "time": "19:30", "home": "Punjab Kings", "away": "Delhi Capitals", "venue": "Dharamshala"},
    {"match": 56, "date": "2026-05-12", "time": "19:30", "home": "Gujarat Titans", "away": "Sunrisers Hyderabad", "venue": "Ahmedabad"},
    {"match": 57, "date": "2026-05-13", "time": "19:30", "home": "Royal Challengers Bengaluru", "away": "Kolkata Knight Riders", "venue": "Raipur"},
    {"match": 58, "date": "2026-05-14", "time": "19:30", "home": "Punjab Kings", "away": "Mumbai Indians", "venue": "Dharamshala"},
    {"match": 59, "date": "2026-05-15", "time": "19:30", "home": "Lucknow Super Giants", "away": "Chennai Super Kings", "venue": "Lucknow"},
    {"match": 60, "date": "2026-05-16", "time": "19:30", "home": "Kolkata Knight Riders", "away": "Gujarat Titans", "venue": "Kolkata"},
    {"match": 61, "date": "2026-05-17", "time": "15:30", "home": "Punjab Kings", "away": "Royal Challengers Bengaluru", "venue": "Dharamshala"},
    {"match": 62, "date": "2026-05-17", "time": "19:30", "home": "Delhi Capitals", "away": "Rajasthan Royals", "venue": "Delhi"},
    {"match": 63, "date": "2026-05-18", "time": "19:30", "home": "Chennai Super Kings", "away": "Sunrisers Hyderabad", "venue": "Chennai"},
    {"match": 64, "date": "2026-05-19", "time": "19:30", "home": "Rajasthan Royals", "away": "Lucknow Super Giants", "venue": "Jaipur"},
    {"match": 65, "date": "2026-05-20", "time": "19:30", "home": "Kolkata Knight Riders", "away": "Mumbai Indians", "venue": "Kolkata"},
    {"match": 66, "date": "2026-05-21", "time": "19:30", "home": "Chennai Super Kings", "away": "Gujarat Titans", "venue": "Chennai"},
    {"match": 67, "date": "2026-05-22", "time": "19:30", "home": "Sunrisers Hyderabad", "away": "Royal Challengers Bengaluru", "venue": "Hyderabad"},
    {"match": 68, "date": "2026-05-23", "time": "19:30", "home": "Lucknow Super Giants", "away": "Punjab Kings", "venue": "Lucknow"},
    {"match": 69, "date": "2026-05-24", "time": "15:30", "home": "Mumbai Indians", "away": "Rajasthan Royals", "venue": "Mumbai"},
    {"match": 70, "date": "2026-05-24", "time": "19:30", "home": "Kolkata Knight Riders", "away": "Delhi Capitals", "venue": "Kolkata"},
]


@router.get("/schedule")
def ipl_schedule():
    """Return the IPL 2026 league-stage schedule with computed status."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    matches = []
    next_match = None
    for m in IPL_2026_SCHEDULE:
        h, mn = map(int, m["time"].split(":"))
        # Build IST datetime then convert to UTC (IST = UTC+5:30)
        ist_dt = datetime(int(m["date"][:4]), int(m["date"][5:7]), int(m["date"][8:10]),
                          h, mn, tzinfo=timezone.utc)
        utc_dt = ist_dt - timedelta(hours=5, minutes=30)

        if now > utc_dt + timedelta(hours=4):
            status = "completed"
        elif now >= utc_dt:
            status = "live"
        else:
            status = "upcoming"
            if next_match is None:
                next_match = {**m, "dateTimeGMT": utc_dt.isoformat() + "Z", "status": status}

        matches.append({**m, "dateTimeGMT": utc_dt.isoformat() + "Z", "status": status})

    return {
        "season": "IPL 2026",
        "totalMatches": len(matches),
        "matches": matches,
        "nextMatch": next_match,
    }
