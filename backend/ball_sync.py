"""Ball-by-ball data sync — fetch from SportMonks, parse, store, and serve for live display.

Flow:
  1. Admin triggers initial sync → fetches all balls so far (1 API hit) → stores in SQLite
  2. Poller piggybacks ball data on the existing scorecard fetch (0 extra API hits)
     by passing include_balls=True to fetch_scorecard → processes balls from same response
  3. Frontend polls GET /api/live/balls/{match_id} → returns current + previous over
"""

from __future__ import annotations

import json
import logging
import math
from collections import defaultdict

from .cricket_api import SportmonksProvider, get_cricket_api
from .live_db import (
    get_ball_count,
    get_ball_sync_state,
    get_balls_for_match,
    get_max_ball_id,
    log_poll,
    upsert_ball_sync_state,
    upsert_balls,
)

logger = logging.getLogger(__name__)


def _unwrap(obj):
    if isinstance(obj, dict) and isinstance(obj.get("data"), dict):
        return obj["data"]
    return obj


def _player_name(p_raw) -> str:
    p = _unwrap(p_raw) if isinstance(p_raw, dict) else p_raw
    if not isinstance(p, dict):
        return ""
    return (p.get("fullname") or p.get("lastname") or "").strip()


def _ball_decimal_parts(ball_val: float | int) -> tuple[int, int]:
    """Sportmonks ball index: 1.3 → over 1 (0-indexed), third delivery."""
    x = float(ball_val)
    whole = int(math.floor(x + 1e-9))
    frac = x - whole
    ball_ord = int(round(frac * 10 + 1e-9))
    if ball_ord == 0:
        ball_ord = 1
    return whole, ball_ord


def _scoreboard_to_innings(sb: str) -> int:
    """S1 → 1, S2 → 2, etc."""
    s = (sb or "S1").upper()
    if s.startswith("S") and s[1:].isdigit():
        return int(s[1:])
    return 1


def parse_sportmonks_ball(ball: dict, local_id: int | None, local_name: str, visitor_name: str) -> dict:
    """Parse a single SportMonks ball object into our flat storage format."""
    ball_id = ball.get("id", 0)
    sb = str(ball.get("scoreboard") or "S1")
    ball_val = float(ball.get("ball", 0))
    over_num, ball_in_over = _ball_decimal_parts(ball_val)

    batter = _player_name(ball.get("batsman"))
    bowler = _player_name(ball.get("bowler"))

    non_striker = ""
    striker_id = ball.get("batsman_id")
    for pid_key in ("batsman_one_on_creeze_id", "batsman_two_on_creeze_id"):
        pid = ball.get(pid_key)
        if pid is not None and int(pid) != int(striker_id or 0):
            ns_obj = ball.get(pid_key.replace("_id", ""))
            if ns_obj:
                non_striker = _player_name(ns_obj)
            break

    sc = _unwrap(ball.get("score")) if isinstance(ball.get("score"), dict) else {}
    if not isinstance(sc, dict):
        sc = {}
    score_name = (sc.get("name") or "").lower()
    runs_field = int(sc.get("runs") or 0)
    leg_bye = int(sc.get("leg_bye") or 0)
    bye = int(sc.get("bye") or 0)
    nob = int(sc.get("noball") or 0)
    nob_extra = int(sc.get("noball_runs") or 0)
    is_wicket = bool(sc.get("is_wicket") or sc.get("out"))

    extra_type = None
    extra_runs = 0
    if "wide" in score_name and nob == 0:
        extra_type = "wide"
        extra_runs = runs_field
        runs_batter = 0
        runs_extras = runs_field
        runs_total = runs_field
    elif nob:
        extra_type = "noball"
        extra_runs = 1
        runs_batter = nob_extra
        runs_extras = 1
        runs_total = runs_field
    elif leg_bye:
        extra_type = "legbye"
        extra_runs = leg_bye
        runs_batter = 0
        runs_extras = leg_bye
        runs_total = leg_bye
    elif bye:
        extra_type = "bye"
        extra_runs = bye
        runs_batter = 0
        runs_extras = bye
        runs_total = bye
    else:
        runs_batter = runs_field
        runs_extras = 0
        runs_total = runs_field

    wicket_kind = None
    player_out = ""
    fielder = ""
    if is_wicket or ball.get("batsmanout_id") is not None:
        kind_raw = sc.get("name") or ""
        kl = kind_raw.lower()
        if "catch" in kl:
            wicket_kind = "caught"
        elif "lbw" in kl:
            wicket_kind = "lbw"
        elif "bowled" in kl:
            wicket_kind = "bowled"
        elif "run out" in kl or "runout" in kl.replace(" ", ""):
            wicket_kind = "run out"
        elif "stump" in kl:
            wicket_kind = "stumped"
        elif "hit wicket" in kl:
            wicket_kind = "hit wicket"
        else:
            wicket_kind = "out"

        out_id = ball.get("batsmanout_id") or striker_id
        player_out = batter
        cs = ball.get("catchstump") or ball.get("catch_stump")
        fielder = _player_name(cs)

    tid = ball.get("team_id")
    batting_team = local_name if tid == local_id else visitor_name

    team_score = int(ball.get("score_id") or 0) if ball.get("score_id") else None
    team_wickets = None

    return {
        "ball_id": ball_id,
        "innings": _scoreboard_to_innings(sb),
        "scoreboard": sb,
        "over_num": over_num,
        "ball_in_over": ball_in_over,
        "ball_decimal": ball_val,
        "batter": batter,
        "bowler": bowler,
        "non_striker": non_striker,
        "runs_batter": runs_batter,
        "runs_extras": runs_extras,
        "runs_total": runs_total,
        "extra_type": extra_type,
        "extra_runs": extra_runs,
        "is_wicket": int(bool(is_wicket or wicket_kind)),
        "wicket_kind": wicket_kind,
        "player_out": player_out,
        "fielder": fielder,
        "team_score": team_score,
        "team_wickets": team_wickets,
        "team_id": tid,
        "batting_team": batting_team,
        "raw_data": json.dumps(ball, default=str),
    }


