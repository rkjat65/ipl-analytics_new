"""Advanced Analytics endpoints: form index, win predictor, fantasy picks, batting impact, season projections."""

from fastapi import APIRouter, Query, HTTPException
from ..database import query, normalize_team, team_variants

router = APIRouter(prefix="/api/advanced", tags=["Advanced"])


# ── Helpers ──────────────────────────────────────────────────────────

def _team_placeholders(team: str) -> tuple[str, list]:
    """Return a SQL IN-clause placeholder string and param list for all team name variants."""
    variants = team_variants(team)
    ph = ", ".join(["?"] * len(variants))
    return ph, variants


def _safe_div(numerator, denominator, default=0.0):
    """Division that returns *default* when denominator is zero or None."""
    if not denominator:
        return default
    return numerator / denominator


# ── 1. Team Form Index ──────────────────────────────────────────────

@router.get("/form-index")
def team_form_index(
    team: str = Query(..., description="Full team name, e.g. 'Chennai Super Kings'"),
    last_n: int = Query(10, ge=1, le=50, description="Number of recent matches to analyse"),
):
    """Calculate a weighted form index (0-100) for a team based on recent results."""
    ph, variants = _team_placeholders(team)
    canonical = normalize_team(team)

    # Fetch last N matches involving this team, most recent first
    all_params = variants + variants + variants
    matches = query(f"""
        SELECT m.match_id, m.date, m.team1, m.team2, m.winner,
               m.win_by_runs, m.win_by_wickets, m.result,
               i.total_runs AS team_score
        FROM matches m
        LEFT JOIN innings i
            ON i.match_id = m.match_id
            AND i.is_super_over = false
            AND i.batting_team IN ({ph})
        WHERE (m.team1 IN ({ph}) OR m.team2 IN ({ph}))
          AND m.result IS NOT NULL
        ORDER BY m.date DESC
        LIMIT {int(last_n) * 3}
    """, all_params)

    if not matches:
        raise HTTPException(404, f"No matches found for team '{team}'")

    # De-duplicate (a match may appear twice if LEFT JOIN yields two innings rows)
    seen = set()
    unique_matches = []
    for row in matches:
        if row["match_id"] not in seen:
            seen.add(row["match_id"])
            unique_matches.append(row)
        elif row["team_score"] is not None:
            # Update score if first row had NULL
            for um in unique_matches:
                if um["match_id"] == row["match_id"] and um["team_score"] is None:
                    um["team_score"] = row["team_score"]

    unique_matches = unique_matches[:last_n]

    if not unique_matches:
        raise HTTPException(404, f"No matches found for team '{team}'")

    wins = 0
    losses = 0
    scores = []
    trend = []
    form_points = 0.0
    total_weight = 0.0
    current_streak = 0
    streak_result = None

    for idx, match in enumerate(unique_matches):
        weight = (last_n - idx) / last_n  # most recent = 1.0, oldest ≈ 1/N
        total_weight += weight

        winner = normalize_team(match["winner"]) if match["winner"] else None
        is_win = winner == canonical

        if is_win:
            wins += 1
            form_points += 10 * weight
        else:
            losses += 1
            form_points += -5 * weight

        if match["team_score"] is not None:
            scores.append(match["team_score"])

        # Streak tracking
        result_label = "W" if is_win else "L"
        if idx == 0:
            streak_result = result_label
            current_streak = 1
        elif result_label == streak_result:
            current_streak += 1
        # else: streak already broken, stop counting

        opponent_raw = match["team2"] if normalize_team(match["team1"]) == canonical else match["team1"]
        trend.append({
            "match_number": idx + 1,
            "opponent": normalize_team(opponent_raw),
            "result": result_label,
            "score": match["team_score"],
        })

    # Normalise form_points to 0-100 range
    # Max possible = sum of 10*weight for all matches; min = sum of -5*weight
    max_points = 10 * total_weight
    min_points = -5 * total_weight
    if max_points == min_points:
        form_index = 50.0
    else:
        form_index = round((form_points - min_points) / (max_points - min_points) * 100, 1)

    avg_score = round(sum(scores) / len(scores), 2) if scores else 0

    return {
        "team": canonical,
        "form_index": form_index,
        "matches_analyzed": len(unique_matches),
        "wins": wins,
        "losses": losses,
        "avg_score": avg_score,
        "current_streak": f"{streak_result}{current_streak}" if streak_result else "N/A",
        "trend": trend,
    }


# ── 2. Match Win Predictor ──────────────────────────────────────────

