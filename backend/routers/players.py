"""Player endpoints: batting/bowling leaderboards, profiles, matchups."""

import os
from pathlib import Path
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
from ..database import query, normalize_team, team_variants

PLAYER_IMAGES_DIR = Path(__file__).parent.parent / "player_images"

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("/batting/leaderboard")
def batting_leaderboard(
    season: str | None = None,
    team: str | None = None,
    sort_by: str = Query("runs", pattern="^(runs|avg|sr|fifties|hundreds|sixes|fours|matches)$"),
    limit: int = Query(500, ge=1, le=1000),
    min_balls: int = Query(0, ge=0),
):
    season_filter = ""
    params = []
    if season:
        parts = [s.strip() for s in season.split(",") if s.strip()]
        if len(parts) == 1:
            season_filter += " AND m.season = ?"
            params.append(parts[0])
        else:
            ph = ", ".join(["?"] * len(parts))
            season_filter += f" AND m.season IN ({ph})"
            params.extend(parts)
    if team:
        variants = team_variants(team)
        ph = ", ".join(["?"] * len(variants))
        season_filter += f" AND i.batting_team IN ({ph})"
        params.extend(variants)

    sort_map = {"runs": "runs DESC", "avg": "avg DESC NULLS LAST", "sr": "sr DESC", "fifties": "fifties DESC", "hundreds": "hundreds DESC", "sixes": "sixes DESC", "fours": "fours DESC", "matches": "matches DESC"}
    order = sort_map.get(sort_by, "runs DESC")
    # min_balls and limit params are appended at end of query

    rows = query(f"""
        WITH batting AS (
            SELECT d.batter AS player,
                   d.match_id,
                   SUM(d.runs_batter) AS runs,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
                   SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS fours,
                   SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes,
                   MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_out
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.is_super_over = false {season_filter}
            GROUP BY d.batter, d.match_id
        ),
        agg AS (
            SELECT player,
                   COUNT(DISTINCT match_id) AS matches,
                   COUNT(*) AS innings,
                   SUM(runs) AS runs,
                   MAX(runs) AS highest,
                   SUM(balls) AS balls,
                   SUM(fours) AS fours,
                   SUM(sixes) AS sixes,
                   SUM(was_out) AS dismissals,
                   SUM(CASE WHEN runs >= 50 AND runs < 100 THEN 1 ELSE 0 END) AS fifties,
                   SUM(CASE WHEN runs >= 100 THEN 1 ELSE 0 END) AS hundreds
            FROM batting
            GROUP BY player
        )
        SELECT player, matches, innings, runs, highest, balls, fours, sixes,
               fifties, hundreds,
               ROUND(runs * 1.0 / NULLIF(dismissals, 0), 2) AS avg,
               ROUND(runs * 100.0 / NULLIF(balls, 0), 2) AS sr
        FROM agg
        WHERE balls >= ?
        ORDER BY {order}
        LIMIT ?
    """, params + [min_balls if min_balls > 0 else 1, limit])
    return rows


