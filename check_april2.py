import duckdb
import asyncio
import os

# Check if April 2 match exists
con = duckdb.connect('ipl.duckdb', read_only=True)
r = con.execute("SELECT match_id FROM matches WHERE date = '2026-04-02'").fetchall()
print('April 2 matches in DB:', r if r else 'None found')
con.close()

# Try to ingest April 2 if not present
if not r:
    print('April 2 match not found. Attempting to ingest...')
    os.environ['CRICKET_API_PROVIDER'] = 'sportmonks'
    os.environ['SPORTMONKS_API_TOKEN'] = 'vwUnuTL8gqwn3TXZ6BfraX9laipMKuXF3OqtJVQgbAcKU2Tz0n13Z0Rwq3f2'
    
    try:
        from backend.sportmonks_history import get_completed_ipl_fixture_ids, promote_sportmonks_fixture
        
        async def ingest_april2():
            fixture_ids = await get_completed_ipl_fixture_ids()
            for fid in fixture_ids:
                ok, hits = await promote_sportmonks_fixture(fid, skip_if_in_db=True)
                if ok:
                    print(f'Ingested fixture {fid}')
        
        asyncio.run(ingest_april2())
        print('April 2 ingestion complete')
    except Exception as e:
        print(f'Failed to ingest: {e}')
else:
    print('April 2 match already in database')
