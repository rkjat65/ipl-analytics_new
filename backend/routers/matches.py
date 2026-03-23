"""Match endpoints: list, detail, scorecards, win probability."""

from fastapi import APIRouter, Query, HTTPException
from ..database import query, normalize_team, team_variants

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("")
def list_matches(
    season: str | None = None,
    team: str | None = None,
    venue: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    conditions = []
    params = []
    if season:
        parts = [s.strip() for s in season.split(",") if s.strip()]
        if len(parts) == 1:
            conditions.append("m.season = ?")
            params.append(parts[0])
        else:
            ph = ", ".join(["?"] * len(parts))
            conditions.append(f"m.season IN ({ph})")
            params.extend(parts)
    if team:
        variants = team_variants(team)
        placeholders = ", ".join(["?"] * len(variants))
        conditions.append(f"(m.team1 IN ({placeholders}) OR m.team2 IN ({placeholders}))")
        params.extend(variants + variants)
    if venue:
        conditions.append("m.venue = ?")
        params.append(venue)

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    params.extend([limit, offset])

    rows = query(f"""
        SELECT m.match_id, m.season, m.date, m.city, m.venue,
               m.team1, m.team2, m.toss_winner, m.toss_decision,
               m.winner, m.win_by_runs, m.win_by_wickets, m.result,
               m.player_of_match
        FROM matches m
        {where}
        ORDER BY m.date DESC
        LIMIT ? OFFSET ?
    """, params)

    total = query(f"SELECT COUNT(*) AS cnt FROM matches m {where}", params[:-2])

    # Normalize team names in output
    for row in rows:
        for key in ("team1", "team2", "winner", "toss_winner"):
            if row.get(key):
                row[key] = normalize_team(row[key])

    return {"total": total[0]["cnt"], "matches": rows}


@router.get("/{match_id}")
def match_detail(match_id: str):
    # Match info
    info = query("SELECT * FROM matches WHERE match_id = ?", [match_id])
    if not info:
        raise HTTPException(404, "Match not found")
    info = info[0]
    for key in ("team1", "team2", "winner", "toss_winner"):
        if info.get(key):
            info[key] = normalize_team(info[key])

    # Innings summary
    innings_summary = query("""
        SELECT innings_number, batting_team, bowling_team,
               total_runs, total_wickets, total_balls
        FROM innings
        WHERE match_id = ? AND is_super_over = false
        ORDER BY innings_number
    """, [match_id])

    # Batting scorecards
    batting = query("""
        SELECT innings_number, batter,
               SUM(runs_batter) AS runs,
               COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS balls,
               SUM(CASE WHEN runs_batter = 4 AND extras_wides = 0 AND extras_noballs = 0 THEN 1 ELSE 0 END) AS fours,
               SUM(CASE WHEN runs_batter = 6 AND extras_wides = 0 AND extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes,
               ROUND(SUM(runs_batter) * 100.0 / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END), 0), 2) AS strike_rate,
               MAX(CASE WHEN is_wicket AND player_dismissed = batter THEN dismissal_kind END) AS dismissal,
               MAX(CASE WHEN is_wicket AND player_dismissed = batter THEN bowler END) AS dismissed_by,
               MAX(CASE WHEN is_wicket AND player_dismissed = batter THEN fielder1 END) AS fielder
        FROM deliveries
        WHERE match_id = ? AND is_super_over = false
        GROUP BY innings_number, batter
        ORDER BY innings_number, MIN(over_number * 10 + ball_number)
    """, [match_id])

    # Bowling scorecards
    bowling = query("""
        WITH bowling_data AS (
            SELECT innings_number, bowler,
                   SUM(runs_batter + extras_wides + extras_noballs) AS runs_conceded,
                   SUM(CASE WHEN is_wicket AND dismissal_kind NOT IN ('run out', 'retired hurt', 'retired out', 'obstructing the field') THEN 1 ELSE 0 END) AS wickets,
                   COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS legal_balls,
                   COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 AND runs_batter = 0 AND runs_extras = 0 THEN 1 END) AS dots
            FROM deliveries
            WHERE match_id = ? AND is_super_over = false
            GROUP BY innings_number, bowler
        ),
        maiden_overs AS (
            SELECT innings_number, bowler, over_number,
                   SUM(runs_batter + extras_wides + extras_noballs) AS over_runs
            FROM deliveries
            WHERE match_id = ? AND is_super_over = false
            GROUP BY innings_number, bowler, over_number
            HAVING SUM(runs_batter + extras_wides + extras_noballs) = 0
        ),
        maiden_counts AS (
            SELECT innings_number, bowler, COUNT(*) AS maidens
            FROM maiden_overs
            GROUP BY innings_number, bowler
        )
        SELECT b.innings_number, b.bowler,
               CONCAT(CAST(b.legal_balls AS INTEGER) // 6, '.', CAST(b.legal_balls AS INTEGER) % 6) AS overs,
               COALESCE(mc.maidens, 0) AS maidens,
               b.runs_conceded,
               b.wickets,
               ROUND(b.runs_conceded * 6.0 / NULLIF(b.legal_balls, 0), 2) AS economy
        FROM bowling_data b
        LEFT JOIN maiden_counts mc ON b.innings_number = mc.innings_number AND b.bowler = mc.bowler
        ORDER BY b.innings_number, MIN(b.legal_balls) OVER (PARTITION BY b.innings_number ORDER BY b.bowler)
    """, [match_id, match_id])

    # Partnerships
    partnerships = query("""
        WITH numbered AS (
            SELECT innings_number, over_number, ball_number, batter, non_striker,
                   runs_total, is_wicket, player_dismissed,
                   extras_wides, extras_noballs,
                   COALESCE(SUM(CASE WHEN is_wicket THEN 1 ELSE 0 END)
                       OVER (PARTITION BY innings_number ORDER BY over_number, ball_number
                             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS wicket_num
            FROM deliveries
            WHERE match_id = ? AND is_super_over = false
        ),
        partnership_players AS (
            SELECT innings_number, wicket_num,
                   SUM(runs_total) AS runs,
                   COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS balls,
                   MIN(batter) AS batter1,
                   MAX(batter) AS batter2_candidate,
                   MIN(non_striker) AS ns1,
                   MAX(non_striker) AS ns2
            FROM numbered
            GROUP BY innings_number, wicket_num
        )
        SELECT innings_number,
               wicket_num AS partnership_number,
               batter1 || ' & ' || CASE WHEN batter2_candidate != batter1 THEN batter2_candidate
                                        WHEN ns1 != batter1 THEN ns1
                                        ELSE ns2 END AS pair,
               runs, balls
        FROM partnership_players
        ORDER BY innings_number, partnership_number
    """, [match_id])

    # Over-by-over data for manhattan/worm
    overs_data = query("""
        SELECT innings_number, over_number,
               SUM(runs_total) AS runs,
               SUM(CASE WHEN is_wicket THEN 1 ELSE 0 END) AS wickets,
               SUM(SUM(runs_total)) OVER (PARTITION BY innings_number ORDER BY over_number) AS cumulative_runs
        FROM deliveries
        WHERE match_id = ? AND is_super_over = false
        GROUP BY innings_number, over_number
        ORDER BY innings_number, over_number
    """, [match_id])

    # Fall of wickets
    fow = query("""
        WITH ball_scores AS (
            SELECT innings_number, over_number, ball_number,
                   player_dismissed, bowler, dismissal_kind,
                   SUM(runs_total) OVER (PARTITION BY innings_number
                       ORDER BY over_number, ball_number
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS total_at_dismissal,
                   SUM(CASE WHEN is_wicket THEN 1 ELSE 0 END) OVER (PARTITION BY innings_number
                       ORDER BY over_number, ball_number
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS wicket_number
            FROM deliveries
            WHERE match_id = ? AND is_super_over = false
        )
        SELECT innings_number, wicket_number, player_dismissed, dismissal_kind,
               total_at_dismissal AS score,
               CONCAT(over_number, '.', ball_number) AS over_ball
        FROM ball_scores
        WHERE player_dismissed IS NOT NULL
        ORDER BY innings_number, wicket_number
    """, [match_id])

    # Normalize team names in innings
    for inn in innings_summary:
        for key in ("batting_team", "bowling_team"):
            if inn.get(key):
                inn[key] = normalize_team(inn[key])

    # Organize by innings
    scorecards = []
    for inn in innings_summary:
        inn_num = inn["innings_number"]
        scorecards.append({
            "innings_number": inn_num,
            "batting_team": inn["batting_team"],
            "bowling_team": inn["bowling_team"],
            "total_runs": inn["total_runs"],
            "total_wickets": inn["total_wickets"],
            "total_balls": inn["total_balls"],
            "batting": [b for b in batting if b["innings_number"] == inn_num],
            "bowling": [b for b in bowling if b["innings_number"] == inn_num],
            "partnerships": [p for p in partnerships if p["innings_number"] == inn_num],
            "fall_of_wickets": [f for f in fow if f["innings_number"] == inn_num],
        })

    return {
        "info": info,
        "scorecards": scorecards,
        "overs_data": overs_data,
    }


@router.get("/{match_id}/win-probability")
def win_probability(match_id: str):
    """Ball-by-ball win probability for 2nd innings using a simple model."""
    # Get target (1st innings total)
    innings_info = query("""
        SELECT innings_number, total_runs
        FROM innings
        WHERE match_id = ? AND is_super_over = false
        ORDER BY innings_number
    """, [match_id])

    if len(innings_info) < 2:
        raise HTTPException(400, "Match does not have two innings")

    target = innings_info[0]["total_runs"] + 1  # runs needed to win

    # Get 2nd innings ball-by-ball
    balls = query("""
        SELECT over_number, ball_number, runs_total, is_wicket,
               extras_wides, extras_noballs
        FROM deliveries
        WHERE match_id = ? AND innings_number = 2 AND is_super_over = false
        ORDER BY over_number, ball_number
    """, [match_id])

    if not balls:
        return {"target": target, "probabilities": []}

    cumulative_runs = 0
    wickets_fallen = 0
    legal_balls = 0
    probabilities = []

    for ball in balls:
        cumulative_runs += ball["runs_total"]
        if ball["is_wicket"]:
            wickets_fallen += 1
        if ball["extras_wides"] == 0 and ball["extras_noballs"] == 0:
            legal_balls += 1

        runs_needed = target - cumulative_runs
        balls_remaining = 120 - legal_balls
        wickets_in_hand = 10 - wickets_fallen

        if runs_needed <= 0:
            win_prob = 1.0
        elif balls_remaining <= 0 or wickets_in_hand <= 0:
            win_prob = 0.0
        else:
            # Simple model: probability based on required run rate vs resources
            required_rr = runs_needed * 6.0 / balls_remaining
            # Resource factor: wickets in hand matter
            resource_factor = wickets_in_hand / 10.0
            # Expected run rate ~8.0 in T20s
            expected_rr = 8.0 * resource_factor
            # Sigmoid-like probability
            ratio = expected_rr / max(required_rr, 0.1)
            win_prob = min(max(ratio / (1 + ratio), 0.01), 0.99)

        probabilities.append({
            "over_number": ball["over_number"],
            "ball_number": ball["ball_number"],
            "legal_ball": legal_balls,
            "runs_scored": cumulative_runs,
            "runs_needed": max(runs_needed, 0),
            "balls_remaining": max(balls_remaining, 0),
            "wickets_in_hand": wickets_in_hand,
            "win_probability": round(win_prob, 4),
        })

    return {"target": target, "probabilities": probabilities}
