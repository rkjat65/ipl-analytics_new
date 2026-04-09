import unittest

from backend.player_resolve import canonical_player_slug, resolve_player_name
from backend.routers.live_analytics import player_form


class TestRinkuResolution(unittest.TestCase):
    def test_rinku_batting_resolves_to_rk_singh(self):
        self.assertEqual(resolve_player_name("Rinku Singh", "bat"), "RK Singh")

    def test_rinku_slug_uses_rk_singh(self):
        self.assertEqual(canonical_player_slug("Rinku Singh"), "RK Singh")

    def test_rinku_player_form_uses_full_career_runs(self):
        payload = player_form(player="Rinku Singh", role="bat", match_id=None)
        self.assertEqual(payload["career_runs"], 1099)
        self.assertEqual(payload["career_matches"], 51)


if __name__ == "__main__":
    unittest.main()