async def sync_balls_for_match(match_id: str) -> dict:
    """Fetch all ball-by-ball data from SportMonks for a match and store it.

    Returns summary dict with ball count and status.
    """
    api = get_cricket_api()
    if not isinstance(api, SportmonksProvider):
        raise RuntimeError("Ball sync requires SportmonksProvider")

    fixture = await api.fetch_fixture_raw_for_ingest(match_id)

    balls_raw = fixture.get("balls")
    ball_list: list = []
    if isinstance(balls_raw, list):
        ball_list = balls_raw
    elif isinstance(balls_raw, dict) and isinstance(balls_raw.get("data"), list):
        ball_list = balls_raw["data"]

    if not ball_list:
        return {"matchId": match_id, "ballCount": 0, "newBalls": 0, "detail": "No balls data available from API"}

    local = _unwrap(fixture.get("localteam")) or {}
    visitor = _unwrap(fixture.get("visitorteam")) or {}
    local_id = fixture.get("localteam_id")
    local_name = (local.get("name") or local.get("code") or "") if isinstance(local, dict) else ""
    visitor_name = (visitor.get("name") or visitor.get("code") or "") if isinstance(visitor, dict) else ""

    parsed = []
    for b in sorted(ball_list, key=lambda x: float(x.get("ball", 0))):
        parsed.append(parse_sportmonks_ball(b, local_id, local_name, visitor_name))

    _compute_running_totals(parsed)

    new_count = upsert_balls(match_id, parsed)
    total = get_ball_count(match_id)
    max_id = get_max_ball_id(match_id)

    upsert_ball_sync_state(
        match_id, is_synced=1, last_ball_id=max_id,
        ball_count=total, mode="manual",
    )
    log_poll("ball_sync", "success", match_id=match_id, hits=1)

    return {
        "matchId": match_id,
        "ballCount": total,
        "newBalls": new_count,
        "detail": f"Synced {total} balls ({new_count} new)",
    }


def _compute_running_totals(balls: list[dict]):
    """Add cumulative team_score and team_wickets to each ball in-place."""
    by_sb: dict[str, list[dict]] = defaultdict(list)
    for b in balls:
        by_sb[b["scoreboard"]].append(b)

    for sb_balls in by_sb.values():
        score = 0
        wickets = 0
        for b in sb_balls:
            score += b["runs_total"]
            if b["is_wicket"]:
                wickets += 1
            b["team_score"] = score
            b["team_wickets"] = wickets


