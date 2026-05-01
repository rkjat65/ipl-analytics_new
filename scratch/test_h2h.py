import sys
import os
from pathlib import Path

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import query, team_variants, normalize_team

def test_compare():
    team1 = "Mumbai Indians"
    team2 = "Chennai Super Kings"
    
    print(f"Testing compare between {team1} and {team2}")
    
    v1 = team_variants(team1)
    v2 = team_variants(team2)
    print(f"Variants 1: {v1}")
    print(f"Variants 2: {v2}")
    
    ph1 = ", ".join(["?"] * len(v1))
    ph2 = ", ".join(["?"] * len(v2))
    
    h2h_where = f"(team1 IN ({ph1}) AND team2 IN ({ph2})) OR (team1 IN ({ph2}) AND team2 IN ({ph1}))"
    h2h_params = v1 + v2 + v2 + v1
    
    print("Running H2H record query...")
    # This is a part of compare_teams
    h2h = query(f"""
        SELECT
            COUNT(*) AS played,
            SUM(CASE WHEN winner IN ({ph1}) THEN 1 ELSE 0 END) AS team1_wins,
            SUM(CASE WHEN winner IN ({ph2}) THEN 1 ELSE 0 END) AS team2_wins
        FROM matches
        WHERE {h2h_where}
    """, h2h_params + v1 + v2)
    print(f"Result: {h2h}")

if __name__ == "__main__":
    test_compare()
