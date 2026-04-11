"""Build Cricsheet-shaped JSON from a Sportmonks fixture (with ``balls``) for ingest.py."""

from __future__ import annotations

import math
import re
from collections import defaultdict
from typing import Any

from .database import normalize_team


def _unwrap(obj: Any) -> dict | None:
    if not isinstance(obj, dict):
        return None
    inner = obj.get("data")
    if isinstance(inner, dict):
        return inner
    return obj


def _player_name(p_raw: Any) -> str:
    p = _unwrap(p_raw) or (p_raw if isinstance(p_raw, dict) else None)
    if not isinstance(p, dict):
        return ""
    return (p.get("fullname") or p.get("lastname") or "").strip()


def _team_name(obj: Any) -> str:
    o = _unwrap(obj) or (obj if isinstance(obj, dict) else None)
    if not isinstance(o, dict):
        return ""
    return (o.get("name") or o.get("code") or "").strip()


def _ball_decimal_parts(ball_val: float | int) -> tuple[int, int]:
    """Sportmonks ball index: 1.3 → over 1, third delivery in that over."""
    x = float(ball_val)
    whole = int(math.floor(x + 1e-9))
    frac = x - whole
    ball_ord = int(round(frac * 10 + 1e-9))
    if ball_ord == 0:
        ball_ord = 1
    return whole, ball_ord


def _scoreboard_sort_key(sb: str) -> tuple[int, str]:
    u = (sb or "S1").upper()
    m = re.match(r"S(\d+)", u)
    n = int(m.group(1)) if m else 1
    return (n, u)


def _map_dismissal(score_name: str) -> str | None:
    n = (score_name or "").lower()
    if "catch" in n:
        return "caught"
    if "lbw" in n:
        return "lbw"
    if "bowled" in n:
        return "bowled"
    if "run out" in n or "runout" in n.replace(" ", ""):
        return "run out"
    if "stump" in n:
        return "stumped"
    if "hit wicket" in n or "hitwicket" in n.replace(" ", ""):
        return "hit wicket"
    if "obstruct" in n:
        return "obstructing the field"
    if "retired" in n:
        return "retired hurt"
    return None


def _id_to_name_map(balls: list[dict]) -> dict[int, str]:
    m: dict[int, str] = {}
    for b in balls:
        for key in ("batsman", "bowler", "catchstump", "catch_stump"):
            p = _unwrap(b.get(key)) or (b.get(key) if isinstance(b.get(key), dict) else None)
            if isinstance(p, dict) and p.get("id") is not None:
                nm = (p.get("fullname") or p.get("lastname") or "").strip()
                if nm:
                    m[int(p["id"])] = nm
    return m


def _collect_registry(fixture: dict, balls: list[dict]) -> dict[str, str]:
    reg: dict[str, str] = {}
    for b in balls:
        for key in ("batsman", "bowler", "catchstump", "catch_stump"):
            p = _unwrap(b.get(key)) or (b.get(key) if isinstance(b.get(key), dict) else None)
            if isinstance(p, dict) and p.get("id") is not None:
                name = (p.get("fullname") or p.get("lastname") or "").strip()
                if name:
                    reg[name] = f"sm_{p['id']}"
    for blk_key in ("batting", "bowling"):
        blk = fixture.get(blk_key)
        lst = blk.get("data", []) if isinstance(blk, dict) else blk if isinstance(blk, list) else []
        for row in lst:
            pl = _unwrap(row.get("batsman") or row.get("bowler"))
            if isinstance(pl, dict) and pl.get("id"):
                name = (pl.get("fullname") or pl.get("lastname") or "").strip()
                if name:
                    reg[name] = f"sm_{pl['id']}"
    return reg