@router.get("/bowling/leaderboard")
def bowling_leaderboard(
    season: str | None = None,
    team: str | None = None,
    sort_by: str = Query("wickets", pattern="^(wickets|avg|economy|sr|five_wickets|four_wickets|matches)$"),
    limit: int = Query(500, ge=1, le=1000),
    min_balls: int = Query(0, ge=0),
):
    season_filter = ""
    params = []
    if season:
        parts = [s.strip() for s in season.split(",") if s.strip()]
        if len(parts) == 1:
            season_filter += " AND m.season = ?"
            params.append(parts[0])
        else:
            ph = ", ".join(["?"] * len(parts))
            season_filter += f" AND m.season IN ({ph})"
            params.extend(parts)
    if team:
        variants = team_variants(team)
        ph = ", ".join(["?"] * len(variants))
        season_filter += f" AND i.bowling_team IN ({ph})"
        params.extend(variants)

    sort_map = {
        "wickets": "wickets DESC",
        "avg": "avg ASC NULLS LAST",
        "economy": "economy ASC",
        "sr": "sr ASC NULLS LAST",
        "five_wickets": "five_w DESC",
        "four_wickets": "four_w DESC",
        "matches": "matches DESC",
    }
    order = sort_map.get(sort_by, "wickets DESC")
    params.extend([min_balls if min_balls > 0 else 1, limit])

    rows = query(f"""
        WITH bowling_match AS (
            SELECT d.bowler AS player,
                   d.match_id,
                   d.innings_number,
                   SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
                   SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.is_super_over = false {season_filter}
            GROUP BY d.bowler, d.match_id, d.innings_number
        ),
        best AS (
            SELECT player, match_id,
                   CONCAT(wickets, '/', runs_conceded) AS figures,
                   wickets AS fig_w, runs_conceded AS fig_r
            FROM bowling_match
        ),
        agg AS (
            SELECT player,
                   COUNT(DISTINCT match_id) AS matches,
                   COUNT(*) AS innings,
                   SUM(legal_balls) AS total_legal_balls,
                   SUM(runs_conceded) AS total_runs,
                   SUM(wickets) AS wickets
            FROM bowling_match
            GROUP BY player
        ),
        best_fig AS (
            SELECT player,
                   FIRST(figures ORDER BY fig_w DESC, fig_r ASC) AS best_figures
            FROM best
            GROUP BY player
        ),
        spell_wickets AS (
            SELECT player, match_id, wickets
            FROM bowling_match
        ),
        hauls AS (
            SELECT player,
                   SUM(CASE WHEN wickets >= 4 AND wickets < 5 THEN 1 ELSE 0 END) AS four_w,
                   SUM(CASE WHEN wickets >= 5 THEN 1 ELSE 0 END) AS five_w
            FROM spell_wickets
            GROUP BY player
        )
        SELECT a.player, a.matches, a.innings,
               CONCAT(CAST(a.total_legal_balls AS INTEGER) // 6, '.', CAST(a.total_legal_balls AS INTEGER) % 6) AS overs,
               a.wickets,
               ROUND(a.total_runs * 1.0 / NULLIF(a.wickets, 0), 2) AS avg,
               ROUND(a.total_runs * 6.0 / NULLIF(a.total_legal_balls, 0), 2) AS economy,
               ROUND(a.total_legal_balls * 1.0 / NULLIF(a.wickets, 0), 2) AS sr,
               bf.best_figures,
               COALESCE(h.four_w, 0) AS four_w,
               COALESCE(h.five_w, 0) AS five_w
        FROM agg a
        JOIN best_fig bf ON a.player = bf.player
        LEFT JOIN hauls h ON a.player = h.player
        WHERE a.total_legal_balls >= ?
        ORDER BY {order}
        LIMIT ?
    """, params)
    return rows


@router.get("/available-images")
def available_images():
    """Return list of player names that have images uploaded."""
    if not PLAYER_IMAGES_DIR.is_dir():
        return []
    names = set()
    for f in PLAYER_IMAGES_DIR.iterdir():
        if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp') and f.is_file():
            names.add(f.stem)
    return sorted(names)


@router.get("/{player_name}/image")
def player_image(player_name: str):
    """Serve player image if uploaded, else 404."""
    decoded = player_name.strip()
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        path = PLAYER_IMAGES_DIR / f"{decoded}{ext}"
        if path.is_file():
            media = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}
            return FileResponse(path, media_type=media.get(ext.lstrip("."), "image/png"))
    raise HTTPException(status_code=404, detail="No image available")


