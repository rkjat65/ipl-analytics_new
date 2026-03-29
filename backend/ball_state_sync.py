"""Derive current-over ball strip from consecutive scorecard snapshots.

Called when the poller (or score patch) saves a scorecard — same cricket API
response drives both full scorecard and live_ball_state; no extra client calls.
"""

from __future__ import annotations

import copy
from typing import Any

from .live_db import get_ball_state, upsert_ball_state


def _parse_overs(o: Any) -> tuple[int, int, int]:
    try:
        v = float(o or 0)
    except (TypeError, ValueError):
        v = 0.0
    comp = int(v)
    balls = int(round((v - comp) * 10))
    total = comp * 6 + balls
    return comp, balls, total


def _active_innings_score(scorecard: dict) -> dict | None:
    scores = scorecard.get("score") or []
    if not scores:
        return None
    for i in range(len(scores) - 1, -1, -1):
        try:
            if float(scores[i].get("o") or 0) > 0:
                return scores[i]
        except (TypeError, ValueError):
            continue
    return scores[-1]


def _snap_batsmen(sc: dict) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for inn in sc.get("scorecard") or []:
        for b in inn.get("batsmen") or inn.get("batting") or []:
            n = (b.get("name") or b.get("fullName") or "").strip()
            if not n:
                continue
            out[n] = {
                "runs": int(b.get("runs") or 0),
                "balls": int(b.get("balls") or 0),
                "fours": int(b.get("fours") or 0),
                "sixes": int(b.get("sixes") or 0),
            }
    return out


def _inum(s: dict) -> int:
    raw = s.get("inningNumber")
    if raw is not None:
        try:
            return int(raw)
        except (TypeError, ValueError):
            pass
    inn = s.get("inning")
    if isinstance(inn, int):
        return inn
    if isinstance(inn, str) and inn.isdigit():
        return int(inn)
    return 1


def _same_innings_row(prev_score: dict, curr_score: dict) -> bool:
    return _inum(prev_score) == _inum(curr_score)


def sync_ball_state(match_id: str, prev_sc: dict | None, curr_sc: dict | None) -> None:
    """Update live_ball_state from prev → curr scorecard (mirrors frontend useBallEvents)."""
    if not curr_sc or not curr_sc.get("scorecard"):
        return
    if not curr_sc.get("matchStarted") or curr_sc.get("matchEnded"):
        return

    curr_score = _active_innings_score(curr_sc)
    if not curr_score:
        return

    comp, ball_idx, total = _parse_overs(curr_score.get("o"))

    if not prev_sc or not prev_sc.get("scorecard"):
        upsert_ball_state(match_id, {"overComp": comp, "balls": []})
        return

    prev_score = _active_innings_score(prev_sc)
    if not prev_score or not _same_innings_row(prev_score, curr_score):
        upsert_ball_state(match_id, {"overComp": comp, "balls": []})
        return

    saved = get_ball_state(match_id) or {}
    balls: list[dict] = copy.deepcopy(saved.get("balls") or [])
    for b in balls:
        b.pop("isNew", None)

    p_comp, _p_ball, p_total = _parse_overs(prev_score.get("o"))

    try:
        curr_r = int(curr_score.get("r") or 0)
        prev_r = int(prev_score.get("r") or 0)
        curr_w = int(curr_score.get("w") or 0)
        prev_w = int(prev_score.get("w") or 0)
    except (TypeError, ValueError):
        upsert_ball_state(match_id, {"overComp": comp, "balls": balls})
        return

    d_r = curr_r - prev_r
    d_w = curr_w - prev_w

    if p_total == total and d_r == 0 and d_w == 0:
        upsert_ball_state(match_id, {"overComp": comp, "balls": balls})
        return

    prev_bat = _snap_batsmen(prev_sc)
    curr_bat = _snap_batsmen(curr_sc)

    new_over_started = comp > p_comp
    new_legal = total - p_total

    result = str(max(d_r, 0))
    b_type = "run"
    if d_w > 0:
        result = "W"
        b_type = "wicket"
    else:
        for name, c in curr_bat.items():
            p = prev_bat.get(name)
            if not p:
                continue
            if c["sixes"] > p["sixes"]:
                result = "6"
                b_type = "six"
                break
            if c["fours"] > p["fours"]:
                result = "4"
                b_type = "four"
                break

    is_extra = new_legal == 0 and d_r > 0

    if new_over_started and ball_idx == 0:
        new_balls: list[dict] = []
    elif new_legal > 0 or is_extra:
        entry = {
            "ballNum": ball_idx,
            "overComp": comp,
            "result": f"+{d_r}" if is_extra else result,
            "type": "extra" if is_extra else b_type,
            "runs": d_r,
        }
        if new_over_started:
            new_balls = [entry]
        else:
            new_balls = [b for b in balls if b.get("overComp") == comp] + [entry]
    elif new_over_started:
        new_balls = []
    else:
        new_balls = balls

    upsert_ball_state(match_id, {"overComp": comp, "balls": new_balls})