def sm_ball_to_cricsheet_delivery(ball: dict, id_to_name: dict[int, str]) -> dict[str, Any]:
    sc = ball.get("score") if isinstance(ball.get("score"), dict) else {}
    score_name = sc.get("name") or ""
    sn = score_name.lower()
    runs_field = int(sc.get("runs") or 0)
    leg_bye = int(sc.get("leg_bye") or 0)
    bye = int(sc.get("bye") or 0)
    nob = int(sc.get("noball") or 0)
    nob_extra = int(sc.get("noball_runs") or 0)
    is_wicket = bool(sc.get("is_wicket") or sc.get("out"))
    batsman_out_id = ball.get("batsmanout_id")

    batter = _player_name(ball.get("batsman"))
    bowler = _player_name(ball.get("bowler"))

    extras: dict[str, int] = {}
    if "wide" in sn and nob == 0:
        mw = re.search(r"(\d+)\s*wide", sn)
        wcount = int(mw.group(1)) if mw else 1
        extras["wides"] = wcount
        runs_batter = 0
        runs_extras = runs_field
        runs_total = runs_field
    elif nob:
        extras["noballs"] = 1
        # noball_runs = no-ball penalty (1), not the batter's runs.
        # Batter's contribution = total runs - 1 (penalty).
        runs_batter = max(0, runs_field - 1)
        runs_extras = 1
        runs_total = runs_field
    elif leg_bye:
        extras["legbyes"] = leg_bye
        runs_batter = 0
        runs_extras = leg_bye
        runs_total = leg_bye
    elif bye:
        extras["byes"] = bye
        runs_batter = 0
        runs_extras = bye
        runs_total = bye
    else:
        runs_batter = runs_field
        runs_extras = 0
        runs_total = runs_field

    striker_id = ball.get("batsman_id")
    non_striker = ""
    for pid in (ball.get("batsman_one_on_creeze_id"), ball.get("batsman_two_on_creeze_id")):
        if pid is not None and int(pid) != int(striker_id or 0):
            non_striker = id_to_name.get(int(pid), "")
            break

    delivery: dict[str, Any] = {
        "batter": batter,
        "bowler": bowler,
        "non_striker": non_striker,
        "runs": {
            "batter": runs_batter,
            "extras": runs_extras,
            "total": runs_total,
        },
    }
    if extras:
        delivery["extras"] = extras

    if is_wicket or batsman_out_id is not None:
        kind = _map_dismissal(score_name) or "out"
        dismissed_id = batsman_out_id or striker_id
        player_out = batter
        if dismissed_id is not None:
            player_out = id_to_name.get(int(dismissed_id), batter)
        fielders: list[dict[str, str]] = []
        cs = ball.get("catchstump") or ball.get("catch_stump")
        fn = _player_name(cs)
        if fn and kind in ("caught", "stumped", "run out"):
            fielders.append({"name": fn})
        wk: dict[str, Any] = {"player_out": player_out, "kind": kind}
        if fielders:
            wk["fielders"] = fielders
        delivery["wickets"] = [wk]

    return delivery


