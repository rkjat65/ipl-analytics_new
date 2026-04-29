import duckdb
con = duckdb.connect('ipl.duckdb')
res = con.execute("SELECT date, team1, team2 FROM matches WHERE date BETWEEN '2026-04-17' AND '2026-04-27' ORDER BY date DESC").fetchall()
for row in res:
    print(row)
con.close()
