import asyncio
import logging
import sys
import os
from pathlib import Path

# Add repo root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.sportmonks_history import promote_completed_ipl_fixtures
from dotenv import load_dotenv

# Load .env
load_dotenv(Path(__file__).resolve().parents[3] / "backend" / ".env", override=True)

logging.basicConfig(level=logging.INFO)

async def main():
    print("Backfilling missing IPL 2026 fixtures from Sportmonks...")
    promoted, hits = await promote_completed_ipl_fixtures(season='2026', skip_if_in_db=True)
    print(f"Promoted: {promoted}, Hits: {hits}")

if __name__ == "__main__":
    asyncio.run(main())
