import os
import sys
from pathlib import Path

# Add repo root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.ipl_schedule import IPL_2026_SCHEDULE

json_dir = Path("ipl_json")
existing_files = set(os.listdir(json_dir))

missing = []
for m in IPL_2026_SCHEDULE:
    # We don't know the SM ID yet, but we can check the DuckDB later
    pass

# Better: Check DuckDB matches
import duckdb
con = duckdb.connect('ipl.duckdb')
db_matches = con.execute("SELECT date, team1, team2 FROM matches").fetchall()
con.close()

db_set = set()
for row in db_matches:
    db_set.add((str(row[0]), row[1], row[2]))
    db_set.add((str(row[0]), row[2], row[1]))

print("Missing Matches in DuckDB:")
count = 0
for m in IPL_2026_SCHEDULE:
    if (m['date'], m['home'], m['away']) not in db_set:
        print(f"Match {m['match']}: {m['date']} - {m['home']} vs {m['away']}")
        count += 1

print(f"Total missing: {count}")
