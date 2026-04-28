import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')
token = os.getenv('SPORTMONKS_API_TOKEN')

async def check_matches():
    url = f"https://cricket.sportmonks.com/api/v2.0/fixtures?api_token={token}&filter[starts_between]=2026-04-27,2026-04-27&include=localteam,visitorteam,league"
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        data = r.json()
        for fixture in data.get('data', []):
            league = fixture.get('league', {}).get('name', '')
            if 'Indian Premier League' in league or 'IPL' in league:
                print(f"Match ID: {fixture['id']}, {fixture['localteam']['name']} vs {fixture['visitorteam']['name']}, Status: {fixture['status']}")

if __name__ == "__main__":
    asyncio.run(check_matches())