def _dedupe(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in seq:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _extract_pom(fixture: dict) -> list[str]:
    raw = fixture.get("manofmatch") or fixture.get("man_of_match")
    if isinstance(raw, dict) and "data" in raw:
        d = raw["data"]
        if isinstance(d, list) and d:
            d = d[0]
        if isinstance(d, dict):
            pl = d.get("player")
            inner = _unwrap(pl) or (pl if isinstance(pl, dict) else None)
            if isinstance(inner, dict):
                nm = (inner.get("fullname") or inner.get("lastname") or "").strip()
                return [nm] if nm else []
            nm = _player_name(d)
            return [nm] if nm else []
    if isinstance(raw, dict):
        nm = _player_name(raw)
        return [nm] if nm else []
    return []


def fixture_balls_list(fixture: dict) -> list[dict]:
    balls_raw = fixture.get("balls")
    if isinstance(balls_raw, list):
        return balls_raw
    if isinstance(balls_raw, dict) and isinstance(balls_raw.get("data"), list):
        return balls_raw["data"]
    return []


def normalize_cricsheet_names_to_duckdb(doc: dict[str, Any]) -> None:
    """Map Sportmonks full names to existing Cricsheet names in DuckDB (e.g. Virat Kohli → V Kohli)."""
    try:
        from .player_resolve import resolve_player_name
    except Exception:
        return

    reg = doc.get("info", {}).get("registry", {}).get("people", {})

    def move_reg(old: str, new: str) -> None:
        if old == new or not old:
            return
        if old in reg:
            rid = reg.pop(old)
            if new not in reg:
                reg[new] = rid

    for inn in doc.get("innings", []):
        for ob in inn.get("overs", []):
            for d in ob.get("deliveries", []):
                b = d.get("batter")
                if b:
                    nb = resolve_player_name(b, "bat", allow_aliases=True)
                    move_reg(b, nb)
                    d["batter"] = nb
                n = d.get("non_striker")
                if n:
                    nn = resolve_player_name(n, "bat", allow_aliases=True)
                    move_reg(n, nn)
                    d["non_striker"] = nn
                bw = d.get("bowler")
                if bw:
                    nbw = resolve_player_name(bw, "bowl", allow_aliases=True)
                    move_reg(bw, nbw)
                    d["bowler"] = nbw
                for w in d.get("wickets", []) or []:
                    po = w.get("player_out")
                    if po:
                        npo = resolve_player_name(po, "bat", allow_aliases=True)
                        move_reg(po, npo)
                        w["player_out"] = npo
                    for f in w.get("fielders", []) or []:
                        if isinstance(f, dict) and f.get("name"):
                            nm = f["name"]
                            nnm = resolve_player_name(nm, "bat", allow_aliases=True)
                            move_reg(nm, nnm)
                            f["name"] = nnm

    pl = doc.get("info", {}).get("players", {})
    for team in list(pl.keys()):
        pl[team] = _dedupe(
            [resolve_player_name(x, "bat", allow_aliases=True) for x in pl[team] if x]
        )

    pom = doc.get("info", {}).get("player_of_match")
    if isinstance(pom, list):
        doc["info"]["player_of_match"] = [
            resolve_player_name(p, "bat", allow_aliases=True) for p in pom if p
        ]


def fixture_to_cricsheet(
    fixture: dict,
    *,
    match_id: str,
    season: str | int | None = None,
) -> dict[str, Any]:
    """Return a dict suitable for MatchExtractor / ingest.py (``meta``, ``info``, ``innings``)."""
    local = _unwrap(fixture.get("localteam")) or fixture.get("localteam")
    visitor = _unwrap(fixture.get("visitorteam")) or fixture.get("visitorteam")
    t1 = normalize_team(_team_name(local))
    t2 = normalize_team(_team_name(visitor))
    local_id = fixture.get("localteam_id")
    visitor_id = fixture.get("visitorteam_id")

    balls = fixture_balls_list(fixture)
    if not balls:
        raise ValueError("fixture_to_cricsheet: fixture has no balls")

    balls_sorted = sorted(balls, key=lambda b: float(b.get("ball", 0)))
    id_to_name = _id_to_name_map(balls_sorted)
    registry_people = _collect_registry(fixture, balls_sorted)

    squad_t1: list[str] = []
    squad_t2: list[str] = []
    for b in balls_sorted:
        tid = b.get("team_id")
        is_local = tid == local_id
        bt = _player_name(b.get("batsman"))
        bw = _player_name(b.get("bowler"))
        if bt:
            (squad_t1 if is_local else squad_t2).append(bt)
        if bw:
            (squad_t2 if is_local else squad_t1).append(bw)

    venue_name = ""
    city = ""
    v = _unwrap(fixture.get("venue")) or fixture.get("venue")
    if isinstance(v, dict):
        venue_name = (v.get("name") or "").strip()
        city = (v.get("city") or "").strip()

    toss_winner = ""
    twid = fixture.get("toss_won_team_id")
    if twid == local_id:
        toss_winner = t1
    elif twid == visitor_id:
        toss_winner = t2
    elected_raw = (fixture.get("elected") or "").lower()
    toss_decision = "bat" if "bat" in elected_raw else "field"

    winner_tid = fixture.get("winner_team_id")
    winner: str | None = None
    if winner_tid == local_id:
        winner = t1
    elif winner_tid == visitor_id:
        winner = t2

    note = (fixture.get("note") or "").strip()
    outcome: dict[str, Any] = {}
    if winner:
        outcome["winner"] = winner
        mruns = re.search(r"by\s+(\d+)\s+run", note, re.I)
        mwkt = re.search(r"by\s+(\d+)\s+wickets?", note, re.I)
        if mruns:
            outcome["by"] = {"runs": int(mruns.group(1))}
        elif mwkt:
            outcome["by"] = {"wickets": int(mwkt.group(1))}
        if "by" not in outcome:
            runs_data = _unwrap(fixture.get("runs")) or fixture.get("runs")
            if isinstance(runs_data, list) and len(runs_data) >= 2:
                inn_scores: dict[int, int] = {}
                inn_wickets: dict[int, int] = {}
                for rd in runs_data:
                    if isinstance(rd, dict):
                        inning = rd.get("inning", 0)
                        inn_scores[inning] = rd.get("score", 0)
                        inn_wickets[inning] = rd.get("wickets", 0)
                if len(inn_scores) >= 2:
                    s1 = inn_scores.get(1, 0)
                    s2 = inn_scores.get(2, 0)
                    w2 = inn_wickets.get(2, 10)
                    if s2 > s1:
                        outcome["by"] = {"wickets": 10 - w2}
                    elif s1 > s2:
                        outcome["by"] = {"runs": s1 - s2}
    if "tie" in note.lower() and "won" not in note.lower():
        outcome["result"] = "tie"
    if "no result" in note.lower():
        outcome["result"] = "no result"

    pom = _extract_pom(fixture)

    sea = season
    if sea is None:
        s_obj = _unwrap(fixture.get("season")) or fixture.get("season")
        if isinstance(s_obj, dict):
            sea = s_obj.get("name") or s_obj.get("id")
        elif isinstance(s_obj, (int, str)):
            sea = s_obj
        else:
            sea = fixture.get("season_id")
    if sea is None or sea == "":
        sea = "2026"

    league_name = "Indian Premier League"
    lg = _unwrap(fixture.get("league")) or fixture.get("league")
    if isinstance(lg, dict) and lg.get("name"):
        league_name = lg["name"]

    match_no: int | None = None
    rnd = (fixture.get("round") or "").strip()
    mnum = re.search(r"(\d+)(?:st|nd|rd|th)?", rnd, re.I)
    if mnum:
        try:
            match_no = int(mnum.group(1))
        except ValueError:
            pass

    date_str = (fixture.get("starting_at") or "")[:10]

    by_sb: dict[str, list[dict]] = defaultdict(list)
    for b in balls_sorted:
        sb = str(b.get("scoreboard") or "S1")
        by_sb[sb].append(b)

    scoreboard_keys = sorted(by_sb.keys(), key=_scoreboard_sort_key)
    innings_out: list[dict[str, Any]] = []
    for sb in scoreboard_keys:
        lst = by_sb[sb]
        team_id_first = lst[0].get("team_id")
        batting = t1 if team_id_first == local_id else t2
        sb_order = _scoreboard_sort_key(sb)[0]
        is_super_over = sb_order >= 3

        by_over: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for ball in lst:
            ov, _ = _ball_decimal_parts(ball.get("ball", 0))
            by_over[ov].append(sm_ball_to_cricsheet_delivery(ball, id_to_name))
        overs_blocks = [{"over": ov, "deliveries": by_over[ov]} for ov in sorted(by_over.keys())]
        inn: dict[str, Any] = {"team": batting, "overs": overs_blocks}
        if is_super_over:
            inn["super_over"] = True
        innings_out.append(inn)

    event: dict[str, Any] = {"name": league_name}
    if match_no is not None:
        event["match_number"] = match_no

    season_val: Any = int(sea) if str(sea).isdigit() else sea

    info: dict[str, Any] = {
        "balls_per_over": 6,
        "city": city or None,
        "dates": [date_str] if date_str else [],
        "event": event,
        "gender": "male",
        "match_type": "T20",
        "officials": {"umpires": []},
        "outcome": outcome,
        "players": {
            t1: _dedupe(squad_t1),
            t2: _dedupe(squad_t2),
        },
        "registry": {"people": registry_people},
        "season": season_val,
        "team_type": "club",
        "teams": [t1, t2],
        "toss": {"decision": toss_decision, "winner": toss_winner},
        "venue": venue_name,
    }
    if pom:
        info["player_of_match"] = pom

    doc: dict[str, Any] = {
        "meta": {"data_version": "1.0.0", "created": date_str or "", "revision": 1},
        "info": info,
        "innings": innings_out,
    }
    normalize_cricsheet_names_to_duckdb(doc)
    return doc