@router.get("/win-predictor")
def win_predictor(
    team1: str = Query(..., description="First team name"),
    team2: str = Query(..., description="Second team name"),
    venue: str | None = Query(None, description="Optional venue name"),
):
    """Predict win probability for a hypothetical match using weighted historical factors."""
    c1 = normalize_team(team1)
    c2 = normalize_team(team2)
    ph1, v1 = _team_placeholders(team1)
    ph2, v2 = _team_placeholders(team2)

    # ── Factor 1: Head-to-head record (weight 30%) ──
    h2h_rows = query(f"""
        SELECT m.winner, COUNT(*) AS cnt
        FROM matches m
        WHERE ((m.team1 IN ({ph1}) AND m.team2 IN ({ph2}))
            OR (m.team1 IN ({ph2}) AND m.team2 IN ({ph1})))
          AND m.winner IS NOT NULL
        GROUP BY m.winner
    """, v1 + v2 + v2 + v1)

    h2h_t1 = 0
    h2h_t2 = 0
    for row in h2h_rows:
        w = normalize_team(row["winner"])
        if w == c1:
            h2h_t1 += row["cnt"]
        elif w == c2:
            h2h_t2 += row["cnt"]

    h2h_total = h2h_t1 + h2h_t2
    h2h_pct1 = _safe_div(h2h_t1, h2h_total, 0.5)
    h2h_pct2 = 1 - h2h_pct1

    # ── Factor 2: Recent form — last 10 matches (weight 25%) ──
    def _recent_win_pct(ph, variants, canonical):
        recent = query(f"""
            SELECT m.winner
            FROM matches m
            WHERE (m.team1 IN ({ph}) OR m.team2 IN ({ph}))
              AND m.result IS NOT NULL
            ORDER BY m.date DESC
            LIMIT 10
        """, variants + variants)
        if not recent:
            return 0.5
        wins = sum(1 for r in recent if normalize_team(r["winner"]) == canonical if r["winner"])
        return _safe_div(wins, len(recent), 0.5)

    form_pct1 = _recent_win_pct(ph1, v1, c1)
    form_pct2 = _recent_win_pct(ph2, v2, c2)
    form_total = form_pct1 + form_pct2
    form_pct1_norm = _safe_div(form_pct1, form_total, 0.5)
    form_pct2_norm = 1 - form_pct1_norm

    # ── Factor 3: Venue stats (weight 20%) ──
    venue_pct1 = 0.5
    venue_pct2 = 0.5
    venue_label = venue or "N/A"

    if venue:
        venue_rows = query(f"""
            SELECT m.winner, COUNT(*) AS cnt
            FROM matches m
            WHERE m.venue = ?
              AND (m.team1 IN ({ph1}) OR m.team2 IN ({ph1})
                OR m.team1 IN ({ph2}) OR m.team2 IN ({ph2}))
              AND m.winner IS NOT NULL
            GROUP BY m.winner
        """, [venue] + v1 + v1 + v2 + v2)

        vt1 = 0
        vt2 = 0
        for row in venue_rows:
            w = normalize_team(row["winner"])
            if w == c1:
                vt1 += row["cnt"]
            elif w == c2:
                vt2 += row["cnt"]
        v_total = vt1 + vt2
        venue_pct1 = _safe_div(vt1, v_total, 0.5)
        venue_pct2 = 1 - venue_pct1

    # ── Factor 4: Overall win percentage (weight 25%) ──
    def _overall_win_pct(ph, variants, canonical):
        rows = query(f"""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN m.winner IS NOT NULL THEN 1 ELSE 0 END) AS decided
            FROM matches m
            WHERE (m.team1 IN ({ph}) OR m.team2 IN ({ph}))
        """, variants + variants)
        if not rows or rows[0]["total"] == 0:
            return 0.5
        wins_rows = query(f"""
            SELECT COUNT(*) AS wins
            FROM matches m
            WHERE m.winner IN ({ph})
        """, variants)
        return _safe_div(wins_rows[0]["wins"], rows[0]["decided"], 0.5)

    overall_pct1 = _overall_win_pct(ph1, v1, c1)
    overall_pct2 = _overall_win_pct(ph2, v2, c2)
    overall_total = overall_pct1 + overall_pct2
    overall_pct1_norm = _safe_div(overall_pct1, overall_total, 0.5)
    overall_pct2_norm = 1 - overall_pct1_norm

    # ── Weighted combination ──
    w_h2h, w_form, w_venue, w_overall = 0.30, 0.25, 0.20, 0.25

    raw1 = (w_h2h * h2h_pct1 + w_form * form_pct1_norm
            + w_venue * venue_pct1 + w_overall * overall_pct1_norm)
    raw2 = (w_h2h * h2h_pct2 + w_form * form_pct2_norm
            + w_venue * venue_pct2 + w_overall * overall_pct2_norm)
    total_raw = raw1 + raw2
    t1_win_pct = round(_safe_div(raw1, total_raw, 0.5) * 100, 1)
    t2_win_pct = round(100 - t1_win_pct, 1)

    # Build prediction text
    if abs(t1_win_pct - t2_win_pct) < 5:
        prediction_text = f"Very close contest — slight edge to {'both teams equally' if t1_win_pct == t2_win_pct else (c1 if t1_win_pct > t2_win_pct else c2)}"
    else:
        favoured = c1 if t1_win_pct > t2_win_pct else c2
        margin = abs(t1_win_pct - t2_win_pct)
        strength = "strongly" if margin > 20 else "moderately" if margin > 10 else "slightly"
        prediction_text = f"{favoured} are {strength} favoured to win"

    return {
        "team1": c1,
        "team2": c2,
        "team1_win_pct": t1_win_pct,
        "team2_win_pct": t2_win_pct,
        "factors": {
            "h2h": {"team1_pct": round(h2h_pct1 * 100, 1), "team2_pct": round(h2h_pct2 * 100, 1), "matches": h2h_total},
            "form": {"team1_pct": round(form_pct1_norm * 100, 1), "team2_pct": round(form_pct2_norm * 100, 1)},
            "venue": {"team1_pct": round(venue_pct1 * 100, 1), "team2_pct": round(venue_pct2 * 100, 1)},
            "overall": {"team1_pct": round(overall_pct1_norm * 100, 1), "team2_pct": round(overall_pct2_norm * 100, 1)},
        },
        "venue": venue_label,
        "prediction_text": prediction_text,
    }


