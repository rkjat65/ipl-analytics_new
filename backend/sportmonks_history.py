"""Promote finished Sportmonks fixtures into ``ipl_json`` + ``ipl.duckdb`` (Cricsheet pipeline)."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import orjson

from .cricket_api import SportmonksProvider, get_cricket_api
from .database import refresh_db
from .live_db import get_match
from .sportmonks_cricsheet_export import fixture_to_cricsheet, normalize_cricsheet_names_to_duckdb

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
_IPL_JSON = REPO_ROOT / "ipl_json"
_DUCKDB = REPO_ROOT / "ipl.duckdb"


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
    log.info("Promoted %s into DuckDB (connections refreshed)", match_id)
    return True, 1


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
    lm = get_match(match_id)
    if not lm or not lm.get("isIPL"):
        return 0
    try:
        _, hits = await promote_sportmonks_fixture(match_id, skip_if_in_db=True)
        return hits
    except Exception:
        log.warning("try_promote_after_scorecard failed for %s", match_id, exc_info=True)
        return 0