def build_balls_response(match_id: str) -> dict:
    """Build the structured response for GET /api/live/balls/{match_id}."""
    sync_state = get_ball_sync_state(match_id)
    if not sync_state or not sync_state["is_synced"]:
        return {"matchId": match_id, "synced": False}

    all_balls = get_balls_for_match(match_id)
    if not all_balls:
        return {
            "matchId": match_id,
            "synced": True,
            "totalBalls": 0,
            "currentOver": None,
            "previousOver": None,
            "allOvers": [],
            "lastSyncedAt": sync_state.get("synced_at"),
        }

    by_sb: dict[str, list[dict]] = defaultdict(list)
    for b in all_balls:
        by_sb[b["scoreboard"]].append(b)

    last_sb = sorted(by_sb.keys())[-1]
    innings_balls = by_sb[last_sb]

    by_over: dict[int, list[dict]] = defaultdict(list)
    for b in innings_balls:
        by_over[b["over_num"]].append(b)

    over_numbers = sorted(by_over.keys())
    current_over_num = over_numbers[-1] if over_numbers else 0

    current_over = _build_over_data(current_over_num, by_over.get(current_over_num, []))
    previous_over = None
    if len(over_numbers) >= 2:
        prev_num = over_numbers[-2]
        previous_over = _build_over_data(prev_num, by_over.get(prev_num, []))

    all_overs = []
    for sb_key in sorted(by_sb.keys()):
        sb_balls = by_sb[sb_key]
        sb_by_over: dict[int, list[dict]] = defaultdict(list)
        for b in sb_balls:
            sb_by_over[b["over_num"]].append(b)
        for ov_num in sorted(sb_by_over.keys()):
            ov_data = _build_over_data(ov_num, sb_by_over[ov_num])
            ov_data["scoreboard"] = sb_key
            ov_data["innings"] = _scoreboard_to_innings(sb_key)
            ov_data["battingTeam"] = sb_by_over[ov_num][0].get("batting_team", "")
            all_overs.append(ov_data)

    current_innings = _scoreboard_to_innings(last_sb)

    return {
        "matchId": match_id,
        "synced": True,
        "currentInnings": current_innings,
        "currentOver": current_over,
        "previousOver": previous_over,
        "allOvers": all_overs,
        "totalBalls": len(all_balls),
        "lastSyncedAt": sync_state.get("synced_at"),
    }


def _build_over_data(over_num: int, balls: list[dict]) -> dict:
    """Build a single over object for the API response."""
    total_runs = sum(b["runs_total"] for b in balls)
    total_wickets = sum(1 for b in balls if b["is_wicket"])

    ball_items = []
    for b in balls:
        is_boundary = b["runs_batter"] in (4, 6) and not b["extra_type"]
        result = str(b["runs_total"])
        ball_type = "run"

        if b["is_wicket"]:
            result = "W"
            ball_type = "wicket"
        elif b["extra_type"]:
            result = f"+{b['runs_total']}"
            ball_type = "extra"
        elif b["runs_batter"] == 6:
            result = "6"
            ball_type = "six"
        elif b["runs_batter"] == 4:
            result = "4"
            ball_type = "four"
        elif b["runs_total"] == 0:
            result = "0"

        ball_items.append({
            "ballNum": b["ball_in_over"],
            "overComp": over_num,
            "result": result,
            "type": ball_type,
            "runs": b["runs_total"],
            "runsBatter": b["runs_batter"],
            "isBoundary": is_boundary,
            "isWicket": bool(b["is_wicket"]),
            "wicketKind": b.get("wicket_kind"),
            "playerOut": b.get("player_out"),
            "batter": b.get("batter"),
            "bowler": b.get("bowler"),
            "extraType": b.get("extra_type"),
            "isNew": False,
        })

    return {
        "overNumber": over_num,
        "runs": total_runs,
        "wickets": total_wickets,
        "balls": ball_items,
    }


def process_balls_from_fixture(match_id: str, fixture: dict) -> int:
    """Extract and store balls from an already-fetched fixture dict.

    Called by the poller after fetch_scorecard(include_balls=True).
    Costs 0 extra API hits — the fixture data was already fetched.
    Returns the number of new balls stored.
    """
    balls_raw = fixture.get("balls")
    ball_list: list = []
    if isinstance(balls_raw, list):
        ball_list = balls_raw
    elif isinstance(balls_raw, dict) and isinstance(balls_raw.get("data"), list):
        ball_list = balls_raw["data"]

    if not ball_list:
        logger.debug("process_balls_from_fixture(%s): no balls in fixture response", match_id)
        return 0

    local = _unwrap(fixture.get("localteam")) or {}
    visitor = _unwrap(fixture.get("visitorteam")) or {}
    local_id = fixture.get("localteam_id")
    local_name = (local.get("name") or local.get("code") or "") if isinstance(local, dict) else ""
    visitor_name = (visitor.get("name") or visitor.get("code") or "") if isinstance(visitor, dict) else ""

    parsed = []
    for b in sorted(ball_list, key=lambda x: float(x.get("ball", 0))):
        parsed.append(parse_sportmonks_ball(b, local_id, local_name, visitor_name))
    _compute_running_totals(parsed)

    new_count = upsert_balls(match_id, parsed)
    total = get_ball_count(match_id)
    max_id = get_max_ball_id(match_id)
    upsert_ball_sync_state(
        match_id, is_synced=1, last_ball_id=max_id,
        ball_count=total, mode="auto",
    )
    logger.debug("Ball sync from fixture for %s: %d total balls (%d new)", match_id, total, new_count)
    return new_count
