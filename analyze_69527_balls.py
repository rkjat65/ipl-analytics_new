import sqlite3, os, json
db_path = r'c:\IPL\ipl-analytics_new\backend\data\live_scores.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

match_id = '69527'
print(f"--- BALL ANALYSIS FOR {match_id} ---")

# Check all bowlers mentioned in balls
rows = conn.execute("SELECT bowler, count(*) as cnt FROM live_balls WHERE match_id = ? GROUP BY bowler", (match_id,)).fetchall()
for r in rows:
    print(f"Bowler Name: '{r['bowler']}' | Count: {r['cnt']}")

# Check Prince Yadav balls specifically
print("\n--- PRINCE YADAV BALLS ---")
py_rows = conn.execute("SELECT ball_decimal, scoreboard, extra_type, runs_total, ball_id FROM live_balls WHERE match_id = ? AND bowler = 'Prince Yadav'", (match_id,)).fetchall()
for r in py_rows:
    print(f"D: {r['ball_decimal']} | SB: {r['scoreboard']} | T: {r['extra_type']} | R: {r['runs_total']} | ID: {r['ball_id']}")

conn.close()
