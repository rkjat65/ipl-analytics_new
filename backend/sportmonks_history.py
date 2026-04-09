"""Promote finished Sportmonks fixtures into ``ipl_json`` + ``ipl.duckdb`` (Cricsheet pipeline)."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import orjson

from .cricket_api import SportmonksProvider, get_cricket_api
from .database import refresh_db
from .live_db import get_match, get_scorecard, upsert_scorecard
from .sportmonks_cricsheet_export import fixture_to_cricsheet, normalize_cricsheet_names_to_duckdb

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
_IPL_JSON = REPO_ROOT / "ipl_json"
_DUCKDB = REPO_ROOT / "ipl.duckdb"


def _completed_match_status_from_doc(doc: dict) -> str:
    info = doc.get("info", {}) or {}
    outcome = info.get("outcome", {}) or {}
    winner = outcome.get("winner")
    by = outcome.get("by") or {}
    if winner and isinstance(by, dict):
        if by.get("runs"):
            return f"{winner} won by {by['runs']} runs"
        if by.get("wickets"):
            return f"{winner} won by {by['wickets']} wickets"
    result = (outcome.get("result") or "").strip()
    if result:
        return result[:1].upper() + result[1:]
    return "Completed"


def _score_summary_from_doc(doc: dict) -> list[dict]:
    scores: list[dict] = []
    for idx, inn in enumerate(doc.get("innings", []) or [], start=1):
        team = (inn.get("team") or "").strip()
        runs = 0
        wickets = 0
        legal_balls = 0
        for over in inn.get("overs", []) or []:
            for delivery in over.get("deliveries", []) or []:
                runs_info = delivery.get("runs") or {}
                runs += int(runs_info.get("total", 0) or 0)
                wickets += len(delivery.get("wickets", []) or [])
                extras = delivery.get("extras") or {}
                if not any(k in extras for k in ("wides", "noballs")):
                    legal_balls += 1
        overs = legal_balls // 6 + (legal_balls % 6) / 10
        inning_label = f"{team} (2nd)" if idx > 1 else team
        scores.append({
            "inning": inning_label,
            "team": team,
            "inningNumber": idx,
            "r": runs,
            "w": wickets,
            "o": overs,
            "score": f"{runs}/{wickets} ({overs})",
        })
    return scores


def _completed_scorecard_cache(doc: dict, match_id: str, previous: dict | None = None) -> dict:
    info = doc.get("info", {}) or {}
    teams = info.get("teams", []) or (previous.get("teams") if previous else []) or []
    toss = info.get("toss", {}) or {}
    pom_list = info.get("player_of_match") or []
    player_of_match = (
        {"name": pom_list[0]} if pom_list else (previous.get("playerOfMatch") if previous else None)
    )
    name = f"{teams[0]} vs {teams[1]}" if len(teams) >= 2 else (previous.get("name") if previous else match_id)
    return {
        "id": match_id,
        "name": name,
        "status": _completed_match_status_from_doc(doc),
        "venue": info.get("venue", "") or (previous.get("venue") if previous else ""),
        "date": (info.get("dates") or [""])[0] or (previous.get("date") if previous else ""),
        "dateTimeGMT": (previous.get("dateTimeGMT") if previous else "") or "",
        "teams": teams,
        "teamInfo": (previous.get("teamInfo") if previous else []) or [],
        "score": (previous.get("score") if previous and previous.get("score") else _score_summary_from_doc(doc)),
        "tossWinner": toss.get("winner", "") or (previous.get("tossWinner") if previous else ""),
        "tossChoice": toss.get("decision", "") or (previous.get("tossChoice") if previous else ""),
        "matchWinner": (info.get("outcome", {}) or {}).get("winner") or (previous.get("matchWinner") if previous else ""),
        "playerOfMatch": player_of_match,
        "scorecard": (previous.get("scorecard") if previous else []) or [],
        "matchStarted": True,
        "matchEnded": True,
    }


def _ingest_json_paths():
    root = str(REPO_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    from ingest import ingest_json_paths  # noqa: WPS433 — repo-root module

    return ingest_json_paths


def is_match_in_duckdb(db_path: Path, match_id: str) -> bool:
    if not db_path.is_file():
        return False
    import duckdb

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        r = con.execute(
            "SELECT 1 FROM matches WHERE match_id = ? LIMIT 1", [match_id]
        ).fetchone()
        return r is not None
    finally:
        con.close()


def fixture_matches_configured_season(fixture: dict) -> bool:
    """If SEASON_ID is set, only accept fixtures from that Sportmonks season."""
    expected = int(os.getenv("SEASON_ID", "0") or "0")
    if expected <= 0:
        return True
    try:
        return int(fixture.get("season_id") or 0) == expected
    except (TypeError, ValueError):
        return False


async def export_sportmonks_fixture_to_json(
    fixture_id: str,
    *,
    json_dir: Path | None = None,
    season: str | int | None = None,
) -> Path:
    api = get_cricket_api()
    if not isinstance(api, SportmonksProvider):
        raise RuntimeError(
            "export_sportmonks_fixture_to_json requires CRICKET_API_PROVIDER=sportmonks and token"
        )
    fixture = await api.fetch_fixture_raw_for_ingest(fixture_id)
    match_id = f"sm_{fixture_id}"
    doc = fixture_to_cricsheet(fixture, match_id=match_id, season=season)
    normalize_cricsheet_names_to_duckdb(doc)
    out_dir = json_dir or _IPL_JSON
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{match_id}.json"
    out_path.write_bytes(orjson.dumps(doc, option=orjson.OPT_INDENT_2))
    log.info("Wrote %s", out_path)
    return out_path


def ingest_sm_json(match_id: str, *, db_path: Path | None = None) -> None:
    ingest_json_paths = _ingest_json_paths()
    jp = _IPL_JSON / f"{match_id}.json"
    if not jp.is_file():
        raise FileNotFoundError(jp)
    ingest_json_paths(db_path or _DUCKDB, [jp], replace_existing_match=True)
    refresh_db()


async def promote_sportmonks_fixture(
    fixture_id: str,
    *,
    db_path: Path | None = None,
    json_dir: Path | None = None,
    season: str | int | None = None,
    skip_if_in_db: bool = True,
) -> tuple[bool, int]:
    """Fetch balls, write ``ipl_json/sm_<id>.json``, ingest into DuckDB.

    Returns ``(ingested_ok, sportmonks_api_calls)`` where API calls are 0 (skipped) or 1 (fetched fixture).
    """
    match_id = f"sm_{fixture_id}"
    db = db_path or _DUCKDB
    if skip_if_in_db and is_match_in_duckdb(db, match_id):
        log.info("promote_sportmonks_fixture: %s already in DuckDB", match_id)
        return False, 0
    api = get_cricket_api()
    if not isinstance(api, SportmonksProvider):
        raise RuntimeError("promote_sportmonks_fixture requires SportmonksProvider")
    fixture = await api.fetch_fixture_raw_for_ingest(fixture_id)
    if not fixture_matches_configured_season(fixture):
        log.info(
            "promote_sportmonks_fixture: fixture %s season_id=%s does not match SEASON_ID — skip",
            fixture_id,
            fixture.get("season_id"),
        )
        return False, 1
    doc = fixture_to_cricsheet(fixture, match_id=match_id, season=season)
    normalize_cricsheet_names_to_duckdb(doc)
    out_dir = json_dir or _IPL_JSON
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{match_id}.json"
    out_path.write_bytes(orjson.dumps(doc, option=orjson.OPT_INDENT_2))
    ingest_json_paths = _ingest_json_paths()
    ingest_json_paths(db, [out_path], replace_existing_match=True)
    refresh_db()
    
    # Cache in live_scores.db for dashboard visibility
    try:
        scorecard_cache = _completed_scorecard_cache(doc, match_id, get_scorecard(match_id) or {})
        upsert_scorecard(match_id, scorecard_cache)

        plain_fixture_id = str(fixture_id)
        if plain_fixture_id != match_id:
            plain_cache = _completed_scorecard_cache(doc, plain_fixture_id, get_scorecard(plain_fixture_id) or {})
            upsert_scorecard(plain_fixture_id, plain_cache)

        log.info("Cached %s in live_scores.db for dashboard", match_id)
    except Exception as e:
        log.warning("Failed to cache %s in live_scores.db: %s", match_id, e)
    
    log.info("Promoted %s into DuckDB (connections refreshed)", match_id)
    return True, 1


async def get_completed_ipl_fixture_ids() -> list[str]:
    """Return Sportmonks fixture IDs for IPL matches that are completed."""
    api = get_cricket_api()
    if not isinstance(api, SportmonksProvider):
        raise RuntimeError("get_completed_ipl_fixture_ids requires SportmonksProvider")
    matches = await api.fetch_matches()
    return [
        m["id"]
        for m in matches
        if m.get("id") and m.get("isIPL") and m.get("matchEnded")
    ]


async def promote_completed_ipl_fixtures(
    *,
    db_path: Path | None = None,
    json_dir: Path | None = None,
    season: str | int | None = None,
    skip_if_in_db: bool = True,
    max_fixtures: int | None = None,
) -> tuple[int, int]:
    """Fetch and ingest completed IPL fixtures from Sportmonks (idempotent)."""
    fixture_ids = await get_completed_ipl_fixture_ids()
    if max_fixtures is not None:
        fixture_ids = fixture_ids[:max_fixtures]

    promoted = 0
    hits = 0
    for fixture_id in fixture_ids:
        try:
            ok, h = await promote_sportmonks_fixture(
                fixture_id,
                db_path=db_path,
                json_dir=json_dir,
                season=season,
                skip_if_in_db=skip_if_in_db,
            )
            hits += h
            if ok:
                promoted += 1
        except Exception:
            log.warning(
                "promote_completed_ipl_fixtures: skipped %s due to error",
                fixture_id,
                exc_info=True,
            )
    log.info(
        "promote_completed_ipl_fixtures: promoted=%d candidates=%d hits=%d",
        promoted,
        len(fixture_ids),
        hits,
    )
    return promoted, hits


async def try_promote_after_scorecard(match_id: str, scorecard: dict) -> int:
    """Called from live poller after caching a scorecard.

    If the match is finished IPL on Sportmonks, fetches ball-by-ball once and ingests.
    Returns extra Sportmonks API calls consumed (0 or 1).
    """
    api = get_cricket_api()
    if not isinstance(api, SportmonksProvider):
        return 0
    if not scorecard.get("matchEnded"):
        return 0

    # Check isIPL from live_db first; fall back to scorecard series name so deploys
    # that wiped live_db (ephemeral Railway filesystem) still auto-promote correctly.
    lm = get_match(match_id)
    if lm:
        is_ipl = bool(lm.get("isIPL"))
    else:
        series = (scorecard.get("series") or "").lower()
        is_ipl = "indian premier league" in series or "ipl" in series

    if not is_ipl:
        return 0
    try:
        _, hits = await promote_sportmonks_fixture(match_id, skip_if_in_db=True)
        return hits
    except Exception:
        log.warning("try_promote_after_scorecard failed for %s", match_id, exc_info=True)
        return 0