# ── 3. Fantasy XI Suggestions ───────────────────────────────────────

@router.get("/fantasy-picks")
def fantasy_picks(
    team1: str = Query(..., description="First team name"),
    team2: str = Query(..., description="Second team name"),
    season: str | None = Query(None, description="Optional season filter"),
):
    """Suggest a Fantasy XI from two teams based on batting, bowling, and fielding stats."""
    c1 = normalize_team(team1)
    c2 = normalize_team(team2)
    ph1, v1 = _team_placeholders(team1)
    ph2, v2 = _team_placeholders(team2)

    season_filter = ""
    season_params: list = []
    if season:
        season_filter = " AND m.season = ?"
        season_params = [season]

    # ── Batting stats for players from both teams ──
    batters = query(f"""
        WITH player_team AS (
            SELECT DISTINCT d.batter AS player, i.batting_team AS team
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            JOIN matches m ON d.match_id = m.match_id
            WHERE i.batting_team IN ({ph1}, {ph2})
              AND d.is_super_over = false {season_filter}
        ),
        batting AS (
            SELECT d.batter AS player, d.match_id,
                   SUM(d.runs_batter) AS runs,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls,
                   MAX(CASE WHEN d.is_wicket AND d.player_dismissed = d.batter THEN 1 ELSE 0 END) AS was_out
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            JOIN matches m ON d.match_id = m.match_id
            WHERE i.batting_team IN ({ph1}, {ph2})
              AND d.is_super_over = false {season_filter}
            GROUP BY d.batter, d.match_id
        )
        SELECT b.player,
               pt.team,
               SUM(b.runs) AS runs,
               SUM(b.balls) AS balls,
               SUM(b.was_out) AS dismissals,
               COUNT(*) AS innings,
               ROUND(SUM(b.runs) * 100.0 / NULLIF(SUM(b.balls), 0), 2) AS sr,
               ROUND(SUM(b.runs) * 1.0 / NULLIF(SUM(b.was_out), 0), 2) AS avg
        FROM batting b
        JOIN player_team pt ON b.player = pt.player
        GROUP BY b.player, pt.team
        HAVING SUM(b.balls) >= 30
    """, v1 + v2 + season_params + v1 + v2 + season_params)

    # ── Bowling stats ──
    bowlers = query(f"""
        WITH player_team AS (
            SELECT DISTINCT d.bowler AS player, i.bowling_team AS team
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            JOIN matches m ON d.match_id = m.match_id
            WHERE i.bowling_team IN ({ph1}, {ph2})
              AND d.is_super_over = false {season_filter}
        ),
        bowling AS (
            SELECT d.bowler AS player, d.match_id,
                   SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
                   SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field') THEN 1 ELSE 0 END) AS wickets,
                   COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            JOIN matches m ON d.match_id = m.match_id
            WHERE i.bowling_team IN ({ph1}, {ph2})
              AND d.is_super_over = false {season_filter}
            GROUP BY d.bowler, d.match_id
        )
        SELECT b.player,
               pt.team,
               SUM(b.runs_conceded) AS runs_conceded,
               SUM(b.wickets) AS wickets,
               SUM(b.legal_balls) AS legal_balls,
               ROUND(SUM(b.runs_conceded) * 6.0 / NULLIF(SUM(b.legal_balls), 0), 2) AS economy,
               ROUND(SUM(b.runs_conceded) * 1.0 / NULLIF(SUM(b.wickets), 0), 2) AS bowl_avg
        FROM bowling b
        JOIN player_team pt ON b.player = pt.player
        GROUP BY b.player, pt.team
        HAVING SUM(b.legal_balls) >= 30
    """, v1 + v2 + season_params + v1 + v2 + season_params)

    # ── Catches ──
    catches = query(f"""
        SELECT d.fielder1 AS player, COUNT(*) AS catches
        FROM deliveries d
        JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.is_wicket = true
          AND d.dismissal_kind IN ('caught', 'caught and bowled')
          AND d.fielder1 IS NOT NULL
          AND (i.bowling_team IN ({ph1}, {ph2}) OR i.batting_team IN ({ph1}, {ph2}))
          AND d.is_super_over = false {season_filter}
        GROUP BY d.fielder1
    """, v1 + v2 + v1 + v2 + season_params)
    catches_map = {r["player"]: r["catches"] for r in catches}

    # ── Merge into a single player map ──
    player_map: dict[str, dict] = {}

    for b in batters:
        team_name = normalize_team(b["team"])
        player_map[b["player"]] = {
            "name": b["player"],
            "team": team_name,
            "runs": int(b["runs"] or 0),
            "balls": int(b["balls"] or 0),
            "sr": float(b["sr"] or 0),
            "bat_avg": float(b["avg"] or 0),
            "wickets": 0,
            "economy": 0,
            "bowl_avg": 0,
            "catches": catches_map.get(b["player"], 0),
        }

    for bw in bowlers:
        team_name = normalize_team(bw["team"])
        if bw["player"] in player_map:
            player_map[bw["player"]]["wickets"] = int(bw["wickets"] or 0)
            player_map[bw["player"]]["economy"] = float(bw["economy"] or 0)
            player_map[bw["player"]]["bowl_avg"] = float(bw["bowl_avg"] or 0)
        else:
            player_map[bw["player"]] = {
                "name": bw["player"],
                "team": team_name,
                "runs": 0,
                "balls": 0,
                "sr": 0,
                "bat_avg": 0,
                "wickets": int(bw["wickets"] or 0),
                "economy": float(bw["economy"] or 0),
                "bowl_avg": float(bw["bowl_avg"] or 0),
                "catches": catches_map.get(bw["player"], 0),
            }

    # Update catches for players already in the map
    for name, c in catches_map.items():
        if name in player_map:
            player_map[name]["catches"] = c

    # ── Calculate fantasy score and determine role ──
    picks = []
    for p in player_map.values():
        fantasy_score = p["runs"] * 1 + p["wickets"] * 25 + p["catches"] * 10

        # Determine role heuristic
        if p["runs"] >= 100 and p["wickets"] >= 5:
            role = "All-Rounder"
        elif p["wickets"] >= 5 and p["runs"] < 100:
            role = "Bowler"
        else:
            role = "Batter"

        # Build reason
        reasons = []
        if p["runs"] > 0:
            reasons.append(f"{p['runs']} runs (SR {p['sr']})")
        if p["wickets"] > 0:
            reasons.append(f"{p['wickets']} wkts (Econ {p['economy']})")
        if p["catches"] > 0:
            reasons.append(f"{p['catches']} catches")

        picks.append({
            "name": p["name"],
            "role": role,
            "team": p["team"],
            "stats": {
                "runs": p["runs"],
                "wickets": p["wickets"],
                "sr": p["sr"],
                "economy": p["economy"],
            },
            "fantasy_score": fantasy_score,
            "reason": "; ".join(reasons) if reasons else "Consistent performer",
        })

    # Sort by fantasy score descending and take top 11
    picks.sort(key=lambda x: x["fantasy_score"], reverse=True)
    picks = picks[:11]

    return {
        "team1": c1,
        "team2": c2,
        "picks": picks,
    }


