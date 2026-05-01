import duckdb
import os

db_path = "ipl.duckdb"
con = duckdb.connect(db_path, read_only=True)

try:
    print("Testing /api/meta/teams query...")
    res = con.execute("""
        SELECT DISTINCT team FROM (
            SELECT team1 AS team FROM matches
            UNION
            SELECT team2 AS team FROM matches
        ) t
        ORDER BY team
    """).fetchall()
    print(f"Success: {len(res)} teams found.")

    print("\nTesting /api/analytics/man-of-the-match query...")
    # Simplified version of the query in the router
    res = con.execute("""
        WITH motm_roles AS (
            SELECT m.match_id,
                   CASE
                     WHEN EXISTS(SELECT 1 FROM deliveries d WHERE d.match_id = m.match_id AND d.batter = m.player_of_match)
                          AND NOT EXISTS(SELECT 1 FROM deliveries d WHERE d.match_id = m.match_id AND d.bowler = m.player_of_match)
                       THEN 'batsman'
                     WHEN EXISTS(SELECT 1 FROM deliveries d WHERE d.match_id = m.match_id AND d.bowler = m.player_of_match)
                          AND NOT EXISTS(SELECT 1 FROM deliveries d WHERE d.match_id = m.match_id AND d.batter = m.player_of_match)
                       THEN 'bowler'
                     ELSE 'allrounder'
                   END AS motm_role
            FROM matches m
            WHERE m.player_of_match IS NOT NULL AND m.player_of_match != ''
        )
        SELECT m.player_of_match AS player,
               COUNT(*) AS awards
        FROM matches m
        JOIN motm_roles r ON r.match_id = m.match_id
        WHERE m.player_of_match IS NOT NULL AND m.player_of_match != ''
        GROUP BY m.player_of_match
        ORDER BY awards DESC, player
        LIMIT 20
    """).fetchall()
    print(f"Success: {len(res)} MOTM awards found.")

except Exception as e:
    print(f"\nERROR: {e}")
finally:
    con.close()
