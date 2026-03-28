"""IPL 2026 league-stage schedule and match-window detection."""

from datetime import datetime, timedelta, timezone

from .cricket_api import sanitize_match_status_text
from .database import normalize_team
from .live_db import (
    find_scorecard_for_schedule_fixture,
    get_all_matches,
    get_scorecard,
)

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

MATCH_WINDOW_BEFORE = timedelta(minutes=15)
MATCH_WINDOW_AFTER = timedelta(hours=4, minutes=30)


def _parse_ist_to_utc(date_str: str, time_str: str) -> datetime:
    """Parse an IST date+time string into a UTC datetime."""
    h, m = map(int, time_str.split(":"))
    ist_dt = datetime(
        int(date_str[:4]), int(date_str[5:7]), int(date_str[8:10]),
        h, m, tzinfo=timezone.utc,
    )
    return ist_dt - timedelta(hours=5, minutes=30)


def is_match_window(now: datetime | None = None) -> bool:
    """Return True if *now* falls within any match's active window."""
    if now is None:
        now = datetime.now(timezone.utc)
    for m in IPL_2026_SCHEDULE:
        utc_start = _parse_ist_to_utc(m["date"], m["time"])
        if (utc_start - MATCH_WINDOW_BEFORE) <= now <= (utc_start + MATCH_WINDOW_AFTER):
            return True
    return False


def _cached_row_for_schedule_row(
    cached: list[dict],
    date_str: str,
    home: str,
    away: str,
) -> dict | None:
    """Find a cached IPL live row that matches this schedule fixture (date + teams)."""
    want = {normalize_team(home), normalize_team(away)}
    for lm in cached:
        if not lm.get("isIPL"):
            continue
        teams = lm.get("teams") or []
        if len(teams) < 2:
            continue
        got = {normalize_team(teams[0]), normalize_team(teams[1])}
        if got != want:
            continue
        lm_date = (lm.get("dateTimeGMT") or lm.get("date") or "")[:10]
        if lm_date == date_str or _dates_close_for_fixture(date_str, lm_date):
            return lm
    return None


def _dates_close_for_fixture(schedule_date: str, api_date: str) -> bool:
    if not api_date or len(api_date) < 10:
        return False
    if api_date[:10] == schedule_date:
        return True
    try:
        from datetime import datetime

        s = datetime.strptime(schedule_date, "%Y-%m-%d").date()
        a = datetime.strptime(api_date[:10], "%Y-%m-%d").date()
        return abs((s - a).days) <= 1
    except ValueError:
        return False


def _time_derived_status(utc_dt: datetime, now: datetime) -> str:
    if now > utc_dt + timedelta(hours=4):
        return "completed"
    if now >= utc_dt:
        return "live"
    return "upcoming"


def next_match_window(now: datetime | None = None) -> datetime | None:
    """Return the start of the next match window, or None if season is over."""
    if now is None:
        now = datetime.now(timezone.utc)
    upcoming = []
    for m in IPL_2026_SCHEDULE:
        window_start = _parse_ist_to_utc(m["date"], m["time"]) - MATCH_WINDOW_BEFORE
        if window_start > now:
            upcoming.append(window_start)
    return min(upcoming) if upcoming else None


def compute_schedule_with_status() -> dict:
    """Build the full schedule response with computed status per match."""
    now = datetime.now(timezone.utc)
    cached = get_all_matches()
    matches = []
    next_match = None

    for m in IPL_2026_SCHEDULE:
        utc_dt = _parse_ist_to_utc(m["date"], m["time"])
        base_status = _time_derived_status(utc_dt, now)
        live_row = _cached_row_for_schedule_row(cached, m["date"], m["home"], m["away"])

        status = base_status
        api_match_id: str | None = None
        result_note = ""
        match_winner = ""
        player_of_match: dict | None = None

        if live_row:
            api_match_id = live_row.get("id") or None
            if live_row.get("matchEnded"):
                status = "completed"
                result_note = (live_row.get("status") or "").strip()
                match_winner = (live_row.get("matchWinner") or "").strip()
                player_of_match = live_row.get("playerOfMatch")
            elif live_row.get("matchStarted"):
                status = "live"
                result_note = (live_row.get("status") or "").strip()

        row: dict = {
            **m,
            "dateTimeGMT": utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "status": status,
            "seasonYear": 2026,
        }
        if api_match_id:
            row["apiMatchId"] = str(api_match_id)
        if match_winner:
            row["matchWinner"] = match_winner
        if result_note:
            row["resultNote"] = sanitize_match_status_text(result_note)
        if player_of_match:
            row["playerOfMatch"] = player_of_match

        if live_row and live_row.get("matchEnded") and api_match_id:
            sc = get_scorecard(str(api_match_id))
            if isinstance(sc, dict):
                if not row.get("resultNote") and sc.get("status"):
                    row["resultNote"] = sanitize_match_status_text(sc["status"])
                if not row.get("matchWinner") and sc.get("matchWinner"):
                    row["matchWinner"] = sc["matchWinner"]
                if not row.get("playerOfMatch") and sc.get("playerOfMatch"):
                    row["playerOfMatch"] = sc["playerOfMatch"]

        # Fallback: match list may use "Bangalore" vs "Bengaluru", or live row dropped after finish —
        # scan cached scorecards by normalized teams + date.
        if not row.get("apiMatchId") or not row.get("matchWinner") or not row.get("resultNote"):
            mid_fb, sc_fb = find_scorecard_for_schedule_fixture(
                m["date"], m["home"], m["away"]
            )
            if isinstance(sc_fb, dict):
                if mid_fb and not row.get("apiMatchId"):
                    row["apiMatchId"] = str(mid_fb)
                if sc_fb.get("matchEnded"):
                    status = "completed"
                    row["status"] = "completed"
                elif sc_fb.get("matchStarted") and not sc_fb.get("matchEnded"):
                    status = "live"
                    row["status"] = "live"
                if not row.get("matchWinner") and sc_fb.get("matchWinner"):
                    row["matchWinner"] = sc_fb["matchWinner"]
                if not row.get("resultNote") and sc_fb.get("status"):
                    row["resultNote"] = sanitize_match_status_text(sc_fb["status"])
                if not row.get("playerOfMatch") and sc_fb.get("playerOfMatch"):
                    row["playerOfMatch"] = sc_fb["playerOfMatch"]

        if status == "upcoming" and next_match is None:
            next_match = {**row}

        matches.append(row)

    return {
        "season": "IPL 2026",
        "seasonYear": 2026,
        "totalMatches": len(matches),
        "matches": matches,
        "nextMatch": next_match,
    }
