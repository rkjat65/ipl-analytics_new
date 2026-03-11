"""
/api/players  – player search, career stats, head-to-head.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.database import get_db, query

router = APIRouter(prefix="/api/players", tags=["Players"])

Con = Annotated[object, Depends(get_db)]


@router.get("")
def search_players(
    con: Con,
    q: str = Query("", description="Partial name search"),
    limit: int = Query(20, ge=1, le=100),
):
    """Search players by name (case-insensitive, partial match)."""
    return query(
        con,
        """
        SELECT DISTINCT batter AS name
        FROM deliveries
        WHERE LOWER(batter) LIKE LOWER(?)
        ORDER BY name
        LIMIT ?
        """,
        [f"%{q}%", limit],
    )


@router.get("/leaderboard")
def batting_leaderboard(
    con: Con,
    season: str | None = Query(None),
    min_innings: int = Query(10, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Batting leaderboard: runs, average, strike rate, 50s, 100s.
    Excludes Super Over deliveries to match official statistics.
    """
    season_filter = "AND m.season = ?" if season else ""
    params = [season, min_innings, limit] if season else [min_innings, limit]

    return query(
        con,
        f"""
        WITH innings_scores AS (
            SELECT
                d.batter,
                d.match_id,
                d.innings_number,
                SUM(d.runs_batter)  AS runs,
                COUNT(*)             AS balls,
                MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_dismissed
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE NOT d.is_super_over
              {season_filter}
            GROUP BY d.batter, d.match_id, d.innings_number
        )
        SELECT
            batter AS name,
            COUNT(*)                                              AS innings,
            SUM(runs)                                            AS runs,
            MAX(runs)                                            AS highest_score,
            ROUND(SUM(runs) * 1.0 / NULLIF(SUM(was_dismissed), 0), 2) AS average,
            ROUND(SUM(runs) * 100.0 / NULLIF(SUM(balls), 0), 2) AS strike_rate,
            SUM(CASE WHEN runs >= 50 AND runs < 100 THEN 1 ELSE 0 END) AS fifties,
            SUM(CASE WHEN runs >= 100 THEN 1 ELSE 0 END)         AS hundreds,
            SUM(CASE WHEN runs = 0 AND was_dismissed = 1 THEN 1 ELSE 0 END) AS ducks
        FROM innings_scores
        GROUP BY batter
        HAVING COUNT(*) >= ?
        ORDER BY runs DESC
        LIMIT ?
        """,
        params,
    )


