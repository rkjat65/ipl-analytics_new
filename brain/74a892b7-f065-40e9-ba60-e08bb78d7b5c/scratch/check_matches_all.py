import duckdb
con = duckdb.connect('ipl.duckdb')
res = con.execute("SELECT date, team1, team2 FROM matches WHERE date >= '2026-03-28' ORDER BY date DESC").fetchall()
if not res:
    print("No matches found")
else:
    for row in res:
        print(row)
con.close()