# ── 4. Player Impact Index ──────────────────────────────────────────

@router.get("/batting-impact")
def batting_impact(
    player: str = Query(..., description="Player name"),
    season: str | None = Query(None, description="Optional season filter"),
):
    """Calculate a batting impact index (0-100) based on boundary%, dot%, phase performance, and wins contributed."""
    sf = ""
    sp: list = []
    if season:
        sf = " AND m.season = ?"
        sp = [season]

    # Core batting metrics
    metrics = query(f"""
        SELECT
            COUNT(DISTINCT d.match_id) AS matches,
            SUM(d.runs_batter) AS total_runs,
            COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS total_balls,
            SUM(CASE WHEN (d.runs_batter = 4 OR d.runs_batter = 6) AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS boundaries,
            SUM(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 AND d.runs_batter = 0 THEN 1 ELSE 0 END) AS dots,
            ROUND(SUM(CASE WHEN (d.runs_batter = 4 OR d.runs_batter = 6) AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) * 100.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS boundary_pct,
            ROUND(SUM(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 AND d.runs_batter = 0 THEN 1 ELSE 0 END) * 100.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS dot_pct
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.batter = ? AND d.is_super_over = false {sf}
    """, [player] + sp)

    if not metrics or metrics[0]["matches"] is None or metrics[0]["matches"] == 0:
        raise HTTPException(404, f"No batting data found for player '{player}'")

    m = metrics[0]

    # Death overs SR (overs 16-20)
    death = query(f"""
        SELECT
            ROUND(SUM(d.runs_batter) * 100.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS death_sr
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.batter = ? AND d.over_number >= 16 AND d.is_super_over = false {sf}
    """, [player] + sp)
    death_sr = float(death[0]["death_sr"] or 0) if death else 0

    # Powerplay SR (overs 1-6)
    pp = query(f"""
        SELECT
            ROUND(SUM(d.runs_batter) * 100.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS pp_sr
        FROM deliveries d
        JOIN matches m ON d.match_id = m.match_id
        WHERE d.batter = ? AND d.over_number <= 6 AND d.is_super_over = false {sf}
    """, [player] + sp)
    pp_sr = float(pp[0]["pp_sr"] or 0) if pp else 0

    # Wins contributed: matches where the player batted and team won
    wins_data = query(f"""
        WITH player_matches AS (
            SELECT DISTINCT d.match_id, i.batting_team
            FROM deliveries d
            JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ? AND d.is_super_over = false {sf}
        )
        SELECT
            SUM(CASE WHEN m.winner = pm.batting_team AND i.innings_number = 1 THEN 1 ELSE 0 END) AS wins_batting_first,
            SUM(CASE WHEN m.winner = pm.batting_team AND i.innings_number = 2 THEN 1 ELSE 0 END) AS wins_chasing
        FROM player_matches pm
        JOIN matches m ON pm.match_id = m.match_id
        JOIN innings i ON pm.match_id = i.match_id AND pm.batting_team = i.batting_team AND i.is_super_over = false
    """, [player] + sp)

    wins_bf = int(wins_data[0]["wins_batting_first"] or 0) if wins_data else 0
    wins_ch = int(wins_data[0]["wins_chasing"] or 0) if wins_data else 0

    # ── Calculate impact score (0-100) ──
    boundary_pct = float(m["boundary_pct"] or 0)
    dot_pct = float(m["dot_pct"] or 0)
    total_matches = int(m["matches"])

    # Component scores (each roughly 0-25, summed to ~100)
    # 1. Boundary% score: higher is better (IPL avg ~15-20%)
    boundary_score = min(boundary_pct / 30 * 25, 25)

    # 2. Low dot% score: lower is better (IPL avg ~35-45%)
    dot_score = max(0, (50 - dot_pct) / 50 * 25)

    # 3. Death/PP SR score: higher is better (avg ~130)
    phase_sr = (death_sr + pp_sr) / 2 if (death_sr and pp_sr) else max(death_sr, pp_sr)
    phase_score = min(phase_sr / 200 * 25, 25)

    # 4. Win contribution score
    total_wins = wins_bf + wins_ch
    win_rate = _safe_div(total_wins, total_matches, 0)
    win_score = min(win_rate * 25, 25)

    impact_score = round(min(boundary_score + dot_score + phase_score + win_score, 100), 1)

    return {
        "player": player,
        "impact_score": impact_score,
        "matches": total_matches,
        "metrics": {
            "boundary_pct": boundary_pct,
            "dot_pct": dot_pct,
            "death_sr": death_sr,
            "powerplay_sr": pp_sr,
            "wins_batting_first": wins_bf,
            "wins_chasing": wins_ch,
        },
    }