@router.get("/bowling-leaderboard")
def bowling_leaderboard(
    con: Con,
    season: str | None = Query(None),
    min_overs: int = Query(10, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Bowling leaderboard: wickets, economy, average, strike rate."""
    season_filter = "AND m.season = ?" if season else ""
    params = [season, min_overs, limit] if season else [min_overs, limit]

    return query(
        con,
        f"""
        SELECT
            d.bowler                                                          AS name,
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0
                       THEN 1 END)                                            AS legal_balls,
            CAST(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) / 6 AS INT)
                || '.' ||
            CAST(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) % 6 AS INT)
                                                                              AS overs,
            SUM(d.runs_total)                                                 AS runs_conceded,
            SUM(CASE WHEN d.is_wicket
                      AND d.dismissal_kind NOT IN (
                          'run out','obstructing the field','retired hurt','retired out'
                      ) THEN 1 ELSE 0 END)                                   AS wickets,
            ROUND(SUM(d.runs_total) * 6.0 /
                  NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0
                               THEN 1 END), 0), 2)                           AS economy,
            ROUND(SUM(d.runs_total) * 1.0 /
                  NULLIF(SUM(CASE WHEN d.is_wicket
                                   AND d.dismissal_kind NOT IN (
                                       'run out','obstructing the field','retired hurt','retired out'
                                   ) THEN 1 ELSE 0 END), 0), 2)              AS average,
            ROUND(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0
                            THEN 1 END) * 1.0 /
                  NULLIF(SUM(CASE WHEN d.is_wicket
                                   AND d.dismissal_kind NOT IN (
                                       'run out','obstructing the field','retired hurt','retired out'
                                   ) THEN 1 ELSE 0 END), 0), 2)              AS strike_rate
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE NOT d.is_super_over
          {season_filter}
        GROUP BY d.bowler
        HAVING COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) >= ? * 6
        ORDER BY wickets DESC, economy
        LIMIT ?
        """,
        params,
    )


@router.get("/{name}")
def player_profile(name: str, con: Con, season: str | None = Query(None)):
    """
    Full player profile: career batting + bowling stats, season breakdown,
    and recent form (last 10 innings).
    """
    # Check player exists
    exists = query(
        con,
        """
        SELECT 1 FROM deliveries
        WHERE batter = ? OR bowler = ?
        LIMIT 1
        """,
        [name, name],
    )
    if not exists:
        raise HTTPException(status_code=404, detail=f"Player '{name}' not found")

    season_filter = "AND m.season = ?" if season else ""
    base_params_bat = [name, season] if season else [name]
    base_params_bowl = [name, season] if season else [name]

    # --- Career batting ---
    batting = query(
        con,
        f"""
        WITH innings_scores AS (
            SELECT
                d.match_id,
                d.innings_number,
                m.season,
                m.date,
                SUM(d.runs_batter)  AS runs,
                COUNT(*)             AS balls,
                SUM(CASE WHEN d.runs_batter = 4 THEN 1 ELSE 0 END) AS fours,
                SUM(CASE WHEN d.runs_batter = 6 THEN 1 ELSE 0 END) AS sixes,
                MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_dismissed
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ?
              AND NOT d.is_super_over
              {season_filter}
            GROUP BY d.match_id, d.innings_number, m.season, m.date
        )
        SELECT
            COUNT(*)                                                       AS innings,
            SUM(runs)                                                      AS runs,
            MAX(runs)                                                      AS highest_score,
            ROUND(SUM(runs) * 1.0 / NULLIF(SUM(was_dismissed), 0), 2)    AS average,
            ROUND(SUM(runs) * 100.0 / NULLIF(SUM(balls), 0), 2)          AS strike_rate,
            SUM(balls)                                                     AS balls_faced,
            SUM(fours)                                                     AS fours,
            SUM(sixes)                                                     AS sixes,
            SUM(CASE WHEN runs >= 50 AND runs < 100 THEN 1 ELSE 0 END)   AS fifties,
            SUM(CASE WHEN runs >= 100 THEN 1 ELSE 0 END)                  AS hundreds,
            SUM(CASE WHEN runs = 0 AND was_dismissed = 1 THEN 1 ELSE 0 END) AS ducks
        FROM innings_scores
        """,
        base_params_bat,
    )

    # --- Career bowling ---
    bowling = query(
        con,
        f"""
        SELECT
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
            CAST(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) / 6 AS INT)
                || '.' ||
            CAST(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) % 6 AS INT)
                AS overs,
            SUM(d.runs_total)                                                           AS runs_conceded,
            SUM(CASE WHEN d.is_wicket
                      AND d.dismissal_kind NOT IN (
                          'run out','obstructing the field','retired hurt','retired out'
                      ) THEN 1 ELSE 0 END)                                             AS wickets,
            ROUND(SUM(d.runs_total) * 6.0 /
                  NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS economy,
            ROUND(SUM(d.runs_total) * 1.0 /
                  NULLIF(SUM(CASE WHEN d.is_wicket
                                   AND d.dismissal_kind NOT IN (
                                       'run out','obstructing the field','retired hurt','retired out'
                                   ) THEN 1 ELSE 0 END), 0), 2)                        AS average,
            ROUND(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) * 1.0 /
                  NULLIF(SUM(CASE WHEN d.is_wicket
                                   AND d.dismissal_kind NOT IN (
                                       'run out','obstructing the field','retired hurt','retired out'
                                   ) THEN 1 ELSE 0 END), 0), 2)                        AS strike_rate
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.bowler = ?
          AND NOT d.is_super_over
          {season_filter}
        """,
        base_params_bowl,
    )

    # --- Season-by-season batting ---
    season_batting = query(
        con,
        """
        WITH innings_scores AS (
            SELECT
                m.season,
                m.date,
                d.match_id,
                d.innings_number,
                SUM(d.runs_batter) AS runs,
                COUNT(*) AS balls,
                MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_dismissed
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ? AND NOT d.is_super_over
            GROUP BY m.season, m.date, d.match_id, d.innings_number
        )
        SELECT
            season,
            COUNT(*) AS innings,
            SUM(runs) AS runs,
            MAX(runs) AS highest_score,
            ROUND(SUM(runs) * 1.0 / NULLIF(SUM(was_dismissed), 0), 2) AS average,
            ROUND(SUM(runs) * 100.0 / NULLIF(SUM(balls), 0), 2) AS strike_rate,
            SUM(CASE WHEN runs >= 50 THEN 1 ELSE 0 END) AS fifties_plus
        FROM innings_scores
        GROUP BY season
        ORDER BY MIN(date)
        """,
        [name],
    )

    # --- Season-by-season bowling ---
    season_bowling = query(
        con,
        """
        SELECT
            m.season,
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
            SUM(d.runs_total) AS runs_conceded,
            SUM(CASE WHEN d.is_wicket
                      AND d.dismissal_kind NOT IN (
                          'run out','obstructing the field','retired hurt','retired out'
                      ) THEN 1 ELSE 0 END) AS wickets,
            ROUND(SUM(d.runs_total) * 6.0 /
                  NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS economy
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.bowler = ? AND NOT d.is_super_over
        GROUP BY m.season
        ORDER BY MIN(m.date)
        """,
        [name],
    )

    # --- Recent form: last 10 innings ---
    recent_form = query(
        con,
        """
        WITH innings_scores AS (
            SELECT
                d.match_id,
                m.date,
                m.team1,
                m.team2,
                d.innings_number,
                SUM(d.runs_batter) AS runs,
                COUNT(*) AS balls,
                MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_dismissed,
                MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN d.dismissal_kind END) AS how_out
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ? AND NOT d.is_super_over
            GROUP BY d.match_id, m.date, m.team1, m.team2, d.innings_number
        )
        SELECT * FROM innings_scores
        ORDER BY date DESC
        LIMIT 10
        """,
        [name],
    )

    # --- Dismissal types ---
    dismissals = query(
        con,
        """
        SELECT dismissal_kind, COUNT(*) AS count
        FROM deliveries
        WHERE player_dismissed = ? AND is_wicket AND NOT is_super_over
        GROUP BY dismissal_kind
        ORDER BY count DESC
        """,
        [name],
    )

    # --- Vs teams batting breakdown ---
    vs_teams = query(
        con,
        """
        WITH innings_scores AS (
            SELECT
                CASE WHEN m.team1 = d.batter THEN m.team2
                     ELSE m.team1 END AS opponent,
                d.match_id,
                d.innings_number,
                SUM(d.runs_batter) AS runs,
                COUNT(*) AS balls,
                MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_dismissed
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ? AND NOT d.is_super_over
            GROUP BY opponent, d.match_id, d.innings_number
        )
        SELECT
            opponent,
            COUNT(*) AS innings,
            SUM(runs) AS runs,
            ROUND(SUM(runs) * 1.0 / NULLIF(SUM(was_dismissed), 0), 2) AS average,
            ROUND(SUM(runs) * 100.0 / NULLIF(SUM(balls), 0), 2) AS strike_rate
        FROM innings_scores
        GROUP BY opponent
        ORDER BY runs DESC
        """,
        [name],
    )

    return {
        "name": name,
        "batting": batting[0] if batting else {},
        "bowling": bowling[0] if bowling else {},
        "season_batting": season_batting,
        "season_bowling": season_bowling,
        "recent_form": recent_form,
        "dismissals": dismissals,
        "vs_teams": vs_teams,
    }


@router.get("/{player1}/vs/{player2}")
def head_to_head(player1: str, player2: str, con: Con):
    """
    Head-to-head: player1 as batter vs player2 as bowler, and vice versa.
    """
    def h2h(batter: str, bowler: str):
        return query(
            con,
            """
            SELECT
                ? AS batter,
                ? AS bowler,
                COUNT(*) AS balls,
                SUM(runs_batter) AS runs,
                SUM(CASE WHEN is_wicket AND player_dismissed = ? THEN 1 ELSE 0 END) AS dismissals,
                ROUND(SUM(runs_batter) * 100.0 / NULLIF(COUNT(*), 0), 2) AS strike_rate,
                ROUND(SUM(runs_batter) * 1.0 /
                      NULLIF(SUM(CASE WHEN is_wicket AND player_dismissed = ? THEN 1 ELSE 0 END), 0), 2) AS average
            FROM deliveries
            WHERE batter = ? AND bowler = ? AND NOT is_super_over
            """,
            [batter, bowler, batter, batter, batter, bowler],
        )

    return {
        f"{player1}_vs_{player2}": h2h(player1, player2)[0],
        f"{player2}_vs_{player1}": h2h(player2, player1)[0],
    }
