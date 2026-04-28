import asyncio
import os
import httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')
token = os.getenv('SPORTMONKS_API_TOKEN')

async def check_fixture(fid):
    url = f"https://cricket.sportmonks.com/api/v2.0/fixtures/{fid}?api_token={token}&include=localteam,visitorteam,league"
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        data = r.json()
        if 'data' not in data:
            print(f"No data for {fid}")
            return
        fixture = data['data']
        league_data = fixture.get('league', {})
        league = league_data.get('name', '') if league_data else ""
        date = fixture.get('starting_at', '')[:10]
        print(f"Match ID: {fixture['id']}, Date: {date}, {fixture['localteam']['name']} vs {fixture['visitorteam']['name']}, League: {league}, Status: {fixture['status']}")

async def main():
    for fid in range(69631, 69636):
        await check_fixture(fid)

if __name__ == "__main__":
    asyncio.run(main())
