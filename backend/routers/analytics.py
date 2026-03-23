"""Analytics endpoints: KPIs, phase stats, venues, toss impact."""

from fastapi import APIRouter, Query
from ..database import query, normalize_team

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _season_filter(table_alias: str, season: str | None) -> tuple[str, list]:
    if not season:
        return "", []
    # Support comma-separated seasons (e.g. "2020,2021,2022")
    parts = [s.strip() for s in season.split(",") if s.strip()]
    if len(parts) == 1:
        return f" AND {table_alias}.season = ?", [parts[0]]
    ph = ", ".join(["?"] * len(parts))
    return f" AND {table_alias}.season IN ({ph})", parts


@router.get("/kpis")
def dashboard_kpis(season: str | None = None):
    sf_m, sp_m = _season_filter("m", season)

    total_matches = query(f"SELECT COUNT(*) AS v FROM matches m WHERE 1=1 {sf_m}", sp_m)

    runs_wickets = query(f"""
        SELECT SUM(d.runs_total) AS total_runs,
               SUM(CASE WHEN d.is_wicket THEN 1 ELSE 0 END) AS total_wickets,
               SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) +
               SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS total_boundaries,
               SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS total_sixes
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.is_super_over = false {sf_m}
    """, sp_m[:])

    avg_score = query(f"""
        SELECT ROUND(AVG(i.total_runs), 2) AS avg_score
        FROM innings i
        JOIN matches m ON i.match_id = m.match_id
        WHERE i.is_super_over = false {sf_m}
    """, sp_m[:])

    highest = query(f"""
        SELECT i.batting_team, i.total_runs, m.match_id, m.date
        FROM innings i
        JOIN matches m ON i.match_id = m.match_id
        WHERE i.is_super_over = false {sf_m}
        ORDER BY i.total_runs DESC
        LIMIT 1
    """, sp_m[:])

    most_sixes = query(f"""
        SELECT d.batter AS player, SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.is_super_over = false {sf_m}
        GROUP BY d.batter
        ORDER BY sixes DESC
        LIMIT 1
    """, sp_m[:])

    return {
        "total_matches": total_matches[0]["v"],
        **runs_wickets[0],
        "avg_score": avg_score[0]["avg_score"],
        "highest_total": highest[0] if highest else None,
        "most_sixes_player": most_sixes[0] if most_sixes else None,
    }


@router.get("/phase-stats")
def phase_stats(season: str | None = None):
    sf, sp = _season_filter("m", season)

    rows = query(f"""
        SELECT
            CASE
                WHEN d.over_number <= 5 THEN 'powerplay'
                WHEN d.over_number <= 14 THEN 'middle'
                ELSE 'death'
            END AS phase,
            ROUND(SUM(d.runs_total) * 1.0 / COUNT(DISTINCT d.match_id || '-' || d.innings_number), 2) AS avg_runs,
            ROUND(SUM(CASE WHEN d.is_wicket THEN 1 ELSE 0 END) * 1.0 / COUNT(DISTINCT d.match_id || '-' || d.innings_number), 2) AS avg_wickets,
            ROUND(SUM(d.runs_total) * 6.0 / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS run_rate,
            ROUND((SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) + SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END)) * 100.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS boundary_pct
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.is_super_over = false {sf}
        GROUP BY phase
        ORDER BY CASE phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 ELSE 3 END
    """, sp)
    return rows


@router.get("/venues")
def venue_stats(season: str | None = None):
    sf, sp = _season_filter("m", season)

    rows = query(f"""
        WITH venue_innings AS (
            SELECT m.venue, i.innings_number, i.total_runs, i.batting_team, m.winner, m.match_id,
                   m.toss_winner, m.toss_decision
            FROM innings i
            JOIN matches m ON i.match_id = m.match_id
            WHERE i.is_super_over = false {sf}
        ),
        venue_agg AS (
            SELECT venue,
                   COUNT(DISTINCT match_id) AS matches,
                   ROUND(AVG(CASE WHEN innings_number = 1 THEN total_runs END), 2) AS avg_1st_innings,
                   ROUND(AVG(CASE WHEN innings_number = 2 THEN total_runs END), 2) AS avg_2nd_innings,
                   MAX(total_runs) AS highest_total,
                   ROUND(SUM(CASE WHEN innings_number = 1 AND batting_team = winner THEN 1 ELSE 0 END) * 100.0
                       / NULLIF(COUNT(DISTINCT match_id), 0), 2) AS bat_first_win_pct
            FROM venue_innings
            GROUP BY venue
        )
        SELECT * FROM venue_agg
        ORDER BY matches DESC
    """, sp)

    # Top performer per venue
    top_perf = query(f"""
        WITH batter_venue AS (
            SELECT m.venue, d.batter, SUM(d.runs_batter) AS runs
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.is_super_over = false {sf}
            GROUP BY m.venue, d.batter
        ),
        ranked AS (
            SELECT venue, batter, runs,
                   ROW_NUMBER() OVER (PARTITION BY venue ORDER BY runs DESC) AS rn
            FROM batter_venue
        )
        SELECT venue, batter AS top_performer, runs AS top_performer_runs
        FROM ranked WHERE rn = 1
    """, sp)

    perf_map = {r["venue"]: {"top_performer": r["top_performer"], "top_performer_runs": r["top_performer_runs"]} for r in top_perf}
    for row in rows:
        p = perf_map.get(row["venue"], {})
        row["top_performer"] = p.get("top_performer")
        row["top_performer_runs"] = p.get("top_performer_runs")

    return rows


