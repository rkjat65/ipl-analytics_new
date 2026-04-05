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
    """Sportmonks ball index: 1.3 → over 1 (0-indexed), third delivery.

    X.0 values (2.0, 3.0 …) are treated as the 6th ball of over X (0-indexed:
    over_num = X-1).  Previous versions decremented over_num again, mapping them
    to the WRONG over.
    """
    x = float(ball_val)
    whole = int(x)
    over_num = max(0, whole - 1)
    frac = x - whole
    ball_ord = int(round(frac * 10 + 1e-9))
    if ball_ord == 0:
        ball_ord = 6
    return over_num, ball_ord


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
    wide_flag = int(sc.get("wide") or 0)
    is_wicket = bool(sc.get("is_wicket") or sc.get("out"))

    extra_type = None
    extra_runs = 0
    if ("wide" in score_name or wide_flag) and nob == 0:
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
    innings_balls = _fixup_balls(by_sb[last_sb])

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
        sb_balls = _fixup_balls(by_sb[sb_key])
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
            "_ballDecimal": b.get("ball_decimal"),
            "_ballId": b.get("ball_id"),
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


def compute_innings_scores_from_balls(match_id: str) -> list[dict]:
    """Compute live score summary from ball-by-ball data in live_balls.

    Returns a list in the same format as cricket_api._build_scores().
    Used to override stale Sportmonks runs.overs data during live matches.
    Returns empty list if no ball data is available.
    """
    all_balls = get_balls_for_match(match_id)
    if not all_balls:
        return []

    by_sb: dict[str, list[dict]] = defaultdict(list)
    for b in all_balls:
        by_sb[b["scoreboard"]].append(b)

    scores = []
    for sb_key in sorted(by_sb.keys()):
        sb_balls = _fixup_balls(by_sb[sb_key])
        last = sb_balls[-1]

        r = last.get("team_score") or sum(b["runs_total"] for b in sb_balls)
        w = last.get("team_wickets") or sum(1 for b in sb_balls if b["is_wicket"])

        # Compute overs from legal deliveries (wideballs/noballs don't consume a ball)
        legal = [b for b in sb_balls if b.get("extra_type") not in ("wide", "noball")]
        if legal:
            last_legal = legal[-1]
            ov = last_legal["over_num"]   # 0-indexed: over 0 = first over
            ball_ord = last_legal["ball_in_over"]
            if ball_ord >= 6:
                o: float = float(ov + 1)
            else:
                o = ov + ball_ord / 10.0
        else:
            o = 0.0

        inning_num = _scoreboard_to_innings(sb_key)
        batting_team = last.get("batting_team", "")
        inning_label = f"{batting_team} (2nd)" if inning_num > 1 else batting_team

        scores.append({
            "inning": inning_label,
            "team": batting_team,
            "inningNumber": inning_num,
            "r": r,
            "w": w,
            "o": o,
            "score": f"{r}/{w} ({o})",
        })

    return scores


def _fixup_balls(balls: list[dict]) -> list[dict]:
    """Recompute over positions from ball_decimal and deduplicate missed extras.

    Two problems are fixed:
    1. Stored over_num may be wrong because of a prior _ball_decimal_parts bug
       that mapped X.0 to the previous over.  Recomputing from ball_decimal fixes
       this for already-stored data.
    2. Sportmonks creates two entries for wides/no-balls at the same ball position.
       When the score include isn't loaded, both get extra_type=None and inflate
       the legal-ball count.  This pass infers the earlier duplicate as a wide.
    """
    from collections import defaultdict as _dd

    balls = [dict(b) for b in balls]
    for b in balls:
        bd = b.get("ball_decimal")
        if bd is not None:
            ov, bio = _ball_decimal_parts(bd)
            b["over_num"] = ov
            b["ball_in_over"] = bio

    groups: dict[tuple, list[int]] = _dd(list)
    for i, b in enumerate(balls):
        key = (b.get("over_num"), b.get("ball_in_over"))
        groups[key].append(i)

    for key, indices in groups.items():
        if len(indices) <= 1:
            continue
        untyped = [i for i in indices if not balls[i].get("extra_type")]
        if len(untyped) <= 1:
            continue
        untyped.sort(key=lambda i: balls[i].get("ball_id", 0))
        for i in untyped[:-1]:
            balls[i]["extra_type"] = "wide"
            balls[i]["runs_total"] = max(balls[i].get("runs_total") or 0, 1)
    return balls


