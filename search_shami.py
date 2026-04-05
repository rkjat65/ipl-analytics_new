import sqlite3, os, json
db_path = r'c:\IPL\ipl-analytics_new\backend\data\live_scores.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print("Looking for 'Shami' in all scorecards...")
rows = conn.execute("SELECT match_id, data FROM live_scorecards").fetchall()
found = False
for r in rows:
    sc_str = r['data']
    if "Shami" in sc_str:
        print(f"Match {r['match_id']} found")
        found = True
if not found:
    print("Not found in scorecards table.")

print("\nLooking for 'Shami' in all match records...")
rows = conn.execute("SELECT match_id, data FROM live_matches").fetchall()
for r in rows:
    if "Shami" in r['data']:
        print(f"Match {r['match_id']} found in matches table")
conn.close()
