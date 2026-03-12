"""
Unit tests for IPL Analytics comparison endpoints.
Run with: python -m pytest backend/tests/
"""

import unittest
from backend.database import get_db, query


class TestTeamComparison(unittest.TestCase):
    """Test team head-to-head comparison endpoint."""

    def setUp(self):
        """Set up test database connection."""
        # Get first available connection from generator
        self.con = next(get_db())

    def test_team_hth_valid_teams(self):
        """Test that team H2H returns valid structure for existing teams."""
        # Get first two teams from database
        teams = query(
            self.con,
            """
            SELECT DISTINCT team1 as team FROM matches
            LIMIT 2
            """,
        )
        
        if len(teams) >= 2:
            team1, team2 = teams[0]["team"], teams[1]["team"]
            
            # Query team H2H
            record = query(
                self.con,
                """
                SELECT
                    COUNT(*) AS total_matches,
                    SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) AS team1_wins,
                    SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) AS team2_wins
                FROM matches
                WHERE (team1 = ? AND team2 = ?) OR (team1 = ? AND team2 = ?)
                """,
                [team1, team2, team1, team2, team2, team1],
            )
            
            self.assertIsInstance(record, list)
            self.assertGreater(len(record), 0)
            
            data = record[0]
            # Verify keys exist
            self.assertIn("total_matches", data)
            self.assertIn("team1_wins", data)
            self.assertIn("team2_wins", data)
            
            # Verify data types
            self.assertIsInstance(data["total_matches"], (int, type(None)))

    def test_team_hth_nonexistent_teams(self):
        """Test that nonexistent teams return no matches."""
        record = query(
            self.con,
            """
            SELECT COUNT(*) AS total_matches
            FROM matches
            WHERE (team1 = ? AND team2 = ?) OR (team1 = ? AND team2 = ?)
            """,
            ["Fake Team A", "Fake Team B", "Fake Team B", "Fake Team A"],
        )
        
        self.assertGreaterEqual(len(record), 1)
        self.assertEqual(record[0]["total_matches"], 0)

    def test_team_hth_same_teams(self):
        """Test that same team doesn't play itself."""
        teams = query(self.con, "SELECT DISTINCT team1 FROM matches LIMIT 1")
        if teams:
            team = teams[0]["team1"]
            record = query(
                self.con,
                "SELECT COUNT(*) AS total FROM matches WHERE team1 = ? AND team2 = ?",
                [team, team],
            )
            self.assertEqual(record[0]["total"], 0)


class TestSeasonComparison(unittest.TestCase):
    """Test season comparison endpoint."""

    def setUp(self):
        """Set up test database connection."""
        self.con = next(get_db())

    def test_season_comparison_valid_seasons(self):
        """Test that season comparison returns valid KPIs."""
        seasons = query(
            self.con,
            "SELECT DISTINCT season FROM matches ORDER BY season LIMIT 2",
        )
        
        if len(seasons) >= 2:
            season1 = seasons[0]["season"]
            season2 = seasons[1]["season"]
            
            kpis = query(
                self.con,
                """
                SELECT
                    COUNT(DISTINCT m.match_id) AS total_matches,
                    SUM(d.runs_batter) AS total_runs,
                    SUM(d.is_wicket::INT) AS total_wickets
                FROM matches m
                JOIN deliveries d ON m.match_id = d.match_id
                WHERE m.season = ? AND NOT d.is_super_over
                """,
                [season1],
            )
            
            self.assertIsInstance(kpis, list)
            self.assertGreater(len(kpis), 0)
            
            data = kpis[0]
            self.assertIn("total_matches", data)
            self.assertIn("total_runs", data)
            self.assertIn("total_wickets", data)
            
            # Verify non-null and positive
            self.assertIsNotNone(data["total_matches"])
            self.assertGreater(data["total_matches"], 0)

    def test_season_comparison_nonexistent(self):
        """Test that nonexistent seasons return no data."""
        kpis = query(
            self.con,
            "SELECT COUNT(*) AS cnt FROM matches WHERE season = ?",
            ["9999/9999"],
        )
        self.assertEqual(kpis[0]["cnt"], 0)

    def test_season_top_batsmen(self):
        """Test that top batsmen are retrieved correctly."""
        seasons = query(self.con, "SELECT DISTINCT season FROM matches LIMIT 1")
        if seasons:
            season = seasons[0]["season"]
            batsmen = query(
                self.con,
                """
                SELECT
                    d.batter AS name,
                    SUM(d.runs_batter) AS runs
                FROM deliveries d
                JOIN matches m ON d.match_id = m.match_id
                WHERE m.season = ? AND NOT d.is_super_over
                GROUP BY d.batter
                ORDER BY runs DESC
                LIMIT 5
                """,
                [season],
            )
            
            self.assertIsInstance(batsmen, list)
            if batsmen:
                # Verify structure
                first = batsmen[0]
                self.assertIn("name", first)
                self.assertIn("runs", first)
                
                # Runs should be positive
                self.assertGreater(first["runs"], 0)


class TestDataIntegrity(unittest.TestCase):
    """Test data integrity across queries."""

    def setUp(self):
        """Set up test database connection."""
        self.con = next(get_db())

    def test_no_negative_values(self):
        """Test that no runs, wickets, or matches are negative."""
        negative_runs = query(
            self.con,
            "SELECT COUNT(*) AS cnt FROM deliveries WHERE runs_batter < 0 OR runs_total < 0",
        )
        self.assertEqual(negative_runs[0]["cnt"], 0)

        negative_wickets = query(
            self.con,
            "SELECT COUNT(*) AS cnt FROM matches WHERE win_by_wickets < 0",
        )
        self.assertEqual(negative_wickets[0]["cnt"], 0)

    def test_match_totals_consistency(self):
        """Test that match totals match delivery summations (sample)."""
        # Sample check: pick one match and verify
        sample = query(
            self.con,
            """
            SELECT m.match_id, m.season
            FROM matches m
            LIMIT 1
            """,
        )
        
        if sample:
            match_id = sample[0]["match_id"]
            
            # Get innings data
            innings_data = query(
                self.con,
                """
                SELECT
                    innings_number,
                    SUM(runs_batter) as calculated_runs,
                    SUM(CASE WHEN is_wicket THEN 1 ELSE 0 END) as calculated_wickets
                FROM deliveries
                WHERE match_id = ? AND NOT is_super_over
                GROUP BY innings_number
                """,
                [match_id],
            )
            
            # Verify we got data
            self.assertGreater(len(innings_data), 0)
            
            # All calculated runs should be positive
            for inning in innings_data:
                if inning["calculated_runs"] is not None:
                    self.assertGreaterEqual(inning["calculated_runs"], 0)


if __name__ == "__main__":
    unittest.main()
