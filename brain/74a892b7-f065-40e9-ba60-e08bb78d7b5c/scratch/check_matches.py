import duckdb
con = duckdb.connect('ipl.duckdb')
res = con.execute("SELECT date, team1, team2 FROM matches WHERE date IN ('2026-04-26', '2026-04-27')").fetchall()
if not res:
    print("No matches found for 2026-04-26 and 2026-04-27")
else:
    for row in res:
        print(row)
con.close()
