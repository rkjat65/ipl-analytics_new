import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')
token = os.getenv('SPORTMONKS_API_TOKEN')

async def check_matches(date):
    print(f"Checking {date}...")
    # The filter for date in Sportmonks is often filter[starts_between] or filter[starting_at]
    # Let's try fixtures?api_token=...&filter[starts_between]=date,date
    url = f"https://cricket.sportmonks.com/api/v2.0/fixtures?api_token={token}&filter[starts_between]={date},{date}&include=localteam,visitorteam,league"
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        data = r.json()
        if 'data' not in data:
            print(f"No data for {date}: {data}")
            return
        for fixture in data.get('data', []):
            league_data = fixture.get('league', {})
            # League might be nested in data or not
            league = ""
            if league_data:
                league = league_data.get('name', '')
            print(f"Match ID: {fixture['id']}, {fixture['localteam']['name']} vs {fixture['visitorteam']['name']}, League: {league}, Status: {fixture['status']}")

async def main():
    await check_matches('2026-04-26')
    await check_matches('2026-04-27')

if __name__ == "__main__":
    asyncio.run(main())
