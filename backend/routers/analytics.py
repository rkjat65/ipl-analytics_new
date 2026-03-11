"""
/api/analytics  – aggregate analytics endpoints for the dashboard.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from backend.database import get_db, query

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

Con = Annotated[object, Depends(get_db)]


@router.get("/kpis")
def kpis(con: Con, season: str | None = Query(None)):
    """
    Top-level KPI ribbon for the dashboard:
    total matches, total runs, total wickets, avg 1st-innings score,
    highest team total, most sixes.
    """
    sf = "WHERE m.season = ?" if season else "WHERE 1=1"
    params = [season] if season else []

    return query(
        con,
        f"""
        SELECT
            COUNT(DISTINCT m.match_id)                                          AS total_matches,
            SUM(d.runs_batter)                                                  AS total_runs,
            SUM(d.is_wicket::INT)                                               AS total_wickets,
            ROUND(AVG(i.total_runs) FILTER (WHERE i.innings_number = 1), 1)    AS avg_first_innings_score,
            MAX(i.total_runs)                                                    AS highest_team_total,
            SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END)                 AS total_sixes,
            SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END)                 AS total_fours
        FROM matches m
        JOIN deliveries d ON m.match_id = d.match_id
        JOIN innings i ON m.match_id = i.match_id AND d.innings_number = i.innings_number
        {sf}
          AND NOT d.is_super_over
        """,
        params,
    )


@router.get("/phase")
def phase_analysis(con: Con, season: str | None = Query(None)):
    """
    Run rates and wicket rates split by match phase:
      Powerplay  (overs 0–5)
      Middle     (overs 6–14)
      Death      (overs 15–19)
    Optionally filter by season.
    """
    sf = "AND m.season = ?" if season else ""
    params = [season] if season else []

    return query(
        con,
        f"""
        SELECT
            CASE
                WHEN d.over_number BETWEEN 0  AND 5  THEN 'Powerplay (0-5)'
                WHEN d.over_number BETWEEN 6  AND 14 THEN 'Middle (6-14)'
                WHEN d.over_number BETWEEN 15 AND 19 THEN 'Death (15-19)'
                ELSE 'Other'
            END AS phase,
            COUNT(*) AS balls,
            SUM(d.runs_total) AS runs,
            SUM(d.is_wicket::INT) AS wickets,
            ROUND(SUM(d.runs_total) * 6.0 /
                  NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS run_rate,
            ROUND(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) * 1.0 /
                  NULLIF(SUM(d.is_wicket::INT), 0), 1) AS balls_per_wicket
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE NOT d.is_super_over
          AND d.over_number BETWEEN 0 AND 19
          {sf}
        GROUP BY phase
        ORDER BY MIN(d.over_number)
        """,
        params,
    )


@router.get("/seasons")
def season_trends(con: Con):
    """
    Season-by-season aggregated stats: runs, wickets, avg score,
    run rate, boundary %, NRR proxy.
    """
    return query(
        con,
        """
        SELECT
            m.season,
            COUNT(DISTINCT m.match_id)                                         AS matches,
            SUM(d.runs_batter)                                                 AS total_runs,
            SUM(d.is_wicket::INT)                                              AS total_wickets,
            ROUND(AVG(i.total_runs) FILTER (WHERE i.innings_number = 1), 1)   AS avg_first_innings_score,
            ROUND(SUM(d.runs_total) * 6.0 /
                  NULLIF(COUNT(CASE WHEN d.extras_wides = 0
                                     AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS overall_run_rate,
            ROUND(
                SUM(CASE WHEN d.runs_batter IN (4, 6) THEN d.runs_batter ELSE 0 END) * 100.0 /
                NULLIF(SUM(d.runs_batter), 0),
            1) AS boundary_pct
        FROM matches m
        JOIN deliveries d ON m.match_id = d.match_id
        JOIN innings i ON m.match_id = i.match_id AND d.innings_number = i.innings_number
        WHERE NOT d.is_super_over
        GROUP BY m.season
        ORDER BY MIN(m.date)
        """,
    )


@router.get("/venues")
def venue_stats(con: Con, season: str | None = Query(None)):
    """Stats by venue: avg score, win % batting first."""
    sf = "AND m.season = ?" if season else ""
    params = [season] if season else []

    # Use a per-match CTE to avoid double-counting when joining innings
    return query(
        con,
        f"""
        WITH per_match AS (
            SELECT
                -- Normalize venue: take the part before the first comma to deduplicate
                -- e.g. "Wankhede Stadium, Mumbai" → "Wankhede Stadium"
                TRIM(SPLIT_PART(m.venue, ',', 1)) AS venue,
                COALESCE(m.city, '') AS city,
                m.match_id,
                m.winner,
                m.toss_winner,
                m.toss_decision,
                MAX(i.total_runs) FILTER (WHERE i.innings_number = 1) AS first_inn_runs,
                MAX(i.total_runs) FILTER (WHERE i.innings_number = 2) AS second_inn_runs
            FROM matches m
            JOIN innings i ON m.match_id = i.match_id
            WHERE NOT i.is_super_over
              {sf}
            GROUP BY m.venue, m.city, m.match_id, m.winner, m.toss_winner, m.toss_decision
        )
        SELECT
            venue,
            MAX(city) AS city,
            COUNT(*) AS matches,
            ROUND(AVG(first_inn_runs), 1)  AS avg_first_innings,
            ROUND(AVG(second_inn_runs), 1) AS avg_second_innings,
            ROUND(
                SUM(CASE
                    WHEN toss_decision = 'bat'   AND winner = toss_winner  THEN 1
                    WHEN toss_decision = 'field' AND winner != toss_winner THEN 1
                    ELSE 0
                END) * 100.0 / NULLIF(COUNT(*), 0),
            1) AS bat_first_win_pct
        FROM per_match
        GROUP BY venue
        HAVING COUNT(*) >= 3
        ORDER BY matches DESC
        LIMIT 30
        """,
        params,
    )


@router.get("/teams")
def team_stats(con: Con, season: str | None = Query(None)):
    """
    Team performance: matches, wins, win%, runs scored/conceded,
    toss win%, titles (seasons won).
    """
    sf = "AND season = ?" if season else ""
    params = [season] if season else []

    return query(
        con,
        f"""
        WITH norm AS (
            -- Unify historical name variants into current franchise names
            SELECT
                CASE team
                    WHEN 'Royal Challengers Bangalore' THEN 'Royal Challengers Bengaluru'
                    WHEN 'Delhi Daredevils'            THEN 'Delhi Capitals'
                    WHEN 'Kings XI Punjab'             THEN 'Punjab Kings'
                    WHEN 'Rising Pune Supergiants'     THEN 'Rising Pune Supergiant'
                    ELSE team
                END AS team,
                CASE winner
                    WHEN 'Royal Challengers Bangalore' THEN 'Royal Challengers Bengaluru'
                    WHEN 'Delhi Daredevils'            THEN 'Delhi Capitals'
                    WHEN 'Kings XI Punjab'             THEN 'Punjab Kings'
                    WHEN 'Rising Pune Supergiants'     THEN 'Rising Pune Supergiant'
                    ELSE winner
                END AS winner,
                CASE toss_winner
                    WHEN 'Royal Challengers Bangalore' THEN 'Royal Challengers Bengaluru'
                    WHEN 'Delhi Daredevils'            THEN 'Delhi Capitals'
                    WHEN 'Kings XI Punjab'             THEN 'Punjab Kings'
                    WHEN 'Rising Pune Supergiants'     THEN 'Rising Pune Supergiant'
                    ELSE toss_winner
                END AS toss_winner,
                season
            FROM (
                SELECT team1 AS team, winner, toss_winner, season FROM matches
                UNION ALL
                SELECT team2 AS team, winner, toss_winner, season FROM matches
            ) raw
            WHERE 1=1 {sf}
        )
        SELECT
            team,
            COUNT(*)                                                               AS played,
            SUM(CASE WHEN winner = team THEN 1 ELSE 0 END)                        AS wins,
            ROUND(SUM(CASE WHEN winner = team THEN 1 ELSE 0 END) * 100.0
                  / NULLIF(COUNT(*), 0), 1)                                        AS win_pct,
            SUM(CASE WHEN toss_winner = team THEN 1 ELSE 0 END)                   AS toss_wins,
            ROUND(SUM(CASE WHEN toss_winner = team THEN 1 ELSE 0 END) * 100.0
                  / NULLIF(COUNT(*), 0), 1)                                        AS toss_win_pct
        FROM norm
        GROUP BY team
        ORDER BY win_pct DESC
        """,
        params,
    )


@router.get("/run-rate-progression")
def run_rate_progression(
    con: Con,
    match_id: str = Query(..., description="Match ID to plot run-rate chart for"),
):
    """
    Ball-by-ball cumulative run rate for both innings of a specific match.
    Used to power the run-rate line chart on the match detail page.
    """
    return query(
        con,
        """
        WITH ball_data AS (
            SELECT
                innings_number,
                over_number,
                ball_number,
                runs_total,
                is_wicket,
                ROW_NUMBER() OVER (
                    PARTITION BY innings_number
                    ORDER BY over_number, ball_number
                ) AS ball_seq
            FROM deliveries
            WHERE match_id = ? AND NOT is_super_over
              AND extras_wides = 0 AND extras_noballs = 0
        )
        SELECT
            innings_number,
            over_number,
            ball_number,
            ball_seq,
            runs_total,
            is_wicket,
            SUM(runs_total) OVER (
                PARTITION BY innings_number
                ORDER BY ball_seq
            ) AS cumulative_runs,
            ROUND(SUM(runs_total) OVER (
                PARTITION BY innings_number
                ORDER BY ball_seq
            ) * 6.0 / NULLIF(ball_seq, 0), 2) AS run_rate
        FROM ball_data
        ORDER BY innings_number, ball_seq
        """,
        [match_id],
    )


@router.get("/dismissal-types")
def dismissal_breakdown(con: Con, season: str | None = Query(None)):
    """Distribution of all dismissal types across the dataset."""
    sf = "AND m.season = ?" if season else ""
    params = [season] if season else []

    return query(
        con,
        f"""
        SELECT
            d.dismissal_kind,
            COUNT(*) AS count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.is_wicket AND NOT d.is_super_over
          {sf}
        GROUP BY d.dismissal_kind
        ORDER BY count DESC
        """,
        params,
    )


@router.get("/powerplay-kings")
def powerplay_kings(
    con: Con,
    role: str = Query("bat", description="'bat' or 'bowl'"),
    season: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Top performers specifically in the Powerplay (overs 0-5)."""
    sf = "AND m.season = ?" if season else ""
    base_params = [season] if season else []

    if role == "bat":
        return query(
            con,
            f"""
            SELECT
                d.batter AS name,
                SUM(d.runs_batter) AS runs,
                COUNT(*) AS balls,
                ROUND(SUM(d.runs_batter) * 100.0 / NULLIF(COUNT(*), 0), 2) AS strike_rate,
                SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) AS sixes
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.over_number BETWEEN 0 AND 5
              AND NOT d.is_super_over
              {sf}
            GROUP BY d.batter
            HAVING COUNT(*) >= 30
            ORDER BY strike_rate DESC
            LIMIT ?
            """,
            base_params + [limit],
        )
    else:
        return query(
            con,
            f"""
            SELECT
                d.bowler AS name,
                COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls,
                SUM(d.runs_total) AS runs,
                SUM(CASE WHEN d.is_wicket
                          AND d.dismissal_kind NOT IN (
                              'run out','obstructing the field','retired hurt','retired out'
                          ) THEN 1 ELSE 0 END) AS wickets,
                ROUND(SUM(d.runs_total) * 6.0 /
                      NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS economy
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.over_number BETWEEN 0 AND 5
              AND NOT d.is_super_over
              {sf}
            GROUP BY d.bowler
            HAVING COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) >= 30
            ORDER BY economy
            LIMIT ?
            """,
            base_params + [limit],
        )
