import os
import sys
from pathlib import Path

# Add repo root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.ipl_schedule import IPL_2026_SCHEDULE
from backend.database import normalize_team

import duckdb
con = duckdb.connect('ipl.duckdb')
db_matches = con.execute("SELECT date, team1, team2 FROM matches").fetchall()
con.close()

db_set = set()
for row in db_matches:
    d = str(row[0])
    t1 = normalize_team(row[1])
    t2 = normalize_team(row[2])
    db_set.add((d, t1, t2))
    db_set.add((d, t2, t1))

print("Missing Matches in DuckDB (Normalized):")
count = 0
for m in IPL_2026_SCHEDULE:
    # Only check matches up to yesterday (April 27)
    if m['date'] > '2026-04-27':
        continue
        
    d = m['date']
    t1 = normalize_team(m['home'])
    t2 = normalize_team(m['away'])
    
    if (d, t1, t2) not in db_set:
        print(f"Match {m['match']}: {d} - {m['home']} vs {m['away']}")
        count += 1

print(f"Total missing: {count}")
