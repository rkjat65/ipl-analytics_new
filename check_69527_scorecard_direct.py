import sqlite3, os, json
db_path = r'c:\IPL\ipl-analytics_new\backend\data\live_scores.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

match_id = '69527'
row = conn.execute("SELECT data FROM live_scorecards WHERE match_id = ?", (match_id,)).fetchone()
if row:
    sc = json.loads(row['data'])
    for inn in sc.get('scorecard', []):
        print(f"Innings: {inn.get('inning')}")
        for bw in inn.get('bowlers', []):
             print(f"  {bw['name']} | O: {bw['overs']} | W: {bw['wickets']} | R: {bw['runs']}")
else:
    print("No scorecard found.")
conn.close()
