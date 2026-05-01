"""Venue endpoints: list, stats, top performers."""

from fastapi import APIRouter
from ..database import query, normalize_venue, VENUE_NAME_MAP, VENUE_NORM_SQL

router = APIRouter(prefix="/api/venues", tags=["venues"])


def _venue_variants(name):
    """Return all raw venue names that map to the same canonical name."""
    canonical = normalize_venue(name)
    variants = set()
    for raw, norm in VENUE_NAME_MAP.items():
        if norm == canonical:
            variants.add(raw)
    # Also add the name itself (in case it's not in the map)
    variants.add(name)
    variants.add(canonical)
    return list(variants)


@router.get("")
def list_venues():
    rows = query(f"""
        SELECT ({VENUE_NORM_SQL}) AS venue,
               MAX(city) AS city,
               COUNT(*) AS matches
        FROM matches
        GROUP BY ({VENUE_NORM_SQL})
        ORDER BY matches DESC
    """)
    return rows


@router.get("/{venue_name}/stats")
def venue_stats(venue_name: str):
    variants = _venue_variants(venue_name)
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
            ROUND(AVG(CASE WHEN innings_number = 1 THEN total_runs END), 2) AS avg_1st_innings,
            ROUND(AVG(CASE WHEN innings_number = 2 THEN total_runs END), 2) AS avg_2nd_innings,
            MAX(total_runs) AS highest_total,
            MIN(total_runs) AS lowest_total,
            ROUND(AVG(total_runs), 2) AS avg_score,
            ROUND(AVG(total_wickets), 2) AS avg_wickets,
            ROUND(SUM(CASE WHEN innings_number = 1 AND batting_team = winner THEN 1 ELSE 0 END) * 100.0
                / NULLIF(COUNT(DISTINCT match_id), 0), 2) AS bat_first_win_pct,
            ROUND(SUM(CASE WHEN toss_winner = winner THEN 1 ELSE 0 END) * 100.0
                / NULLIF(COUNT(DISTINCT CASE WHEN result = 'win' THEN match_id END) * 2, 0), 2) AS toss_win_pct
        FROM venue_data
    """, variants)

    # Season-wise at this venue
    season_stats = query(f"""
        SELECT m.season, COUNT(DISTINCT m.match_id) AS matches,
               ROUND(AVG(i.total_runs), 2) AS avg_score
        FROM matches m
        JOIN innings i ON m.match_id = i.match_id
        WHERE m.venue IN ({ph}) AND i.is_super_over = false
        GROUP BY m.season
        ORDER BY m.season
    """, variants)

    # Team-wise performance at this venue
    team_stats = query(f"""
        WITH team_matches AS (
            SELECT team, COUNT(*) AS matches,
                   SUM(CASE WHEN winner = team THEN 1 ELSE 0 END) AS wins
            FROM (
                SELECT team1 AS team, winner, venue FROM matches
                UNION ALL
                SELECT team2 AS team, winner, venue FROM matches
            ) combined
            WHERE venue IN ({ph})
            GROUP BY team
        )
        SELECT team, matches, wins,
               ROUND(wins * 100.0 / matches, 2) AS win_pct
        FROM team_matches
        ORDER BY matches DESC
    """, variants)

    # Scoring Patterns (Buckets)
    scoring_patterns = query(f"""
        SELECT
            SUM(CASE WHEN total_runs < 150 THEN 1 ELSE 0 END) AS low_scores,
            SUM(CASE WHEN total_runs BETWEEN 150 AND 179 THEN 1 ELSE 0 END) AS medium_scores,
            SUM(CASE WHEN total_runs BETWEEN 180 AND 199 THEN 1 ELSE 0 END) AS high_scores,
            SUM(CASE WHEN total_runs >= 200 THEN 1 ELSE 0 END) AS massive_scores
        FROM innings
        WHERE match_id IN (SELECT match_id FROM matches WHERE venue IN ({ph}))
          AND innings_number <= 2 AND is_super_over = false
    """, variants)

    canonical = normalize_venue(venue_name)
    return {
        "venue": canonical,
        "stats": stats[0] if stats else {},
        "seasons": season_stats,
        "team_performance": team_stats,
        "scoring_patterns": scoring_patterns[0] if scoring_patterns else {},
    }



@router.get("/{venue_name}/top-performers")
def top_performers(venue_name: str):
    variants = _venue_variants(venue_name)
    ph = ", ".join(["?"] * len(variants))

    top_batters = query(f"""
        SELECT d.batter AS player,
               COUNT(DISTINCT d.match_id) AS matches,
               SUM(d.runs_batter) AS runs,
               COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
               ROUND(SUM(d.runs_batter) * 100.0 / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS sr,
               SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS fours,
               SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE m.venue IN ({ph}) AND d.is_super_over = false
        GROUP BY d.batter
        ORDER BY runs DESC
        LIMIT 10
    """, variants)

    top_bowlers = query(f"""
        SELECT d.bowler AS player,
               COUNT(DISTINCT d.match_id) AS matches,
               SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
               COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls,
               SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
               ROUND(SUM(d.runs_batter + d.extras_wides + d.extras_noballs) * 6.0
                   / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS economy
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE m.venue IN ({ph}) AND d.is_super_over = false
        GROUP BY d.bowler
        HAVING COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) >= 30
        ORDER BY wickets DESC
        LIMIT 10
    """, variants)

    return {"top_batters": top_batters, "top_bowlers": top_bowlers}


@router.get("/{venue_name}/image")
def venue_image(venue_name: str):
    """Serve venue image if available, else 404."""
    import os
    from fastapi.responses import FileResponse
    from fastapi import HTTPException
    from ..database import normalize_venue

    canonical = normalize_venue(venue_name)
    # Try exact match, then simplified match (no city)
    images_dir = os.path.join(os.path.dirname(__file__), "..", "venue_images")

    # Clean name for filesystem
    clean_name = canonical.replace(", ", "_").replace(" ", "_")
    simple_name = canonical.split(",")[0].replace(" ", "_")

    for name in [clean_name, simple_name, canonical]:
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            path = os.path.join(images_dir, f"{name}{ext}")
            if os.path.isfile(path):
                media = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}
                return FileResponse(path, media_type=media.get(ext.lstrip("."), "image/jpeg"))

    raise HTTPException(status_code=404, detail="No image available")
