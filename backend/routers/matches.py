"""
/api/matches  – match listings, detail, and scorecards.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from backend.database import get_db, query

router = APIRouter(prefix="/api/matches", tags=["Matches"])

Con = Annotated[object, Depends(get_db)]


@router.get("")
def list_matches(
    con: Con,
    season: str | None = Query(None, description="e.g. '2016' or '2007/08'"),
    team: str | None = Query(None, description="Filter by team name (either side)"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Paginated match list, newest first.
    Optional filters: season, team.
    """
    filters = ["1=1"]
    params: list = []

    if season:
        filters.append("season = ?")
        params.append(season)
    if team:
        filters.append("(team1 = ? OR team2 = ?)")
        params.extend([team, team])

    where = " AND ".join(filters)
    params.extend([limit, offset])

    rows = query(
        con,
        f"""
        SELECT
            match_id,
            season,
            date,
            venue,
            city,
            team1,
            team2,
            toss_winner,
            toss_decision,
            winner,
            win_by_runs,
            win_by_wickets,
            result,
            player_of_match
        FROM matches
        WHERE {where}
        ORDER BY date DESC
        LIMIT ? OFFSET ?
        """,
        params,
    )

    total = query(
        con,
        f"SELECT COUNT(*) AS n FROM matches WHERE {where}",
        params[:-2],
    )[0]["n"]

    return {"total": total, "limit": limit, "offset": offset, "data": rows}


@router.get("/seasons")
def list_seasons(con: Con):
    """All distinct seasons in the database, newest first."""
    return query(
        con,
        """
        SELECT season, COUNT(*) AS matches
        FROM matches
        GROUP BY season
        ORDER BY MIN(date) DESC
        """,
    )


@router.get("/{team1}/vs/{team2}")
def team_head_to_head(
    team1: str,
    team2: str,
    con: Con,
    season: str | None = Query(None, description="Optional: filter by season"),
):
    """
    Head-to-head match statistics between two teams.
    Returns overall record, performance metrics, and recent matches.
    """
    season_filter = "AND season = ?" if season else ""
    season_param = [season] if season else []

    # Total head-to-head record
    record = query(
        con,
        f"""
        SELECT
            COUNT(*) AS total_matches,
            SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) AS team1_wins,
            SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) AS team2_wins,
            SUM(CASE WHEN winner IS NULL OR winner NOT IN (?, ?) THEN 1 ELSE 0 END) AS ties
        FROM matches
        WHERE (team1 = ? AND team2 = ?) OR (team1 = ? AND team2 = ?)
        {season_filter}
        """,
        [team1, team2, team1, team2, team1, team2, team2, team1] + season_param,
    )

    record_data = record[0] if record else {}
    
    # Calculate win percentage
    total = record_data.get("total_matches") or 0
    team1_wins = record_data.get("team1_wins") or 0
    if total > 0:
        record_data["team1_win_pct"] = round((team1_wins / total) * 100, 2)
    else:
        record_data["team1_win_pct"] = 0

    # Last 5 matches between them
    recent_matches = query(
        con,
        f"""
        SELECT
            match_id, season, date, venue,
            team1, team2, winner, result,
            toss_winner, toss_decision
        FROM matches
        WHERE (team1 = ? AND team2 = ?) OR (team1 = ? AND team2 = ?)
        {season_filter}
        ORDER BY date DESC
        LIMIT 5
        """,
        [team1, team2, team2, team1] + season_param,
    )

    return {
        "team1": team1,
        "team2": team2,
        "record": record_data,
        "recent_matches": recent_matches,
        "season_filter": season,
    }


@router.get("/{match_id}")
def match_detail(match_id: str, con: Con):
    """Full match detail including per-innings scorecard."""
    match = query(
        con,
        "SELECT * FROM matches WHERE match_id = ?",
        [match_id],
    )
    if not match:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Match not found")

    innings = query(
        con,
        """
        SELECT
            i.innings_number, i.is_super_over, i.batting_team, i.bowling_team,
            i.total_runs, i.total_wickets, i.total_balls,
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls
        FROM innings i
        JOIN deliveries d ON i.match_id = d.match_id AND i.innings_number = d.innings_number
        WHERE i.match_id = ?
        GROUP BY i.innings_number, i.is_super_over, i.batting_team, i.bowling_team,
                 i.total_runs, i.total_wickets, i.total_balls
        ORDER BY i.innings_number
        """,
        [match_id],
    )

    # Top scorers per innings
    batting = query(
        con,
        """
        SELECT
            innings_number,
            batter,
            SUM(runs_batter)  AS runs,
            COUNT(*)           AS balls,
            SUM(CASE WHEN runs_batter = 4 THEN 1 ELSE 0 END) AS fours,
            SUM(CASE WHEN runs_batter = 6 THEN 1 ELSE 0 END) AS sixes,
            ROUND(SUM(runs_batter) * 100.0 / NULLIF(COUNT(*), 0), 2) AS strike_rate,
            MAX(CASE WHEN is_wicket AND player_dismissed = batter THEN dismissal_kind END) AS dismissed_by
        FROM deliveries
        WHERE match_id = ?
        GROUP BY innings_number, batter
        ORDER BY innings_number, runs DESC
        """,
        [match_id],
    )

    # Bowling figures per innings
    bowling = query(
        con,
        """
        SELECT
            innings_number,
            bowler,
            COUNT(CASE WHEN NOT is_super_over THEN 1 END)                   AS balls,
            SUM(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 ELSE 0 END) AS legal_balls,
            SUM(runs_total)                                                  AS runs_conceded,
            SUM(CASE WHEN is_wicket
                      AND dismissal_kind NOT IN ('run out','obstructing the field','retired hurt','retired out')
                      THEN 1 ELSE 0 END)                                    AS wickets,
            ROUND(SUM(runs_total) * 6.0 /
                  NULLIF(SUM(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 ELSE 0 END), 0), 2) AS economy
        FROM deliveries
        WHERE match_id = ?
        GROUP BY innings_number, bowler
        ORDER BY innings_number, wickets DESC, runs_conceded
        """,
        [match_id],
    )

    # Over-by-over run progression
    over_progression = query(
        con,
        """
        SELECT
            innings_number,
            over_number,
            SUM(runs_total)   AS runs_in_over,
            SUM(is_wicket::INT) AS wickets_in_over,
            SUM(SUM(runs_total)) OVER (
                PARTITION BY innings_number
                ORDER BY over_number
            ) AS cumulative_runs
        FROM deliveries
        WHERE match_id = ? AND NOT is_super_over
        GROUP BY innings_number, over_number
        ORDER BY innings_number, over_number
        """,
        [match_id],
    )

    return {
        "match": match[0],
        "innings": innings,
        "batting": batting,
        "bowling": bowling,
        "over_progression": over_progression,
    }
