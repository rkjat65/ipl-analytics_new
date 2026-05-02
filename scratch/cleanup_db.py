import duckdb
import os

DB_PATH = "ipl.duckdb"

def cleanup():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    con = duckdb.connect(DB_PATH)
    
    print("Checking for duplicates in deliveries...")
    dup_count = con.execute("""
        SELECT COUNT(*) - COUNT(DISTINCT (match_id, innings_number, over_number, ball_number, batter, bowler, runs_total, is_wicket)) 
        FROM deliveries
    """).fetchone()[0]
    
    if dup_count > 0:
        print(f"Found approximately {dup_count} duplicates. Cleaning up...")
        
        # Create a temp table with distinct rows
        con.execute("""
            CREATE TABLE deliveries_new AS 
            SELECT * FROM (
                SELECT *, 
                       ROW_NUMBER() OVER (PARTITION BY match_id, innings_number, over_number, ball_number, batter, bowler, runs_total, is_wicket ORDER BY delivery_id) as rn
                FROM deliveries
            ) WHERE rn = 1
        """)
        
        # Drop old, rename new
        con.execute("DROP TABLE deliveries")
        con.execute("ALTER TABLE deliveries_new DROP rn")
        con.execute("ALTER TABLE deliveries_new RENAME TO deliveries")
        
        print("Cleanup complete.")
    else:
        print("No duplicates found.")
        
    con.close()

if __name__ == "__main__":
    cleanup()