# ── 4b. Unified Player Impact Index ────────────────────────────────

def _impact_label(score: float) -> str:
    if score >= 85:
        return "Elite"
    if score >= 70:
        return "High Impact"
    if score >= 50:
        return "Above Average"
    if score >= 35:
        return "Average"
    return "Below Average"


@router.get("/player-impact")
def player_impact(
    player: str = Query(..., description="Player name"),
    season: str | None = Query(None, description="Optional season filter"),
):
    """Calculate a unified player impact index (0-100) supporting batsmen, bowlers, and all-rounders."""
    sf = ""
    sp: list = []
    if season:
        sf = " AND m.season = ?"
        sp = [season]

    # ── Detect role: count balls batted vs balls bowled ──
    role_data = query(f"""
        SELECT
            (SELECT COUNT(*) FROM deliveries d JOIN matches m ON d.match_id = m.match_id
             WHERE d.batter = ? AND d.is_super_over = false {sf}) AS balls_batted,
            (SELECT COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END)
             FROM deliveries d JOIN matches m ON d.match_id = m.match_id
             WHERE d.bowler = ? AND d.is_super_over = false {sf}) AS balls_bowled
    """, [player] + sp + [player] + sp)

    balls_batted = int(role_data[0]["balls_batted"] or 0) if role_data else 0
    balls_bowled = int(role_data[0]["balls_bowled"] or 0) if role_data else 0

    if balls_batted == 0 and balls_bowled == 0:
        raise HTTPException(404, f"No data found for player '{player}'")

    # Determine role — use ratio to avoid classifying part-time bowlers as all-rounders
    # All-rounder: must have meaningful contribution in both (at least 20% of the larger)
    bat_bowl_ratio = min(balls_batted, balls_bowled) / max(balls_batted, balls_bowled) if max(balls_batted, balls_bowled) > 0 else 0
    if balls_batted >= 120 and balls_bowled >= 120 and bat_bowl_ratio >= 0.2:
        role = "All-Rounder"
    elif balls_bowled > balls_batted:
        role = "Bowler"
    else:
        role = "Batsman"

    batting_score = 0.0
    batting_metrics = {}
    bowling_score = 0.0
    bowling_metrics = {}

    # ── Batting Impact (same logic as /batting-impact) ──
    if balls_batted > 0:
        bat_m = query(f"""
            SELECT
                COUNT(DISTINCT d.match_id) AS matches,
                SUM(d.runs_batter) AS total_runs,
                COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS total_balls,
                SUM(CASE WHEN (d.runs_batter = 4 OR d.runs_batter = 6) AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) AS boundaries,
                ROUND(SUM(CASE WHEN (d.runs_batter = 4 OR d.runs_batter = 6) AND d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 ELSE 0 END) * 100.0
                    / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS boundary_pct,
                ROUND(SUM(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 AND d.runs_batter = 0 THEN 1 ELSE 0 END) * 100.0
                    / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS dot_pct
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ? AND d.is_super_over = false {sf}
        """, [player] + sp)

        bm = bat_m[0] if bat_m else {}
        boundary_pct = float(bm.get("boundary_pct") or 0)
        dot_pct = float(bm.get("dot_pct") or 0)
        bat_matches = int(bm.get("matches") or 0)

        death = query(f"""
            SELECT ROUND(SUM(d.runs_batter) * 100.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS death_sr
            FROM deliveries d JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ? AND d.over_number >= 16 AND d.is_super_over = false {sf}
        """, [player] + sp)
        death_sr = float(death[0]["death_sr"] or 0) if death else 0

        pp = query(f"""
            SELECT ROUND(SUM(d.runs_batter) * 100.0
                / NULLIF(COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END), 0), 2) AS pp_sr
            FROM deliveries d JOIN matches m ON d.match_id = m.match_id
            WHERE d.batter = ? AND d.over_number <= 6 AND d.is_super_over = false {sf}
        """, [player] + sp)
        pp_sr = float(pp[0]["pp_sr"] or 0) if pp else 0

        wins_data = query(f"""
            WITH player_matches AS (
                SELECT DISTINCT d.match_id, i.batting_team
                FROM deliveries d
                JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
                JOIN matches m ON d.match_id = m.match_id
                WHERE d.batter = ? AND d.is_super_over = false {sf}
            )
            SELECT COUNT(CASE WHEN m.winner = pm.batting_team THEN 1 END) AS wins
            FROM player_matches pm
            JOIN matches m ON pm.match_id = m.match_id
        """, [player] + sp)
        bat_wins = int(wins_data[0]["wins"] or 0) if wins_data else 0

        # Compute batting average and overall SR
        total_runs = int(bm.get("total_runs") or 0)
        total_balls = int(bm.get("total_balls") or 0)
        overall_sr = _safe_div(total_runs * 100.0, total_balls, 0)
        bat_avg = _safe_div(total_runs, bat_matches, 0)

        # Component scores (6 components, each 0-16.67, total = 100)
        # 1. Batting average: 40+ = perfect (top IPL batsmen avg 30-45)
        avg_score = min(bat_avg / 40 * 16.67, 16.67)
        # 2. Strike rate: 150+ = perfect
        sr_score = min(overall_sr / 150 * 16.67, 16.67)
        # 3. Boundary %: 25%+ = perfect
        boundary_score = min(boundary_pct / 25 * 16.67, 16.67)
        # 4. Dot ball management: lower is better (20% dots = perfect, 50%+ = 0)
        dot_score_val = max(0, (50 - dot_pct) / 30 * 16.67)
        # 5. Phase impact: death + PP strike rates (avg 160+ = perfect)
        phase_sr = (death_sr + pp_sr) / 2 if (death_sr and pp_sr) else max(death_sr, pp_sr)
        phase_score = min(phase_sr / 160 * 16.67, 16.67)
        # 6. Win contribution
        win_rate = _safe_div(bat_wins, bat_matches, 0)
        win_score = min(win_rate * 16.67, 16.67)
        batting_score = min(avg_score + sr_score + boundary_score + dot_score_val + phase_score + win_score, 100)

        batting_metrics = {
            "batting_avg": round(bat_avg, 1),
            "strike_rate": round(overall_sr, 1),
            "boundary_pct": round(boundary_pct, 1),
            "dot_pct": round(dot_pct, 1),
            "death_sr": round(death_sr, 1),
            "powerplay_sr": round(pp_sr, 1),
            "win_contribution": round(win_rate * 100, 1),
        }

    # ── Bowling Impact ──
    if balls_bowled > 0:
        bowl_m = query(f"""
            SELECT
                COUNT(DISTINCT d.match_id) AS matches,
                SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs_conceded,
                COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS legal_balls,
                SUM(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 AND d.runs_batter = 0
                         AND d.extras_wides = 0 AND d.extras_noballs = 0 AND d.extras_byes = 0
                         AND d.extras_legbyes = 0 THEN 1 ELSE 0 END) AS dot_balls,
                SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field')
                    THEN 1 ELSE 0 END) AS wickets
            FROM deliveries d
            JOIN matches m ON d.match_id = m.match_id
            WHERE d.bowler = ? AND d.is_super_over = false {sf}
        """, [player] + sp)

        bw = bowl_m[0] if bowl_m else {}
        bowl_matches = int(bw.get("matches") or 0)
        runs_conceded = int(bw.get("runs_conceded") or 0)
        legal_balls = int(bw.get("legal_balls") or 0)
        dot_balls = int(bw.get("dot_balls") or 0)
        total_wickets = int(bw.get("wickets") or 0)

        economy = _safe_div(runs_conceded * 6.0, legal_balls, 12.0)
        bowl_dot_pct = _safe_div(dot_balls * 100.0, legal_balls, 0)
        wickets_per_match = _safe_div(total_wickets, bowl_matches, 0)

        # Death overs economy (overs 16-20)
        death_bowl = query(f"""
            SELECT
                SUM(d.runs_batter + d.extras_wides + d.extras_noballs) AS runs,
                COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS balls
            FROM deliveries d JOIN matches m ON d.match_id = m.match_id
            WHERE d.bowler = ? AND d.over_number >= 16 AND d.is_super_over = false {sf}
        """, [player] + sp)
        death_runs = int(death_bowl[0]["runs"] or 0) if death_bowl else 0
        death_balls = int(death_bowl[0]["balls"] or 0) if death_bowl else 0
        death_economy = _safe_div(death_runs * 6.0, death_balls, 12.0)

        # Powerplay wickets percentage
        pp_bowl = query(f"""
            SELECT
                SUM(CASE WHEN d.is_wicket AND d.dismissal_kind NOT IN ('run out','retired hurt','retired out','obstructing the field')
                    THEN 1 ELSE 0 END) AS pp_wickets
            FROM deliveries d JOIN matches m ON d.match_id = m.match_id
            WHERE d.bowler = ? AND d.over_number <= 6 AND d.is_super_over = false {sf}
        """, [player] + sp)
        pp_wickets = int(pp_bowl[0]["pp_wickets"] or 0) if pp_bowl else 0
        pp_wicket_pct = _safe_div(pp_wickets * 100.0, total_wickets, 0)

        # Win contribution for bowling
        bowl_wins_data = query(f"""
            WITH player_matches AS (
                SELECT DISTINCT d.match_id, i.bowling_team
                FROM deliveries d
                JOIN innings i ON d.match_id = i.match_id AND d.innings_number = i.innings_number
                JOIN matches m ON d.match_id = m.match_id
                WHERE d.bowler = ? AND d.is_super_over = false {sf}
            )
            SELECT COUNT(CASE WHEN m.winner = pm.bowling_team THEN 1 END) AS wins
            FROM player_matches pm
            JOIN matches m ON pm.match_id = m.match_id
        """, [player] + sp)
        bowl_wins = int(bowl_wins_data[0]["wins"] or 0) if bowl_wins_data else 0
        bowl_win_rate = _safe_div(bowl_wins, bowl_matches, 0)

        # Component scores for bowling (each 0-20, 5 components = 100 max)
        # 1. Economy score: lower is better (6.0 = perfect, 12+ = 0)
        econ_score = max(0, min((12.0 - economy) / 6.0 * 20, 20))
        # 2. Dot ball %: higher is better (50%+ = perfect)
        bowl_dot_score = min(bowl_dot_pct / 50 * 20, 20)
        # 3. Death economy: lower is better (8 = great, 14+ = bad)
        death_econ_score = max(0, min((14.0 - death_economy) / 6.0 * 20, 20))
        # 4. Wickets per match: higher is better (3+ = perfect)
        wpm_score = min(wickets_per_match / 3.0 * 20, 20)
        # 5. Win contribution
        bowl_win_score = min(bowl_win_rate * 20, 20)

        bowling_score = min(econ_score + bowl_dot_score + death_econ_score + wpm_score + bowl_win_score, 100)

        bowling_metrics = {
            "economy": round(economy, 2),
            "dot_ball_pct": round(bowl_dot_pct, 1),
            "death_economy": round(death_economy, 2),
            "powerplay_wicket_pct": round(pp_wicket_pct, 1),
            "wickets_per_match": round(wickets_per_match, 2),
            "win_contribution": round(bowl_win_rate * 100, 1),
        }

    # ── Combine scores based on role ──
    if role == "All-Rounder":
        impact_score = round((batting_score + bowling_score) / 2, 1)
        metrics = {**{f"bat_{k}": v for k, v in batting_metrics.items()},
                   **{f"bowl_{k}": v for k, v in bowling_metrics.items()}}
    elif role == "Bowler":
        impact_score = round(bowling_score, 1)
        metrics = bowling_metrics
    else:
        impact_score = round(batting_score, 1)
        metrics = batting_metrics

    label = _impact_label(impact_score)

    # Build summary sentence
    if role == "Batsman":
        summary = f"{player} is an {label.lower()} batsman with an impact score of {impact_score}/100."
    elif role == "Bowler":
        summary = f"{player} is an {label.lower()} bowler with an impact score of {impact_score}/100."
    else:
        summary = f"{player} is an {label.lower()} all-rounder with an impact score of {impact_score}/100 (Bat: {round(batting_score, 1)}, Bowl: {round(bowling_score, 1)})."

    return {
        "player": player,
        "role": role,
        "impact_score": impact_score,
        "label": label,
        "metrics": metrics,
        "batting_score": round(batting_score, 1) if role == "All-Rounder" else None,
        "bowling_score": round(bowling_score, 1) if role == "All-Rounder" else None,
        "summary": summary,
    }


