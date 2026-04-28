#!/usr/bin/env python3
"""Backfill captain lineups from Sportmonks into SQLite for DuckDB IPL seasons.

Loads ``backend/.env`` and project ``.env``. Requires Sportmonks token and
``CRICKET_API_PROVIDER=sportmonks``.

Usage (from repo root):
  python scripts/backfill_ipl_captains_sportmonks.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

for p in (ROOT / "backend" / ".env", ROOT / ".env"):
    load_dotenv(p, override=False)


# Sportmonks IPL league id = 1 (Indian Premier League). Season ids from GET /seasons?filter[league_id]=1
SM_IPL_SEASON_BY_DUCK: dict[str, int | list[int]] = {
    "2026": 1795,
    "2025": 1689,
    "2024": 1484,
    "2023": 1223,
    "2022": 932,
    "2021": 708,
    "2020": 423,
    # Cricsheet uses "2020/21" for the UAE + India split IPL; Sportmonks split 2020 vs 2021 seasons.
    "2020/21": [423, 708],
    "2019": 2,
    "2018": 92,
    "2017": 95,
    "2016": 98,
    "2015": 101,
    "2014": 441,
    "2013": 444,
}


async def main() -> None:
    from backend.live_db import init_live_db
    from backend.captain_enrichment import enrich_duckdb_season_from_sportmonks
    from backend.cricket_api import get_cricket_api, SportmonksProvider

    if not isinstance(get_cricket_api(), SportmonksProvider):
        print("Set CRICKET_API_PROVIDER=sportmonks and SPORTMONKS_API_TOKEN in backend/.env")
        sys.exit(1)

    init_live_db()

    import duckdb

    duck_path = os.environ.get("DUCKDB_PATH") or str(ROOT / "ipl.duckdb")
    con = duckdb.connect(duck_path, read_only=True)
    seasons = [
        r[0]
        for r in con.execute(
            "SELECT DISTINCT CAST(season AS VARCHAR) FROM matches ORDER BY season DESC"
        ).fetchall()
    ]
    con.close()

    print("DuckDB seasons found:", len(seasons), flush=True)
    total_written = 0
    for duck in seasons:
        sm = SM_IPL_SEASON_BY_DUCK.get(duck)
        if sm is None:
            print(
                f"  skip {duck!r} — no Sportmonks season on this plan (IPL data starts ~2013).",
                flush=True,
            )
            continue
        ids = sm if isinstance(sm, list) else [sm]
        for sm_id in ids:
            print(f"  enrich duck={duck!r} sportmonks_season_id={sm_id} …", flush=True)
            rep = await enrich_duckdb_season_from_sportmonks(
                duck,
                sm_id,
                dry_run=False,
                max_pages=25,
            )
            print(
                f"    matched={rep['fixturesMatchedToDuckdb']} written={rep['rowsWritten']} "
                f"no_duck={rep['noDuckdbMatchForFixture']} no_lineup={rep['skippedNoLineupCaptains']} "
                f"detail_fetches={rep.get('fixtureDetailFetches')} pages={rep['pagesFetched']}",
                flush=True,
            )
            total_written += rep["rowsWritten"]

    print("Done. Total row writes (may include overlap for 2020/21):", total_written, flush=True)
    print("Check stats: GET /api/analytics/captain-stats-duckdb?season=2023")


if __name__ == "__main__":
    asyncio.run(main())
