import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add repo root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.cricket_api import get_cricket_api, SportmonksProvider

# Load .env
load_dotenv(Path(__file__).resolve().parents[3] / "backend" / ".env", override=True)

async def main():
    api = get_cricket_api()
    if not isinstance(api, SportmonksProvider):
        print("Sportmonks provider not configured")
        return

    # Check fixtures between April 17 and April 19
    start = "2026-04-17"
    end = "2026-04-19"
    
    print(f"Fetching fixtures between {start} and {end}...")
    try:
        # Sportmonks API v2.0: fixtures/between/{start}/{end}
        res = await api._call(f"fixtures/between/{start}/{end}", include="localteam,visitorteam,league")
        fixtures = res.get("data", [])
        for f in fixtures:
            league = f.get("league", {}).get("data", {}).get("name", "")
            if "Indian Premier League" in league or "IPL" in league:
                print(f"Date: {f.get('starting_at')[:10]} | ID: {f.get('id')} | {f.get('localteam', {}).get('data', {}).get('name')} vs {f.get('visitorteam', {}).get('data', {}).get('name')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