@router.get("/toss-impact")
def toss_impact(season: str | None = None):
    sf, sp = _season_filter("m", season)

    rows = query(f"""
        SELECT m.venue,
               m.toss_decision,
               COUNT(*) AS matches,
               SUM(CASE WHEN m.toss_winner = m.winner THEN 1 ELSE 0 END) AS toss_winner_wins,
               ROUND(SUM(CASE WHEN m.toss_winner = m.winner THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS toss_win_pct
        FROM matches m
        WHERE m.result = 'win' {sf}
        GROUP BY m.venue, m.toss_decision
        ORDER BY m.venue, m.toss_decision
    """, sp)
    return rows


@router.get("/top-totals")
def top_totals(season: str | None = None):
    sf, sp = _season_filter("m", season)
    rows = query(f"""
        SELECT i.batting_team, i.total_runs, m.match_id, m.date,
               CASE WHEN i.batting_team = m.team1 THEN m.team2 ELSE m.team1 END AS opponent,
               m.venue
        FROM innings i
        JOIN matches m ON i.match_id = m.match_id
        WHERE i.is_super_over = false {sf}
        ORDER BY i.total_runs DESC
        LIMIT 10
    """, sp)
    return rows


@router.get("/top-sixes")
def top_sixes(season: str | None = None):
    sf, sp = _season_filter("m", season)
    rows = query(f"""
        SELECT d.batter AS player,
               SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes,
               COUNT(DISTINCT d.match_id) AS matches,
               SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS fours
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.is_super_over = false {sf}
        GROUP BY d.batter
        ORDER BY sixes DESC
        LIMIT 10
    """, sp)
    return rows


@router.get("/top-fours")
def top_fours(season: str | None = None):
    sf, sp = _season_filter("m", season)
    rows = query(f"""
        SELECT d.batter AS player,
               SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS fours,
               COUNT(DISTINCT d.match_id) AS matches,
               SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.is_super_over = false {sf}
        GROUP BY d.batter
        ORDER BY fours DESC
        LIMIT 10
    """, sp)
    return rows


@router.get("/most-wins")
def most_wins(season: str | None = None):
    sf, sp = _season_filter("m", season)
    rows = query(f"""
        SELECT m.winner AS team,
               COUNT(*) AS wins,
               (SELECT COUNT(*) FROM matches m2
                WHERE (m2.team1 = m.winner OR m2.team2 = m.winner)
                  AND m2.result IS NOT NULL
                  {sf.replace('m.season', 'm2.season')}) AS matches
        FROM matches m
        WHERE m.winner IS NOT NULL {sf}
        GROUP BY m.winner
        ORDER BY wins DESC
    """, sp + sp)

    # Merge rows that map to the same normalized team name
    merged: dict[str, dict] = {}
    for row in rows:
        key = normalize_team(row["team"])
        if key in merged:
            merged[key]["wins"] += row["wins"]
            merged[key]["matches"] += row["matches"]
        else:
            merged[key] = {"team": key, "wins": row["wins"], "matches": row["matches"]}

    result = sorted(merged.values(), key=lambda r: r["wins"], reverse=True)
    for r in result:
        r["win_pct"] = round(r["wins"] * 100.0 / r["matches"], 2) if r["matches"] else 0
    return result


@router.get("/title-winners")
def title_winners():
    rows = query("""
        WITH season_finals AS (
            SELECT season, MAX(date) AS final_date
            FROM matches GROUP BY season
        )
        SELECT m.season, m.winner
        FROM matches m
        JOIN season_finals sf ON m.season = sf.season AND m.date = sf.final_date
        WHERE m.winner IS NOT NULL
        ORDER BY m.season
    """)
    for row in rows:
        row["winner"] = normalize_team(row["winner"])
    return rows