def compute_scorecard_from_balls(match_id: str) -> list[dict]:
    """Build batting/bowling scorecard from live_balls data.

    Returns list in same format as cricket_api._build_scorecard_array().
    Used to override stale Sportmonks batting/bowling data when it freezes.
    Returns empty list if no ball data available.
    """
    all_balls = get_balls_for_match(match_id)
    if not all_balls:
        return []

    by_sb: dict[str, list[dict]] = defaultdict(list)
    for b in all_balls:
        by_sb[b["scoreboard"]].append(b)

    innings_list = []
    for sb_key in sorted(by_sb.keys()):
        sb_balls = _fixup_balls(by_sb[sb_key])
        batting_team = sb_balls[0].get("batting_team", "")

        # ── Batting stats ─────────────────────────────────────────
        bat_stats: dict[str, dict] = {}
        bat_order: list[str] = []
        dismissals: dict[str, tuple] = {}
        last_ball = sb_balls[-1]

        for b in sb_balls:
            batter = b.get("batter") or ""
            if not batter:
                continue
            if batter not in bat_stats:
                bat_stats[batter] = {"runs": 0, "balls": 0, "fours": 0, "sixes": 0}
                bat_order.append(batter)
            s = bat_stats[batter]
            s["runs"] += b.get("runs_batter", 0)
            if b.get("extra_type") != "wide":
                s["balls"] += 1
            if b.get("runs_batter") == 4 and not b.get("extra_type"):
                s["fours"] += 1
            if b.get("runs_batter") == 6 and not b.get("extra_type"):
                s["sixes"] += 1
            if b.get("is_wicket"):
                player_out = b.get("player_out") or batter
                dismissals[player_out] = (
                    b.get("wicket_kind") or "out",
                    b.get("bowler") or "",
                    b.get("fielder") or "",
                )

        active_batters = {last_ball.get("batter"), last_ball.get("non_striker")} - {None, ""}

        batsmen_rows = []
        for name in bat_order:
            s = bat_stats[name]
            balls = s["balls"]
            sr = round(s["runs"] / balls * 100, 2) if balls else 0.0
            is_out = name in dismissals
            if is_out:
                kind, bowler, fielder = dismissals[name]
                if kind == "caught":
                    detail = f"c {fielder} b {bowler}" if fielder else f"c&b {bowler}"
                elif kind == "bowled":
                    detail = f"b {bowler}"
                elif kind == "lbw":
                    detail = f"lbw b {bowler}"
                elif kind == "stumped":
                    detail = f"st {fielder} b {bowler}"
                elif kind == "run out":
                    detail = f"run out ({fielder})" if fielder else "run out"
                else:
                    detail = kind
            else:
                detail = "not out"
            batsmen_rows.append({
                "name": name,
                "fullName": name,
                "runs": s["runs"],
                "balls": balls,
                "fours": s["fours"],
                "sixes": s["sixes"],
                "sr": sr,
                "dismissal": "out" if is_out else "not out",
                "dismissalDetail": detail,
                "active": name in active_batters and not is_out,
                "image": "",
            })

        # ── Bowling stats ──────────────────────────────────────────
        bowl_stats: dict[str, dict] = {}
        bowl_order: list[str] = []
        for b in sb_balls:
            bowler = b.get("bowler") or ""
            if not bowler:
                continue
            if bowler not in bowl_stats:
                bowl_stats[bowler] = {"legal": 0, "runs": 0, "wickets": 0, "dots": 0, "ov_balls": defaultdict(list)}
                bowl_order.append(bowler)
            bw = bowl_stats[bowler]
            extra = b.get("extra_type")
            if extra not in ("wide", "noball"):
                bw["legal"] += 1
                if b.get("runs_total", 0) == 0:
                    bw["dots"] += 1
            if extra == "wide":
                bw["runs"] += b.get("runs_total", 0)
            elif extra == "noball":
                nb_bat = b.get("runs_batter", 0)
                if nb_bat > 0:
                    bw["runs"] += 1 + nb_bat
                else:
                    bw["runs"] += max(b.get("runs_total", 0), 1)
            elif extra in ("legbye", "bye"):
                pass
            else:
                bw["runs"] += b.get("runs_total", 0)
            # No-ball: bowler never gets wicket credit (only run-out possible off no-ball,
            # which is already excluded). Wide: stumping still credits bowler.
            if b.get("is_wicket") and b.get("wicket_kind") not in ("run out",) and extra != "noball":
                bw["wickets"] += 1
            bw["ov_balls"][b.get("over_num", 0)].append(b)

        active_bowler = last_ball.get("bowler", "")
        bowlers_rows = []
        for name in bowl_order:
            bw = bowl_stats[name]
            legal = bw["legal"]
            comp_ov = legal // 6
            rem = legal % 6
            overs_display = float(comp_ov) if rem == 0 else float(f"{comp_ov}.{rem}")
            maidens = 0
            for ov_balls in bw["ov_balls"].values():
                legal_in_ov = [x for x in ov_balls if x.get("extra_type") not in ("wide", "noball")]
                if len(legal_in_ov) == 6:
                    charged = sum(x.get("runs_total", 0) for x in ov_balls if x.get("extra_type") not in ("legbye", "bye"))
                    if charged == 0:
                        maidens += 1
            runs = bw["runs"]
            eco = round(runs / (legal / 6), 2) if legal else 0.0
            bowlers_rows.append({
                "name": name,
                "fullName": name,
                "overs": overs_display,
                "maidens": maidens,
                "runs": runs,
                "wickets": bw["wickets"],
                "economy": eco,
                "dots": bw["dots"],
                "active": name == active_bowler,
                "image": "",
            })

        innings_list.append({
            "inning": batting_team,
            "scoreboard": sb_key,
            "batsmen": batsmen_rows,
            "bowlers": bowlers_rows,
        })

    return innings_list