@router.get("/{name}/batting")
def batting_profile(name: str):
    # Career stats
    career = query("""
        WITH batting AS (
            SELECT d.match_id,
                   SUM(d.runs_batter) AS runs,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
                   SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS fours,
                   SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes,
                   MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_out
            FROM deliveries d
            WHERE d.batter = ? AND d.is_super_over = false
            GROUP BY d.match_id
        )
        SELECT COUNT(DISTINCT match_id) AS matches,
               COUNT(*) AS innings,
               SUM(runs) AS runs,
               MAX(runs) AS highest,
               SUM(balls) AS balls,
               SUM(fours) AS fours,
               SUM(sixes) AS sixes,
               SUM(CASE WHEN runs >= 50 AND runs < 100 THEN 1 ELSE 0 END) AS fifties,
               SUM(CASE WHEN runs >= 100 THEN 1 ELSE 0 END) AS hundreds,
               SUM(was_out) AS dismissals,
               ROUND(SUM(runs) * 1.0 / NULLIF(SUM(was_out), 0), 2) AS avg,
               ROUND(SUM(runs) * 100.0 / NULLIF(SUM(balls), 0), 2) AS sr
        FROM batting
    """, [name])

    if not career or career[0]["matches"] is None or career[0]["matches"] == 0:
        raise HTTPException(404, f"No batting data for {name}")

    # Season-wise
    season_stats = query("""
        WITH batting AS (
            SELECT m.season, i.batting_team AS team, d.match_id,
                   SUM(d.runs_batter) AS runs,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
                   SUM(CASE WHEN d.runs_batter = 4 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS fours,
                   SUM(CASE WHEN d.runs_batter = 6 AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes,
                   MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_out
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            WHERE d.batter = ? AND d.is_super_over = false
            GROUP BY m.season, i.batting_team, d.match_id
        )
        SELECT season, team,
               COUNT(*) AS innings,
               SUM(runs) AS runs,
               MAX(runs) AS highest,
               SUM(balls) AS balls,
               SUM(fours) AS fours,
               SUM(sixes) AS sixes,
               SUM(CASE WHEN runs >= 50 AND runs < 100 THEN 1 ELSE 0 END) AS fifties,
               SUM(CASE WHEN runs >= 100 THEN 1 ELSE 0 END) AS hundreds,
               SUM(was_out) AS dismissals,
               ROUND(SUM(runs) * 1.0 / NULLIF(SUM(was_out), 0), 2) AS avg,
               ROUND(SUM(runs) * 100.0 / NULLIF(SUM(balls), 0), 2) AS sr
        FROM batting
        GROUP BY season, team
        ORDER BY season, team
    """, [name])

    # Phase-wise (0-indexed: PP=0-5, middle=6-14, death=15-19)
    phase_stats = query("""
        SELECT
            CASE
                WHEN over_number <= 5 THEN 'powerplay'
                WHEN over_number <= 14 THEN 'middle'
                ELSE 'death'
            END AS phase,
            SUM(runs_batter) AS runs,
            COUNT(CASE WHEN extras_wides = 0 THEN 1 END) AS balls,
            ROUND(SUM(runs_batter) * 100.0 / NULLIF(COUNT(CASE WHEN extras_wides = 0 THEN 1 END), 0), 2) AS sr,
            SUM(CASE WHEN is_wicket AND player_dismissed = batter THEN 1 ELSE 0 END) AS dismissals,
            SUM(CASE WHEN runs_batter = 4 AND extras_wides = 0 THEN 1 ELSE 0 END) AS fours,
            SUM(CASE WHEN runs_batter = 6 AND extras_wides = 0 THEN 1 ELSE 0 END) AS sixes,
            SUM(CASE WHEN (runs_batter = 4 OR runs_batter = 6) AND extras_wides = 0 THEN 1 ELSE 0 END) AS boundaries,
            ROUND(SUM(runs_batter) * 1.0 / NULLIF(SUM(CASE WHEN is_wicket AND player_dismissed = batter THEN 1 ELSE 0 END), 0), 2) AS avg
        FROM deliveries
        WHERE batter = ? AND is_super_over = false
        GROUP BY phase
        ORDER BY CASE phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 ELSE 3 END
    """, [name])

    # Vs teams
    vs_teams = query("""
        WITH batting AS (
            SELECT i.bowling_team AS opponent, d.match_id,
                   SUM(d.runs_batter) AS runs,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
                   MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_out
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            WHERE d.batter = ? AND d.is_super_over = false
            GROUP BY i.bowling_team, d.match_id
        )
        SELECT opponent,
               COUNT(*) AS innings,
               SUM(runs) AS runs,
               SUM(balls) AS balls,
               SUM(was_out) AS dismissals,
               ROUND(SUM(runs) * 1.0 / NULLIF(SUM(was_out), 0), 2) AS avg,
               ROUND(SUM(runs) * 100.0 / NULLIF(SUM(balls), 0), 2) AS sr
        FROM batting
        GROUP BY opponent
        ORDER BY runs DESC
    """, [name])

    # Recent form (last 10 innings)
    recent = query("""
        WITH batting AS (
            SELECT m.date, m.match_id, i.bowling_team AS opponent,
                   SUM(d.runs_batter) AS runs,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
                   MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_out
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            WHERE d.batter = ? AND d.is_super_over = false
            GROUP BY m.date, m.match_id, i.bowling_team
        )
        SELECT date, match_id, opponent, runs, balls, was_out,
               ROUND(runs * 100.0 / NULLIF(balls, 0), 2) AS sr
        FROM batting
        ORDER BY date DESC
        LIMIT 10
    """, [name])

    # Normalize and merge vs_teams by canonical team name
    merged_vs = {}
    for row in vs_teams:
        opp = normalize_team(row["opponent"])
        if opp in merged_vs:
            m = merged_vs[opp]
            m["innings"] += row["innings"]
            m["runs"] += row["runs"]
            m["balls"] += row["balls"]
            m["dismissals"] += row["dismissals"]
            m["avg"] = round(m["runs"] / m["dismissals"], 2) if m["dismissals"] else None
            m["sr"] = round(m["runs"] * 100.0 / m["balls"], 2) if m["balls"] else None
        else:
            merged_vs[opp] = {**row, "opponent": opp}
    vs_teams_norm = sorted(merged_vs.values(), key=lambda x: x["runs"], reverse=True)

    # Normalize opponent in recent form
    for row in recent:
        if row.get("opponent"):
            row["opponent"] = normalize_team(row["opponent"])

    return {
        "player": name,
        "career": career[0],
        "seasons": season_stats,
        "phase_stats": phase_stats,
        "vs_teams": vs_teams_norm,
        "recent_form": recent,
    }