# ── 5. Season Projections ───────────────────────────────────────────

@router.get("/season-projections")
def season_projections(
    season: str = Query(..., description="Season to project, e.g. '2023'"),
):
    """Project final standings for a season based on current results."""
    # Get all matches in the season
    season_matches = query("""
        SELECT m.match_id, m.team1, m.team2, m.winner, m.result,
               m.win_by_runs, m.win_by_wickets
        FROM matches m
        WHERE m.season = ? AND m.result IS NOT NULL
        ORDER BY m.date
    """, [season])

    if not season_matches:
        raise HTTPException(404, f"No matches found for season '{season}'")

    # Gather innings data for NRR calculation (legal balls only, excluding wides/no-balls)
    innings_data = query("""
        SELECT i.match_id, i.innings_number, i.batting_team, i.total_runs,
               i.total_wickets,
               COUNT(CASE WHEN d.extras_wides = 0 AND d.extras_noballs = 0 THEN 1 END) AS total_balls
        FROM innings i
        LEFT JOIN deliveries d
            ON i.match_id = d.match_id AND i.innings_number = d.innings_number
        JOIN matches m ON i.match_id = m.match_id
        WHERE m.season = ? AND i.is_super_over = false
        GROUP BY i.match_id, i.innings_number, i.batting_team, i.total_runs, i.total_wickets
        ORDER BY i.match_id, i.innings_number
    """, [season])

    # Build innings lookup: match_id -> list of innings
    innings_by_match: dict[str, list[dict]] = {}
    for inn in innings_data:
        mid = inn["match_id"]
        if mid not in innings_by_match:
            innings_by_match[mid] = []
        innings_by_match[mid].append(inn)

    # ── Aggregate team stats ──
    team_stats: dict[str, dict] = {}

    def _ensure_team(name: str):
        canonical = normalize_team(name)
        if canonical not in team_stats:
            team_stats[canonical] = {
                "team": canonical,
                "matches_played": 0,
                "wins": 0,
                "losses": 0,
                "no_results": 0,
                "points": 0,
                "runs_scored": 0,
                "balls_faced": 0,
                "runs_conceded": 0,
                "balls_bowled": 0,
            }
        return canonical

    for match in season_matches:
        t1 = _ensure_team(match["team1"])
        t2 = _ensure_team(match["team2"])

        team_stats[t1]["matches_played"] += 1
        team_stats[t2]["matches_played"] += 1

        winner = normalize_team(match["winner"]) if match["winner"] else None

        if match["result"] == "no result":
            team_stats[t1]["no_results"] += 1
            team_stats[t2]["no_results"] += 1
            team_stats[t1]["points"] += 1
            team_stats[t2]["points"] += 1
        elif winner:
            loser = t2 if winner == t1 else t1
            team_stats[winner]["wins"] += 1
            team_stats[winner]["points"] += 2
            team_stats[loser]["losses"] += 1

        # NRR components from innings data
        match_innings = innings_by_match.get(match["match_id"], [])
        for inn in match_innings:
            bt = normalize_team(inn["batting_team"])
            balls = int(inn["total_balls"] or 0)
            runs = int(inn["total_runs"] or 0)

            if bt in team_stats:
                team_stats[bt]["runs_scored"] += runs
                team_stats[bt]["balls_faced"] += balls

            # The other team bowled this innings
            other = t2 if bt == t1 else t1
            if other in team_stats:
                team_stats[other]["runs_conceded"] += runs
                team_stats[other]["balls_bowled"] += balls

    # ── Calculate NRR and projections ──
    # Standard IPL has 14 league matches per team
    TOTAL_LEAGUE_MATCHES = 14

    projections = []
    for ts in team_stats.values():
        played = ts["matches_played"]

        # Net Run Rate
        scoring_rate = _safe_div(ts["runs_scored"] * 6.0, ts["balls_faced"])
        conceding_rate = _safe_div(ts["runs_conceded"] * 6.0, ts["balls_bowled"])
        nrr = round(scoring_rate - conceding_rate, 3)

        # Project remaining matches based on current win rate
        remaining = max(TOTAL_LEAGUE_MATCHES - played, 0)
        current_win_rate = _safe_div(ts["wins"], played, 0.5)
        projected_additional_wins = round(remaining * current_win_rate)
        projected_points = ts["points"] + projected_additional_wins * 2

        # Qualification probability heuristic:
        # Historically ~16 points often qualifies; 18+ is safe
        if projected_points >= 18:
            qual_chance = min(95, 50 + projected_points * 2.5)
        elif projected_points >= 16:
            qual_chance = min(80, 30 + projected_points * 2)
        elif projected_points >= 14:
            qual_chance = min(50, projected_points * 2.5)
        elif projected_points >= 12:
            qual_chance = min(30, projected_points * 2)
        else:
            qual_chance = max(5, projected_points * 1.5)
        qual_chance = round(min(qual_chance, 99), 1)

        projections.append({
            "team": ts["team"],
            "matches_played": played,
            "wins": ts["wins"],
            "losses": ts["losses"],
            "points": ts["points"],
            "nrr": nrr,
            "projected_points": projected_points,
            "qualification_chance": qual_chance,
        })

    # Sort by points (desc), then NRR (desc)
    projections.sort(key=lambda x: (-x["points"], -x["nrr"]))

    return {
        "season": season,
        "projections": projections,
    }
