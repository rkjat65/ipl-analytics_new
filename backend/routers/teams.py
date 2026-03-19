"""Team endpoints: stats, seasons, head-to-head, comparison."""

from fastapi import APIRouter, Query
from ..database import query, normalize_team, team_variants

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/compare")
def compare_teams(team1: str = Query(...), team2: str = Query(...)):
    """Detailed comparison between two teams."""
    def _team_stats(team):
        v = team_variants(team)
        ph = ", ".join(["?"] * len(v))
        return query(f"""
            WITH team_matches AS (
                SELECT match_id, season, winner, team1, team2, result
                FROM matches
                WHERE team1 IN ({ph}) OR team2 IN ({ph})
            )
            SELECT
                COUNT(*) AS matches,
                SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN winner IS NOT NULL AND winner NOT IN ({ph}) AND result = 'win' THEN 1 ELSE 0 END) AS losses,
                ROUND(SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) AS win_pct
            FROM team_matches
        """, v * 5)[0]

    def _batting_stats(team):
        v = team_variants(team)
        ph = ", ".join(["?"] * len(v))
        return query(f"""
            SELECT
                ROUND(AVG(total_runs), 2) AS avg_score,
                MAX(total_runs) AS highest_total,
                MIN(total_runs) AS lowest_total
            FROM innings
            WHERE batting_team IN ({ph}) AND is_super_over = false
        """, v)[0]

    s1, s2 = _team_stats(team1), _team_stats(team2)
    b1, b2 = _batting_stats(team1), _batting_stats(team2)

    v1, v2 = team_variants(team1), team_variants(team2)
    ph1, ph2 = ", ".join(["?"] * len(v1)), ", ".join(["?"] * len(v2))

    # H2H match filter condition (reused across queries)
    h2h_where = f"(team1 IN ({ph1}) AND team2 IN ({ph2})) OR (team1 IN ({ph2}) AND team2 IN ({ph1}))"
    h2h_params = v1 + v2 + v2 + v1

    # Overall H2H record
    h2h = query(f"""
        SELECT
            COUNT(*) AS played,
            SUM(CASE WHEN winner IN ({ph1}) THEN 1 ELSE 0 END) AS team1_wins,
            SUM(CASE WHEN winner IN ({ph2}) THEN 1 ELSE 0 END) AS team2_wins
        FROM matches
        WHERE {h2h_where}
    """, v1 + v2 + h2h_params)

    # Season-wise H2H breakdown
    season_wise_h2h = query(f"""
        SELECT
            season,
            SUM(CASE WHEN winner IN ({ph1}) THEN 1 ELSE 0 END) AS team1_wins,
            SUM(CASE WHEN winner IN ({ph2}) THEN 1 ELSE 0 END) AS team2_wins
        FROM matches
        WHERE {h2h_where}
        GROUP BY season
        ORDER BY season
    """, v1 + v2 + h2h_params)

    # Recent matches (last 10) between the two teams
    recent_matches_raw = query(f"""
        SELECT
            m.date,
            m.season,
            m.winner,
            m.venue,
            m.win_by_runs,
            m.win_by_wickets,
            i1.batting_team AS innings1_team,
            i1.total_runs AS innings1_score,
            i2.batting_team AS innings2_team,
            i2.total_runs AS innings2_score
        FROM matches m
        LEFT JOIN (
            SELECT match_id, batting_team, total_runs,
                   ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY batting_team) AS rn
            FROM innings
            WHERE is_super_over = false
        ) i1 ON m.match_id = i1.match_id AND i1.rn = 1
        LEFT JOIN (
            SELECT match_id, batting_team, total_runs,
                   ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY batting_team) AS rn
            FROM innings
            WHERE is_super_over = false
        ) i2 ON m.match_id = i2.match_id AND i2.rn = 2
        WHERE {h2h_where}
        ORDER BY m.date DESC
        LIMIT 10
    """, h2h_params)

    canonical1, canonical2 = normalize_team(team1), normalize_team(team2)

    # Normalise recent match rows so team1_score/team2_score align to canonical names
    recent_matches = []
    for rm in recent_matches_raw:
        t1_score, t2_score = None, None
        inn1_team_norm = normalize_team(rm["innings1_team"]) if rm["innings1_team"] else None
        inn2_team_norm = normalize_team(rm["innings2_team"]) if rm["innings2_team"] else None
        if inn1_team_norm == canonical1:
            t1_score = rm["innings1_score"]
            t2_score = rm["innings2_score"]
        elif inn1_team_norm == canonical2:
            t1_score = rm["innings2_score"]
            t2_score = rm["innings1_score"]
        else:
            # Fallback: check innings2
            if inn2_team_norm == canonical1:
                t1_score = rm["innings2_score"]
                t2_score = rm["innings1_score"]
            else:
                t1_score = rm["innings1_score"]
                t2_score = rm["innings2_score"]
        recent_matches.append({
            "date": str(rm["date"]) if rm["date"] else None,
            "season": rm["season"],
            "winner": normalize_team(rm["winner"]) if rm["winner"] else None,
            "team1_score": t1_score,
            "team2_score": t2_score,
            "venue": rm["venue"],
            "margin": f"{rm['win_by_runs']} runs" if rm.get("win_by_runs") else f"{rm['win_by_wickets']} wickets" if rm.get("win_by_wickets") else None,
        })

    # Toss stats from H2H matches
    toss_stats_row = query(f"""
        SELECT
            SUM(CASE WHEN toss_winner IN ({ph1}) THEN 1 ELSE 0 END) AS team1_toss_wins,
            SUM(CASE WHEN toss_winner IN ({ph2}) THEN 1 ELSE 0 END) AS team2_toss_wins,
            SUM(CASE WHEN
                (toss_winner = winner AND toss_decision = 'bat')
                OR (toss_winner != winner AND toss_decision = 'field')
                THEN 1 ELSE 0 END) AS bat_first_wins,
            SUM(CASE WHEN
                (toss_winner = winner AND toss_decision = 'field')
                OR (toss_winner != winner AND toss_decision = 'bat')
                THEN 1 ELSE 0 END) AS chase_wins
        FROM matches
        WHERE winner IS NOT NULL AND ({h2h_where})
    """, v1 + v2 + h2h_params)
    toss_stats = toss_stats_row[0] if toss_stats_row else {}

    # Average H2H scores (average score each team posts against the other)
    avg_h2h_row = query(f"""
        SELECT
            ROUND(AVG(CASE WHEN i.batting_team IN ({ph1}) THEN i.total_runs END), 2) AS team1_avg,
            ROUND(AVG(CASE WHEN i.batting_team IN ({ph2}) THEN i.total_runs END), 2) AS team2_avg
        FROM innings i
        JOIN matches m ON i.match_id = m.match_id
        WHERE i.is_super_over = false
          AND ({h2h_where})
    """, v1 + v2 + h2h_params)
    avg_h2h = avg_h2h_row[0] if avg_h2h_row else {"team1_avg": None, "team2_avg": None}

    return {
        "team1": {"name": canonical1, **s1, **b1},
        "team2": {"name": canonical2, **s2, **b2},
        "head_to_head": h2h[0] if h2h else {},
        "season_wise_h2h": season_wise_h2h,
        "recent_matches": recent_matches,
        "toss_stats": toss_stats,
        "avg_h2h_scores": avg_h2h,
    }


