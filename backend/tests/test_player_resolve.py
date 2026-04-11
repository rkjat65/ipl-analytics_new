import unittest

from backend.database import query
from backend.player_resolve import canonical_player_slug, resolve_player_name
from backend.routers.live_analytics import player_form


class TestRinkuResolution(unittest.TestCase):
    def test_rinku_batting_resolves_to_rk_singh(self):
        self.assertEqual(resolve_player_name("Rinku Singh", "bat"), "RK Singh")

    def test_rinku_slug_uses_rk_singh(self):
        self.assertEqual(canonical_player_slug("Rinku Singh"), "RK Singh")

    def test_rinku_player_form_matches_duckdb_totals(self):
        payload = player_form(player="Rinku Singh", role="bat", match_id=None)
        totals = query(
            """
            SELECT COUNT(DISTINCT match_id) AS matches,
                   COALESCE(SUM(runs_batter), 0) AS runs
            FROM deliveries
            WHERE batter = ? AND is_super_over = false
            """,
            ["RK Singh"],
        )[0]
        self.assertEqual(payload["career_runs"], totals["runs"])
        self.assertEqual(payload["career_matches"], totals["matches"])
        self.assertGreater(payload["career_runs"], 1000)

    def test_rajat_batting_resolves_to_rm_patidar(self):
        self.assertEqual(resolve_player_name("Rajat Patidar", "bat"), "RM Patidar")

    def test_rajat_slug_uses_rm_patidar(self):
        self.assertEqual(canonical_player_slug("Rajat Patidar"), "RM Patidar")


if __name__ == "__main__":
    unittest.main()
