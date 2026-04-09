import json
import os
import sqlite3
import tempfile
import unittest

from backend import live_db


class TestLiveDbStatusMerging(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.old_path = live_db.LIVE_DB_PATH
        live_db.LIVE_DB_PATH = os.path.join(self.tmpdir.name, "live_scores.db")
        if hasattr(live_db._local, "live_conn") and live_db._local.live_conn is not None:
            live_db._local.live_conn.close()
            live_db._local.live_conn = None
        live_db.init_live_db()

    def tearDown(self):
        if hasattr(live_db._local, "live_conn") and live_db._local.live_conn is not None:
            live_db._local.live_conn.close()
            live_db._local.live_conn = None
        live_db.LIVE_DB_PATH = self.old_path
        self.tmpdir.cleanup()

    def _conn(self):
        conn = sqlite3.connect(live_db.LIVE_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def test_get_all_matches_uses_final_scorecard_state(self):
        conn = self._conn()
        match_data = {
            "id": "69529",
            "teams": ["Kolkata Knight Riders", "Punjab Kings"],
            "status": "Match Interrupted by rain",
            "matchStarted": True,
            "matchEnded": False,
            "score": [{"r": 25, "w": 2, "o": 3.4}],
        }
        scorecard_data = {
            "id": "69529",
            "teams": ["Kolkata Knight Riders", "Punjab Kings"],
            "status": "No result",
            "matchStarted": True,
            "matchEnded": True,
            "score": [{"r": 25, "w": 2, "o": 3.4}],
        }
        conn.execute(
            "INSERT INTO live_matches (match_id, data, is_ipl, match_status, updated_at) VALUES (?, ?, ?, ?, ?)",
            ("69529", json.dumps(match_data), 1, "live", "2026-04-06T17:32:10.176932+00:00"),
        )
        conn.execute(
            "INSERT INTO live_scorecards (match_id, data, updated_at) VALUES (?, ?, ?)",
            ("69529", json.dumps(scorecard_data), "2026-04-06T18:18:44.996982+00:00"),
        )
        conn.commit()
        conn.close()

        row = live_db.get_all_matches()[0]
        self.assertTrue(row["matchEnded"])
        self.assertEqual(row["status"], "No result")

    def test_find_scorecard_for_schedule_fixture_falls_back_to_updated_at_date(self):
        conn = self._conn()
        scorecard_data = {
            "id": "sm_69530",
            "teams": ["Rajasthan Royals", "Mumbai Indians"],
            "status": "completed",
            "matchStarted": True,
            "matchEnded": True,
            "matchWinner": "Rajasthan Royals",
        }
        conn.execute(
            "INSERT INTO live_scorecards (match_id, data, updated_at) VALUES (?, ?, ?)",
            ("sm_69530", json.dumps(scorecard_data), "2026-04-08T06:53:01.618251+00:00"),
        )
        conn.commit()
        conn.close()

        mid, sc = live_db.find_scorecard_for_schedule_fixture(
            "2026-04-07", "Rajasthan Royals", "Mumbai Indians"
        )
        self.assertEqual(mid, "sm_69530")
        self.assertEqual(sc["matchWinner"], "Rajasthan Royals")


if __name__ == "__main__":
    unittest.main()
