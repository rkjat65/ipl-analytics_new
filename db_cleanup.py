import sqlite3, os, json
db_path = r'c:\IPL\ipl-analytics_new\backend\data\live_scores.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

print("=== DATABASE CLEANUP ===")

# 1. Deduplicate balls based on content (Match, Scoreboard, Decimal, Total Runs, Wicket status)
# We keep the one with the lowest ID
print("Deduplicating live_balls by content...")
conn.execute("""
    DELETE FROM live_balls
    WHERE ball_id NOT IN (
        SELECT MIN(ball_id)
        FROM live_balls
        GROUP BY match_id, scoreboard, ball_decimal, runs_total, extra_type, is_wicket
    )
""")
print(f"Removed {conn.total_changes} duplicate balls.")

# 2. Reset ball sync state for the current match 69527 to force a full re-ingestion
match_id = '69527'
print(f"Resetting sync state for {match_id}...")
conn.execute("DELETE FROM ball_sync_state WHERE match_id = ?", (match_id,))
conn.execute("UPDATE live_matches SET is_ipl = 1, is_tracked = 1 WHERE match_id = ?", (match_id,))

# 3. Reclear any scorecard cache just in case
conn.execute("DELETE FROM live_scorecards WHERE match_id = ?", (match_id,))

conn.commit()
print("Commit successful.")
conn.close()
