import duckdb

# Check April 2 match - KKR vs SRH
con = duckdb.connect('ipl.duckdb', read_only=True)

# Check all matches on or near April 2
matches = con.execute("""
SELECT match_id, date, team1, team2, winner 
FROM matches 
WHERE date >= '2026-04-01' AND date <= '2026-04-02'
ORDER BY date
""").fetchall()

print("Matches April 1-2:")
for m in matches:
    print(f"  {m[0]} | {m[1]} | {m[2]} vs {m[3]} | Winner: {m[4]}")

# Check if sm_ matches (Sportmonks ingested)
sm_matches = con.execute("SELECT match_id FROM matches WHERE match_id LIKE 'sm_%' ORDER BY match_id").fetchall()
print(f"\nTotal Sportmonks matches ingested: {len(sm_matches)}")
for m in sm_matches:
    print(f"  {m[0]}")

con.close()
