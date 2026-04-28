import duckdb
con = duckdb.connect('ipl.duckdb')
res = con.execute("""
    SELECT match_id, team1, team2, count(*) 
    FROM matches 
    JOIN deliveries USING (match_id) 
    WHERE date IN ('2026-04-26', '2026-04-27') 
    GROUP BY match_id, team1, team2
""").fetchall()
for row in res:
    print(row)
con.close()