@router.get("/{name}/bowling")
def bowling_profile(name: str):
    # Career stats
    career = query("""
        WITH bowling AS (
            SELECT d.match_id, d.innings_number,
                   SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
                   SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 AND d.runs_batter = 0 AND d.runs_extras = 0 THEN 1 END) AS dots
            FROM deliveries d
            WHERE d.bowler = ? AND d.is_super_over = false
            GROUP BY d.match_id, d.innings_number
        )
        SELECT COUNT(DISTINCT match_id) AS matches,
               COUNT(*) AS innings,
               SUM(legal_balls) AS total_balls,
               CONCAT(CAST(SUM(legal_balls) AS INTEGER) // 6, '.', CAST(SUM(legal_balls) AS INTEGER) % 6) AS overs,
               SUM(runs_conceded) AS runs_conceded,
               SUM(wickets) AS wickets,
               SUM(dots) AS dots,
               ROUND(SUM(runs_conceded) * 1.0 / NULLIF(SUM(wickets), 0), 2) AS avg,
               ROUND(SUM(runs_conceded) * 6.0 / NULLIF(SUM(legal_balls), 0), 2) AS economy,
               ROUND(SUM(legal_balls) * 1.0 / NULLIF(SUM(wickets), 0), 2) AS sr,
               SUM(CASE WHEN wickets >= 4 AND wickets < 5 THEN 1 ELSE 0 END) AS four_w,
               SUM(CASE WHEN wickets >= 5 THEN 1 ELSE 0 END) AS five_w
        FROM bowling
    """, [name])

    if not career or career[0]["matches"] is None or career[0]["matches"] == 0:
        raise HTTPException(404, f"No bowling data for {name}")

    # Best figures
    best = query("""
        SELECT d.match_id,
               SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS w,
               SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS r
        FROM deliveries d
        WHERE d.bowler = ? AND d.is_super_over = false
        GROUP BY d.match_id, d.innings_number
        ORDER BY w DESC, r ASC
        LIMIT 1
    """, [name])
    career[0]["best_figures"] = f"{best[0]['w']}/{best[0]['r']}" if best else "0/0"

    # Season-wise
    season_stats = query("""
        WITH bowling AS (
            SELECT m.season, i.bowling_team AS team, d.match_id, d.innings_number,
                   SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
                   SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            WHERE d.bowler = ? AND d.is_super_over = false
            GROUP BY m.season, i.bowling_team, d.match_id, d.innings_number
        )
        SELECT season, team,
               COUNT(*) AS innings,
               SUM(legal_balls) AS total_balls,
               CONCAT(CAST(SUM(legal_balls) AS INTEGER) // 6, '.', CAST(SUM(legal_balls) AS INTEGER) % 6) AS overs,
               SUM(runs_conceded) AS runs_conceded,
               SUM(wickets) AS wickets,
               ROUND(SUM(runs_conceded) * 1.0 / NULLIF(SUM(wickets), 0), 2) AS avg,
               ROUND(SUM(runs_conceded) * 6.0 / NULLIF(SUM(legal_balls), 0), 2) AS economy,
               ROUND(SUM(legal_balls) * 1.0 / NULLIF(SUM(wickets), 0), 2) AS sr
        FROM bowling
        GROUP BY season, team
        ORDER BY season, team
    """, [name])

    # Phase-wise
    phase_stats = query("""
        SELECT
            CASE
                WHEN over_number <= 5 THEN 'powerplay'
                WHEN over_number <= 14 THEN 'middle'
                ELSE 'death'
            END AS phase,
            COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS legal_balls,
            CONCAT(CAST(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS INTEGER) // 6, '.', CAST(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS INTEGER) % 6) AS overs,
            SUM(runs_batter + extras_wides + extras_noballs) AS runs_conceded,
            SUM(CASE WHEN is_wicket AND dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
            ROUND(SUM(runs_batter + extras_wides + extras_noballs) * 6.0 / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END), 0), 2) AS economy,
            ROUND(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 AND runs_batter = 0 AND runs_extras = 0 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END), 0), 2) AS dot_pct
        FROM deliveries
        WHERE bowler = ? AND is_super_over = false
        GROUP BY phase
        ORDER BY CASE phase WHEN 'powerplay' THEN 1 WHEN 'middle' THEN 2 ELSE 3 END
    """, [name])

    # Vs teams
    vs_teams = query("""
        WITH bowling AS (
            SELECT i.batting_team AS opponent, d.match_id, d.innings_number,
                   SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
                   SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            WHERE d.bowler = ? AND d.is_super_over = false
            GROUP BY i.batting_team, d.match_id, d.innings_number
        )
        SELECT opponent,
               COUNT(*) AS innings,
               SUM(runs_conceded) AS runs_conceded,
               SUM(wickets) AS wickets,
               SUM(legal_balls) AS legal_balls,
               ROUND(SUM(runs_conceded) * 1.0 / NULLIF(SUM(wickets), 0), 2) AS avg,
               ROUND(SUM(runs_conceded) * 6.0 / NULLIF(SUM(legal_balls), 0), 2) AS economy
        FROM bowling
        GROUP BY opponent
        ORDER BY wickets DESC
    """, [name])

    # Dismissal types
    dismissal_types = query("""
        SELECT dismissal_kind, COUNT(*) AS count
        FROM deliveries
        WHERE bowler = ? AND is_wicket = true AND is_super_over = false
          AND dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field')
        GROUP BY dismissal_kind
        ORDER BY count DESC
    """, [name])

    # Normalize and merge vs_teams by canonical team name
    merged_vs = {}
    for row in vs_teams:
        opp = normalize_team(row["opponent"])
        if opp in merged_vs:
            m = merged_vs[opp]
            m["innings"] += row["innings"]
            m["runs_conceded"] += row["runs_conceded"]
            m["wickets"] += row["wickets"]
            m["legal_balls"] += row["legal_balls"]
            m["avg"] = round(m["runs_conceded"] / m["wickets"], 2) if m["wickets"] else None
            m["economy"] = round(m["runs_conceded"] * 6.0 / m["legal_balls"], 2) if m["legal_balls"] else None
        else:
            merged_vs[opp] = {**row, "opponent": opp}
    vs_teams_norm = sorted(merged_vs.values(), key=lambda x: x["wickets"], reverse=True)

    return {
        "player": name,
        "career": career[0],
        "seasons": season_stats,
        "phase_stats": phase_stats,
        "vs_teams": vs_teams_norm,
        "dismissal_types": dismissal_types,
    }


