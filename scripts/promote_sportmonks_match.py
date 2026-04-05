#!/usr/bin/env python3
"""Export a finished Sportmonks fixture (ball-by-ball) to ipl_json and ingest into ipl.duckdb.

Requires CRICKET_API_PROVIDER=sportmonks and SPORTMONKS_API_TOKEN.

Examples::

  python scripts/promote_sportmonks_match.py 8661
  python scripts/promote_sportmonks_match.py 8661 --json-only
  python scripts/promote_sportmonks_match.py 8661 --db /path/to/ipl.duckdb
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / "backend" / ".env", override=False)
    load_dotenv(ROOT / ".env", override=False)
except ImportError:
    pass


async def _run(
    fixture_id: str | None,
    json_only: bool,
    db_path: Path | None,
    all_fixtures: bool,
) -> None:
    from backend.sportmonks_history import (
        export_sportmonks_fixture_to_json,
        promote_completed_ipl_fixtures,
        promote_sportmonks_fixture,
    )

    if json_only:
        if not fixture_id:
            raise ValueError("fixture_id required for --json-only")
        path = await export_sportmonks_fixture_to_json(fixture_id)
        print(f"Wrote {path}")
        print(f"Ingest: python ingest.py --src ipl_json --only sm_{fixture_id}.json")
        return

    if all_fixtures:
        promoted, hits = await promote_completed_ipl_fixtures(db_path=db_path)
        print(f"API calls: {hits}, promoted: {promoted} finished IPL fixtures")
        return

    if not fixture_id:
        raise ValueError("fixture_id required unless --all is used")

    ingested, hits = await promote_sportmonks_fixture(
        fixture_id, db_path=db_path, skip_if_in_db=False
    )
    print(f"API calls: {hits}, ingested: {ingested}, match_id=sm_{fixture_id}")


def main() -> None:
    p = argparse.ArgumentParser(description="Promote Sportmonks fixture into historical DuckDB")
    p.add_argument(
        "fixture_id",
        nargs="?",
        help="Sportmonks fixture id (same as live match id)",
    )
    p.add_argument(
        "--json-only",
        action="store_true",
        help="Only write ipl_json/sm_<id>.json (no DuckDB)",
    )
    p.add_argument(
        "--all",
        action="store_true",
        help="Promote all completed IPL fixtures from Sportmonks (skip already ingested)",
    )
    p.add_argument("--db", type=Path, default=None, help="DuckDB path (default: repo ipl.duckdb)")
    args = p.parse_args()
    asyncio.run(_run(args.fixture_id, args.json_only, args.db, args.all))


if __name__ == "__main__":
    main()
