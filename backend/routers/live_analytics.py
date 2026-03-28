"""Live analytics endpoints — combine live match context with historical DuckDB data."""

import re

from fastapi import APIRouter, Query

from ..database import query, normalize_venue, normalize_team, team_variants, VENUE_NAME_MAP
from ..live_db import get_scorecard
from ..player_resolve import resolve_player_name as _resolve_player

router = APIRouter(prefix="/api/live/analytics", tags=["live-analytics"])


def _norm_player_key(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _loose_name_match(display_key: str, row_name: str) -> bool:
    if not display_key or not row_name:
        return False
    a, b = display_key, _norm_player_key(row_name)
    if a == b:
        return True
    if a in b or b in a:
        return True
    pa, pb = a.split(), b.split()
    if pa and pb and pa[-1] == pb[-1] and pa[0][:1] == pb[0][:1]:
        return True
    return False


def _live_batting_from_scorecard(scorecard: dict | None, display_name: str) -> dict | None:
    if not scorecard or not display_name:
        return None
    key = _norm_player_key(display_name)
    best = None
    best_runs = -1
    for inn in scorecard.get("scorecard") or []:
        label = inn.get("inning") or ""
        for b in inn.get("batsmen") or inn.get("batting") or []:
            nm = b.get("name") or b.get("fullName") or ""
            if not _loose_name_match(key, nm):
                continue
            runs = int(b.get("runs") or 0)
            if runs >= best_runs:
                best_runs = runs
                balls = int(b.get("balls") or 0)
                sr = b.get("sr")
                if sr is None and balls:
                    sr = round(runs * 100.0 / balls, 2)
                best = {
                    "runs": runs,
                    "balls": balls,
                    "strike_rate": sr,
                    "dismissal": b.get("dismissalDetail") or b.get("dismissal"),
                    "inning_label": label,
                }
    return best


def _live_bowling_from_scorecard(scorecard: dict | None, display_name: str) -> dict | None:
    if not scorecard or not display_name:
        return None
    key = _norm_player_key(display_name)
    agg_w, agg_r = 0, 0
    agg_o = 0.0
    found = False
    for inn in scorecard.get("scorecard") or []:
        for bw in inn.get("bowlers") or inn.get("bowling") or []:
            nm = bw.get("name") or bw.get("fullName") or ""
            if not _loose_name_match(key, nm):
                continue
            found = True
            agg_w += int(bw.get("wickets") or 0)
            agg_r += int(bw.get("runs") or 0)
            agg_o += float(bw.get("overs") or 0)
    if not found:
        return None
    econ = round(agg_r * 6.0 / agg_o, 2) if agg_o else None
    return {
        "wickets": agg_w,
        "runs_conceded": agg_r,
        "overs": agg_o,
        "economy": econ,
    }


def _venue_variants(name):
    """Return all raw venue names that map to the same canonical name."""
    canonical = normalize_venue(name)
    variants = set()
    for raw, norm in VENUE_NAME_MAP.items():
        if norm == canonical:
            variants.add(raw)
    variants.add(name)
    variants.add(canonical)
    return list(variants)


@router.get("/matchup")
def live_matchup(
    batter: str,
    bowler: str,
    match_id: str | None = None,
):
    """Head-to-head stats for a specific batter vs bowler from historical data."""
    db_batter = _resolve_player(batter, "bat")
    db_bowler = _resolve_player(bowler, "bowl")

    this_batter = this_bowler = None
    if match_id:
        sc = get_scorecard(match_id)
        if sc:
            this_batter = _live_batting_from_scorecard(sc, batter)
            this_bowler = _live_bowling_from_scorecard(sc, bowler)

    rows = query("""
        SELECT
            COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS balls,
            SUM(runs_batter) AS runs,
            SUM(CASE WHEN extras_wides = 0 AND extras_noballs = 0
                      AND runs_batter = 0 AND runs_extras = 0 THEN 1 ELSE 0 END) AS dots,
            SUM(CASE WHEN runs_batter = 4 AND extras_wides = 0 AND extras_noballs = 0
                      THEN 1 ELSE 0 END) AS fours,
            SUM(CASE WHEN runs_batter = 6 AND extras_wides = 0 AND extras_noballs = 0
                      THEN 1 ELSE 0 END) AS sixes,
            SUM(CASE WHEN is_wicket AND player_dismissed = batter THEN 1 ELSE 0 END) AS dismissals,
            ROUND(SUM(runs_batter) * 100.0
                / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END), 0), 2) AS sr
        FROM deliveries
        WHERE batter = ? AND bowler = ? AND is_super_over = false
    """, [db_batter, db_bowler])

    dismissal_kinds = query("""
        SELECT dismissal_kind, COUNT(*) AS count
        FROM deliveries
        WHERE batter = ? AND bowler = ? AND is_wicket = true
          AND player_dismissed = batter AND is_super_over = false
        GROUP BY dismissal_kind
        ORDER BY count DESC
    """, [db_batter, db_bowler])

    result = rows[0] if rows else {}
    if not result.get("balls"):
        out = {
            "batter": batter,
            "bowler": bowler,
            "found": False,
            "db_batter": db_batter,
            "db_bowler": db_bowler,
        }
        if this_batter:
            out["this_match_batter"] = this_batter
        if this_bowler:
            out["this_match_bowler"] = this_bowler
        return out

    result["batter"] = batter
    result["bowler"] = bowler
    result["db_batter"] = db_batter
    result["db_bowler"] = db_bowler
    result["found"] = True
    result["dismissal_kinds"] = dismissal_kinds
    if this_batter:
        result["this_match_batter"] = this_batter
    if this_bowler:
        result["this_match_bowler"] = this_bowler
    return result


@router.get("/projected-score")
def projected_score(
    venue: str,
    current_score: int,
    current_overs: float,
    current_wickets: int = 0,
    innings_number: int = 1,
    target: int | None = None,
):
    """Project final score based on venue history and current match state."""
    variants = _venue_variants(venue)
    ph = ", ".join(["?"] * len(variants))

    venue_avgs = query(f"""
        SELECT
            ROUND(AVG(CASE WHEN i.innings_number = 1 THEN i.total_runs END), 2) AS avg_1st,
            ROUND(AVG(CASE WHEN i.innings_number = 2 THEN i.total_runs END), 2) AS avg_2nd,
            ROUND(AVG(i.total_runs), 2) AS avg_score,
            COUNT(DISTINCT m.match_id) AS total_matches
        FROM matches m
        JOIN innings i ON m.match_id = i.match_id
        WHERE m.venue IN ({ph}) AND i.is_super_over = false
          AND m.result != 'no result'
    """, variants)

    last_3 = query(f"""
        WITH recent AS (
            SELECT m.match_id, m.date
            FROM matches m
            WHERE m.venue IN ({ph})
            GROUP BY m.match_id, m.date
            ORDER BY m.date DESC
            LIMIT 3
        )
        SELECT ROUND(AVG(i.total_runs), 2) AS last_3_avg
        FROM innings i
        JOIN recent r ON i.match_id = r.match_id
        WHERE i.innings_number = ? AND i.is_super_over = false
    """, variants + [innings_number])

    over_by_over = query(f"""
        SELECT sub.over_number + 1 AS over_num,
               ROUND(AVG(sub.over_runs), 2) AS avg_runs
        FROM (
            SELECT d.match_id, d.innings_number, d.over_number,
                   SUM(d.runs_total) AS over_runs
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE m.venue IN ({ph}) AND d.is_super_over = false
            GROUP BY d.match_id, d.innings_number, d.over_number
        ) sub
        GROUP BY sub.over_number
        ORDER BY sub.over_number
    """, variants)

    # Deduplicate over_by_over by over_num
    seen_overs = {}
    for row in over_by_over:
        seen_overs[row["over_num"]] = row["avg_runs"]
    over_by_over_clean = [{"over_num": k, "avg_runs": v} for k, v in sorted(seen_overs.items())]

    va = venue_avgs[0] if venue_avgs else {}
    l3 = last_3[0] if last_3 else {}

    venue_avg_for_innings = va.get("avg_1st") if innings_number == 1 else va.get("avg_2nd")
    if not venue_avg_for_innings:
        venue_avg_for_innings = va.get("avg_score") or 160

    remaining_overs = max(20 - current_overs, 0)
    crr = current_score / current_overs if current_overs > 0 else 0
    venue_rpo = venue_avg_for_innings / 20 if venue_avg_for_innings else 8

    overs_weight = min(current_overs / 10, 1.0)
    projected_rpo = overs_weight * crr + (1 - overs_weight) * venue_rpo
    projected_crr = round(current_score + projected_rpo * remaining_overs, 0) if current_overs > 0 else venue_avg_for_innings

    wicket_factor = max(0.75, 1 - current_wickets * 0.04)
    conservative_rpo = projected_rpo * 0.85 * wicket_factor
    projected_conservative = round(current_score + conservative_rpo * remaining_overs, 0)

    accelerated_rpo = projected_rpo * 1.20
    projected_accelerated = round(current_score + accelerated_rpo * remaining_overs, 0)

    balls_bowled = int(current_overs) * 6 + round((current_overs % 1) * 10)
    par_score = round(venue_avg_for_innings * balls_bowled / 120, 0) if venue_avg_for_innings else None

    result = {
        "venue": normalize_venue(venue),
        "venue_avg_score": va.get("avg_score"),
        "venue_avg_1st": va.get("avg_1st"),
        "venue_avg_2nd": va.get("avg_2nd"),
        "total_venue_matches": va.get("total_matches"),
        "last_3_avg": l3.get("last_3_avg"),
        "current_rr": round(crr, 2),
        "projected_current_rr": projected_crr,
        "projected_conservative": projected_conservative,
        "projected_accelerated": projected_accelerated,
        "par_score_at_over": par_score,
        "over_by_over_avg": over_by_over_clean,
    }

    if target and innings_number == 2 and remaining_overs > 0:
        runs_needed = target - current_score
        result["required_rate"] = round(runs_needed * 6 / (remaining_overs * 6), 2)
        result["runs_needed"] = runs_needed
        result["balls_remaining"] = int(remaining_overs * 6)

    return result


@router.get("/venue-insights")
def venue_insights(venue: str):
    """Comprehensive venue insights including phase-wise scoring and recent results."""
    variants = _venue_variants(venue)
    ph = ", ".join(["?"] * len(variants))

    stats = query(f"""
        WITH venue_data AS (
            SELECT m.match_id, m.season, m.winner, m.toss_winner, m.toss_decision,
                   m.team1, m.team2, m.result,
                   i.innings_number, i.total_runs, i.batting_team, i.total_wickets
            FROM matches m
            JOIN innings i ON m.match_id = i.match_id
            WHERE m.venue IN ({ph}) AND i.is_super_over = false
              AND m.result != 'no result'
        )
        SELECT
            COUNT(DISTINCT match_id) AS matches,
            ROUND(AVG(total_runs), 2) AS avg_score,
            ROUND(AVG(CASE WHEN innings_number = 1 THEN total_runs END), 2) AS avg_1st,
            ROUND(AVG(CASE WHEN innings_number = 2 THEN total_runs END), 2) AS avg_2nd,
            MAX(total_runs) AS highest,
            MIN(total_runs) AS lowest,
            ROUND(SUM(CASE WHEN innings_number = 1 AND batting_team = winner THEN 1 ELSE 0 END) * 100.0
                / NULLIF(COUNT(DISTINCT match_id), 0), 2) AS bat_first_win_pct,
            ROUND(SUM(CASE WHEN toss_decision = 'field' THEN 1 ELSE 0 END) * 100.0
                / NULLIF(COUNT(*), 0), 2) AS toss_elect_field_pct
        FROM venue_data
    """, variants)

    phase_stats = query(f"""
        SELECT
            CASE
                WHEN d.over_number <= 5 THEN 'powerplay'
                WHEN d.over_number <= 14 THEN 'middle'
                ELSE 'death'
            END AS phase,
            ROUND(SUM(d.runs_total) * 6.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS avg_rr,
            ROUND(AVG(d.runs_total), 2) AS avg_runs_per_ball,
            SUM(CASE WHEN d.is_wicket THEN 1 ELSE 0 END) AS total_wickets,
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS total_balls
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE m.venue IN ({ph}) AND d.is_super_over = false
        GROUP BY phase
        ORDER BY CASE phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 ELSE 3 END
    """, variants)

    recent = query(f"""
        SELECT m.match_id, m.date, m.team1, m.team2, m.winner,
               m.win_by_runs, m.win_by_wickets,
               MAX(CASE WHEN i.innings_number = 1 THEN i.total_runs END) AS inn1_score,
               MAX(CASE WHEN i.innings_number = 1 THEN i.total_wickets END) AS inn1_wickets,
               MAX(CASE WHEN i.innings_number = 2 THEN i.total_runs END) AS inn2_score,
               MAX(CASE WHEN i.innings_number = 2 THEN i.total_wickets END) AS inn2_wickets
        FROM matches m
        JOIN innings i ON m.match_id = i.match_id
        WHERE m.venue IN ({ph}) AND i.is_super_over = false
        GROUP BY m.match_id, m.date, m.team1, m.team2, m.winner, m.win_by_runs, m.win_by_wickets
        ORDER BY m.date DESC
        LIMIT 5
    """, variants)

    for r in recent:
        if r.get("team1"):
            r["team1"] = normalize_team(r["team1"])
        if r.get("team2"):
            r["team2"] = normalize_team(r["team2"])
        if r.get("winner"):
            r["winner"] = normalize_team(r["winner"])

    return {
        "venue": normalize_venue(venue),
        "stats": stats[0] if stats else {},
        "phase_stats": phase_stats,
        "recent_matches": recent,
    }


@router.get("/player-form")
def player_form(
    player: str,
    role: str = Query("bat", pattern="^(bat|bowl)$"),
    match_id: str | None = None,
):
    """Recent form and career context for a player."""
    db_player = _resolve_player(player, role)
    if role == "bat":
        last_5 = query("""
            WITH batting AS (
                SELECT m.date, i.bowling_team AS opponent,
                       SUM(d.runs_batter) AS runs,
                       COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
                       MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_out
                FROM deliveries d
                JOIN matches m ON d.match_id = m.match_id
                JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
                WHERE d.batter = ? AND d.is_super_over = false
                GROUP BY m.date, d.match_id, i.bowling_team
            )
            SELECT date, opponent, runs, balls, was_out,
                   ROUND(runs * 100.0 / NULLIF(balls, 0), 2) AS sr
            FROM batting
            ORDER BY date DESC
            LIMIT 5
        """, [db_player])

        career = query("""
            SELECT COUNT(DISTINCT match_id) AS matches,
                   SUM(runs_batter) AS runs,
                   COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS balls,
                   ROUND(SUM(runs_batter) * 100.0
                       / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END), 0), 2) AS sr
            FROM deliveries
            WHERE batter = ? AND is_super_over = false
        """, [db_player])

        career_dismissals = query("""
            SELECT COUNT(*) AS outs
            FROM deliveries
            WHERE batter = ? AND is_wicket = true AND player_dismissed = batter
              AND is_super_over = false
        """, [db_player])

        c = career[0] if career else {}
        outs = career_dismissals[0]["outs"] if career_dismissals else 0
        career_avg = round(c.get("runs", 0) / outs, 2) if outs else None

        for r in last_5:
            if r.get("opponent"):
                r["opponent"] = normalize_team(r["opponent"])

        avg_last_5 = round(sum(r["runs"] for r in last_5) / len(last_5), 2) if last_5 else None
        sr_last_5_balls = sum(r["balls"] for r in last_5)
        sr_last_5 = round(sum(r["runs"] for r in last_5) * 100.0 / sr_last_5_balls, 2) if sr_last_5_balls else None

        payload = {
            "player": player,
            "role": "bat",
            "last_5": last_5,
            "avg_last_5": avg_last_5,
            "sr_last_5": sr_last_5,
            "career_avg": career_avg,
            "career_sr": c.get("sr"),
            "career_runs": c.get("runs"),
            "career_matches": c.get("matches"),
        }
        if match_id:
            sc = get_scorecard(match_id)
            if sc:
                tm = _live_batting_from_scorecard(sc, player)
                if tm:
                    payload["this_match"] = tm
        return payload
    else:
        last_5 = query("""
            WITH bowling AS (
                SELECT m.date, i.batting_team AS opponent, d.match_id,
                       SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs,
                       SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN
                           ('run out','retired hurt','retired out','obstructing the field')
                           THEN 1 ELSE 0 END) AS wickets,
                       COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls
                FROM deliveries d
                JOIN matches m ON d.match_id = m.match_id
                JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
                WHERE d.bowler = ? AND d.is_super_over = false
                GROUP BY m.date, d.match_id, i.batting_team
            )
            SELECT date, opponent, runs, wickets, balls,
                   ROUND(runs * 6.0 / NULLIF(balls, 0), 2) AS economy
            FROM bowling
            ORDER BY date DESC
            LIMIT 5
        """, [db_player])

        career = query("""
            SELECT COUNT(DISTINCT match_id) AS matches,
                   SUM(runs_batter + extras_wides + extras_noballs) AS runs_conceded,
                   SUM(CASE WHEN is_wicket AND dismissal_kind NOT IN
                       ('run out','retired hurt','retired out','obstructing the field')
                       THEN 1 ELSE 0 END) AS wickets,
                   COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS balls,
                   ROUND(SUM(runs_batter + extras_wides + extras_noballs) * 6.0
                       / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0
                                      THEN 1 END), 0), 2) AS economy
            FROM deliveries
            WHERE bowler = ? AND is_super_over = false
        """, [db_player])

        c = career[0] if career else {}

        for r in last_5:
            if r.get("opponent"):
                r["opponent"] = normalize_team(r["opponent"])

        avg_econ = round(
            sum(r["economy"] for r in last_5 if r.get("economy")) / len(last_5), 2
        ) if last_5 else None

        payload = {
            "player": player,
            "role": "bowl",
            "last_5": last_5,
            "avg_econ_last_5": avg_econ,
            "career_economy": c.get("economy"),
            "career_wickets": c.get("wickets"),
            "career_matches": c.get("matches"),
        }
        if match_id:
            sc = get_scorecard(match_id)
            if sc:
                tm = _live_bowling_from_scorecard(sc, player)
                if tm:
                    payload["this_match"] = tm
        return payload


@router.get("/phase-analysis")
def phase_analysis(team: str, current_over: int = 0):
    """Phase-wise run rate for a team vs league average."""
    tvars = team_variants(team)
    tph = ", ".join(["?"] * len(tvars))

    team_phases = query(f"""
        SELECT
            CASE
                WHEN d.over_number <= 5 THEN 'powerplay'
                WHEN d.over_number <= 14 THEN 'middle'
                ELSE 'death'
            END AS phase,
            ROUND(SUM(d.runs_total) * 6.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS team_rr,
            SUM(CASE WHEN d.is_wicket THEN 1 ELSE 0 END) AS team_wickets,
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS team_balls
        FROM deliveries d
        JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
        WHERE i.batting_team IN ({tph}) AND d.is_super_over = false
        GROUP BY phase
        ORDER BY CASE phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 ELSE 3 END
    """, tvars)

    league_phases = query("""
        SELECT
            CASE
                WHEN d.over_number <= 5 THEN 'powerplay'
                WHEN d.over_number <= 14 THEN 'middle'
                ELSE 'death'
            END AS phase,
            ROUND(SUM(d.runs_total) * 6.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS league_rr,
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS league_balls
        FROM deliveries d
        WHERE d.is_super_over = false
        GROUP BY phase
        ORDER BY CASE phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 ELSE 3 END
    """)

    league_map = {r["phase"]: r for r in league_phases}
    phases = []
    for tp in team_phases:
        lp = league_map.get(tp["phase"], {})
        innings_count = tp["team_balls"] / 36 if tp["phase"] == "powerplay" else (
            tp["team_balls"] / 54 if tp["phase"] == "middle" else tp["team_balls"] / 30
        )
        avg_wickets = round(tp["team_wickets"] / innings_count, 2) if innings_count > 0 else 0
        phases.append({
            "phase": tp["phase"],
            "team_rr": tp["team_rr"],
            "league_rr": lp.get("league_rr"),
            "team_wickets_per_inn": avg_wickets,
        })

    if current_over <= 5:
        current_phase = "powerplay"
    elif current_over <= 14:
        current_phase = "middle"
    else:
        current_phase = "death"

    return {
        "team": normalize_team(team),
        "current_phase": current_phase,
        "phases": phases,
    }


@router.get("/team-h2h-context")
def team_h2h_context(team1: str, team2: str):
    """Head-to-head context between two teams."""
    t1vars = team_variants(team1)
    t2vars = team_variants(team2)
    t1ph = ", ".join(["?"] * len(t1vars))
    t2ph = ", ".join(["?"] * len(t2vars))

    rows = query(f"""
        SELECT m.match_id, m.date, m.winner, m.win_by_runs, m.win_by_wickets,
               m.team1, m.team2, m.venue, m.toss_winner, m.toss_decision
        FROM matches m
        WHERE ((m.team1 IN ({t1ph}) AND m.team2 IN ({t2ph}))
            OR (m.team1 IN ({t2ph}) AND m.team2 IN ({t1ph})))
          AND m.result = 'win'
        ORDER BY m.date DESC
    """, t1vars + t2vars + t2vars + t1vars)

    t1_canonical = normalize_team(team1)
    t2_canonical = normalize_team(team2)
    t1_wins = sum(1 for r in rows if normalize_team(r["winner"]) == t1_canonical)
    t2_wins = sum(1 for r in rows if normalize_team(r["winner"]) == t2_canonical)

    last_5 = []
    for r in rows[:5]:
        winner = normalize_team(r["winner"])
        margin = (f"{r['win_by_runs']} runs" if r["win_by_runs"]
                  else f"{r['win_by_wickets']} wickets")
        last_5.append({
            "date": r["date"],
            "winner": winner,
            "margin": margin,
            "venue": normalize_venue(r["venue"]) if r.get("venue") else None,
        })

    return {
        "team1": t1_canonical,
        "team2": t2_canonical,
        "total_matches": len(rows),
        "team1_wins": t1_wins,
        "team2_wins": t2_wins,
        "last_5": last_5,
    }