@router.get("/{name}/stats")
def team_stats(name: str):
    variants = team_variants(name)
    ph = ", ".join(["?"] * len(variants))

    stats = query(f"""
        WITH team_matches AS (
            SELECT match_id, season, winner, result
            FROM matches
            WHERE team1 IN ({ph}) OR team2 IN ({ph})
        )
        SELECT
            COUNT(*) AS matches,
            SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN winner IS NOT NULL AND winner NOT IN ({ph}) AND result = 'win' THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN result = 'no result' THEN 1 ELSE 0 END) AS no_results,
            ROUND(SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result != 'no result' THEN 1 ELSE 0 END), 0), 2) AS win_pct,
            COUNT(DISTINCT season) AS seasons_played
        FROM team_matches
    """, variants * 5)

    # Titles (finals won - approximate: last match of each season where team won)
    titles = query(f"""
        WITH season_last AS (
            SELECT season, MAX(date) AS last_date
            FROM matches
            GROUP BY season
        )
        SELECT COUNT(*) AS titles
        FROM matches m
        JOIN season_last sl ON m.season = sl.season AND m.date = sl.last_date
        WHERE m.winner IN ({ph})
    """, variants)

    avg_score = query(f"""
        SELECT ROUND(AVG(total_runs), 2) AS avg_score
        FROM innings
        WHERE batting_team IN ({ph}) AND is_super_over = false
    """, variants)

    result = stats[0] if stats else {}
    result["titles"] = titles[0]["titles"] if titles else 0
    result["avg_score"] = avg_score[0]["avg_score"] if avg_score else 0
    return result


@router.get("/{name}/seasons")
def team_seasons(name: str):
    variants = team_variants(name)
    ph = ", ".join(["?"] * len(variants))
    rows = query(f"""
        WITH team_matches AS (
            SELECT m.match_id, m.season, m.winner, m.result
            FROM matches m
            WHERE m.team1 IN ({ph}) OR m.team2 IN ({ph})
        )
        SELECT season,
               COUNT(*) AS matches,
               SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) AS wins,
               SUM(CASE WHEN winner IS NOT NULL AND winner NOT IN ({ph}) AND result = 'win' THEN 1 ELSE 0 END) AS losses,
               SUM(CASE WHEN result = 'no result' THEN 1 ELSE 0 END) AS no_results,
               ROUND(SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result != 'no result' THEN 1 ELSE 0 END), 0), 2) AS win_pct
        FROM team_matches
        GROUP BY season
        ORDER BY season
    """, variants * 5)
    return rows


@router.get("/{name}/h2h")
def head_to_head(name: str):
    variants = team_variants(name)
    ph = ", ".join(["?"] * len(variants))
    rows = query(f"""
        WITH opponents AS (
            SELECT
                CASE WHEN team1 IN ({ph}) THEN team2 ELSE team1 END AS opponent,
                winner, result
            FROM matches
            WHERE team1 IN ({ph}) OR team2 IN ({ph})
        )
        SELECT opponent,
               COUNT(*) AS played,
               SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) AS won,
               SUM(CASE WHEN winner = opponent THEN 1 ELSE 0 END) AS lost,
               ROUND(SUM(CASE WHEN winner IN ({ph}) THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result != 'no result' THEN 1 ELSE 0 END), 0), 2) AS win_pct
        FROM opponents
        GROUP BY opponent
        ORDER BY played DESC
    """, variants * 5)

    # Normalize opponent names and merge rows for same canonical team
    merged = {}
    for row in rows:
        opp = normalize_team(row["opponent"])
        if opp in merged:
            m = merged[opp]
            m["played"] += row["played"]
            m["won"] += row["won"]
            m["lost"] += row["lost"]
            total_decisive = m["played"] - (m.get("_nr", 0))
            m["win_pct"] = round(m["won"] * 100.0 / total_decisive, 2) if total_decisive else None
        else:
            merged[opp] = {**row, "opponent": opp}
    return sorted(merged.values(), key=lambda x: x["played"], reverse=True)