@router.get("/{name}/matchups/batting")
def batting_matchups(name: str):
    rows = query("""
        SELECT bowler,
               COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS balls,
               SUM(runs_batter) AS runs,
               SUM(CASE WHEN extras_wides = 0 AND extras_noballs = 0 AND runs_batter = 0 AND runs_extras = 0 THEN 1 ELSE 0 END) AS dots,
               SUM(CASE WHEN runs_batter = 4 AND extras_wides = 0 AND extras_noballs = 0 THEN 1 ELSE 0 END) AS fours,
               SUM(CASE WHEN runs_batter = 6 AND extras_wides = 0 AND extras_noballs = 0 THEN 1 ELSE 0 END) AS sixes,
               SUM(CASE WHEN is_wicket AND player_dismissed = batter THEN 1 ELSE 0 END) AS dismissals,
               ROUND(SUM(runs_batter) * 100.0 / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END), 0), 2) AS sr
        FROM deliveries
        WHERE batter = ? AND is_super_over = false
        GROUP BY bowler
        HAVING COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) >= 6
        ORDER BY balls DESC
    """, [name])
    return rows


@router.get("/{name}/matchups/bowling")
def bowling_matchups(name: str):
    rows = query("""
        SELECT batter,
               COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) AS balls,
               SUM(runs_batter) AS runs,
               SUM(CASE WHEN extras_wides = 0 AND extras_noballs = 0 AND runs_batter = 0 AND runs_extras = 0 THEN 1 ELSE 0 END) AS dots,
               SUM(CASE WHEN is_wicket AND dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
               ROUND(SUM(runs_batter + extras_wides + extras_noballs) * 6.0 / NULLIF(COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END), 0), 2) AS economy
        FROM deliveries
        WHERE bowler = ? AND is_super_over = false
        GROUP BY batter
        HAVING COUNT(CASE WHEN extras_wides = 0 AND extras_noballs = 0 THEN 1 END) >= 6
        ORDER BY balls DESC
    """, [name])
    return rows


