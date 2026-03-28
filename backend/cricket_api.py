"""Abstracted cricket data API client — swap providers without touching the rest of the code.

Supported providers (set CRICKET_API_PROVIDER in .env):
  "cricapi"      → CricAPI  (api.cricapi.com)     — needs CRICAPI_KEY
  "cricketdata"  → CricketData (api.cricapi.com)   — needs CRICKETDATA_API_KEY
  "sportmonks"   → Sportmonks (cricket.sportmonks.com) — needs SPORTMONKS_API_TOKEN

To add a completely different provider:
  1. Subclass CricketAPIProvider
  2. Implement the three abstract methods returning the canonical shapes below
  3. Register it in _PROVIDERS
  4. Set CRICKET_API_PROVIDER=<your_name> in .env

Canonical match shape (returned by fetch_matches):
  {
    "id": str, "name": str, "status": str, "dateTimeGMT": str,
    "matchType": str, "series": str,
    "teams": [str, str],
    "teamInfo": [{"name": str, "img": str}, ...],
    "score": [{"inning": str, "score": str}, ...],
    "matchStarted": bool, "matchEnded": bool, "isIPL": bool,
  }

Canonical scorecard shape (returned by fetch_scorecard):
  {
    "id": str, "name": str, "status": str, "venue": str,
    "date": str, "dateTimeGMT": str,
    "teams": list, "teamInfo": list, "score": list,
    "tossWinner": str, "tossChoice": str, "matchWinner": str,
    "scorecard": list,
    "matchStarted": bool, "matchEnded": bool,
  }
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod

import httpx

logger = logging.getLogger(__name__)


# ─── Abstract base ──────────────────────────────────────────────────


class CricketAPIProvider(ABC):
    """Base class every cricket-data provider must implement."""

    @abstractmethod
    async def fetch_matches(self) -> list[dict]:
        """Return a list of current / recent / upcoming matches (normalised)."""

    @abstractmethod
    async def fetch_scorecard(self, match_id: str) -> dict:
        """Return a full scorecard for *match_id* (normalised)."""

    @abstractmethod
    async def fetch_match_info(self, match_id: str) -> dict:
        """Return lightweight match info for *match_id* (normalised)."""

    @abstractmethod
    def is_configured(self) -> bool:
        """True when the required API key / credentials are present."""


# ─── CricAPI / CricketData provider ─────────────────────────────────


class CricAPIProvider(CricketAPIProvider):
    """Works for both cricapi.com free-tier and cricketdata.org paid plans."""

    def __init__(self, api_key: str, base_url: str | None = None):
        self._key = api_key
        self._base = (base_url or "https://api.cricapi.com/v1").rstrip("/")

    def is_configured(self) -> bool:
        return bool(self._key)

    async def _call(self, endpoint: str, params: dict | None = None) -> dict:
        p = {"apikey": self._key}
        if params:
            p.update(params)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{self._base}/{endpoint}", params=p)
            r.raise_for_status()
            data = r.json()
            if data.get("status") != "success":
                raise RuntimeError(data.get("reason", "CricAPI request failed"))
            return data

    @staticmethod
    def _match_state(ms: str) -> tuple[bool, bool]:
        ms = (ms or "").lower()
        if ms == "result":
            return True, True
        if ms == "live":
            return True, False
        return False, False

    async def fetch_matches(self) -> list[dict]:
        data = await self._call("cricScore")
        out: list[dict] = []
        for m in data.get("data", []):
            series = (m.get("series", "") or "").lower()
            t1, t2 = m.get("t1", ""), m.get("t2", "")
            is_ipl = "ipl" in series or "indian premier league" in series
            started, ended = self._match_state(m.get("ms", ""))
            score: list[dict] = []
            if m.get("t1s"):
                score.append({"inning": t1, "score": m["t1s"]})
            if m.get("t2s"):
                score.append({"inning": t2, "score": m["t2s"]})
            out.append({
                "id": m.get("id", ""),
                "name": f"{t1} vs {t2}",
                "status": m.get("status", ""),
                "dateTimeGMT": m.get("dateTimeGMT", ""),
                "matchType": m.get("matchType", ""),
                "series": m.get("series", ""),
                "teams": [t1, t2],
                "teamInfo": [
                    {"name": t1, "img": m.get("t1img", "")},
                    {"name": t2, "img": m.get("t2img", "")},
                ],
                "score": score,
                "matchStarted": started,
                "matchEnded": ended,
                "isIPL": is_ipl,
            })
        return out

    async def fetch_scorecard(self, match_id: str) -> dict:
        data = await self._call("match_scorecard", {"id": match_id})
        md = data.get("data", {})
        return {
            "id": md.get("id", match_id),
            "name": md.get("name", ""),
            "status": md.get("status", ""),
            "venue": md.get("venue", ""),
            "date": md.get("date", ""),
            "dateTimeGMT": md.get("dateTimeGMT", ""),
            "teams": md.get("teams", []),
            "teamInfo": md.get("teamInfo", []),
            "score": md.get("score", []),
            "tossWinner": md.get("tossWinner", ""),
            "tossChoice": md.get("tossChoice", ""),
            "matchWinner": md.get("matchWinner", ""),
            "scorecard": md.get("scorecard", []),
            "matchStarted": md.get("matchStarted", False),
            "matchEnded": md.get("matchEnded", False),
        }

    async def fetch_match_info(self, match_id: str) -> dict:
        data = await self._call("match_info", {"id": match_id})
        md = data.get("data", {})
        return {
            "id": md.get("id", match_id),
            "name": md.get("name", ""),
            "status": md.get("status", ""),
            "venue": md.get("venue", ""),
            "teams": md.get("teams", []),
            "teamInfo": md.get("teamInfo", []),
            "score": md.get("score", []),
            "tossWinner": md.get("tossWinner", ""),
            "tossChoice": md.get("tossChoice", ""),
            "matchWinner": md.get("matchWinner", ""),
            "matchStarted": md.get("matchStarted", False),
            "matchEnded": md.get("matchEnded", False),
        }


# ─── Sportmonks provider ─────────────────────────────────────────────


class SportmonksProvider(CricketAPIProvider):
    """Sportmonks Cricket API v2.0 (cricket.sportmonks.com)."""

    _BASE = "https://cricket.sportmonks.com/api/v2.0"

    def __init__(self, api_token: str):
        self._token = api_token
        self._season_id = int(os.getenv("SEASON_ID", "0") or "0")

    def is_configured(self) -> bool:
        return bool(self._token)

    async def _call(self, path: str, include: str = "") -> dict:
        params: dict[str, str] = {"api_token": self._token}
        if include:
            params["include"] = include
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{self._BASE}/{path}", params=params)
            r.raise_for_status()
            return r.json()

    # ── helpers ──

    def _team_name(self, obj: dict | None) -> str:
        if not obj:
            return ""
        return obj.get("name") or obj.get("code") or ""

    def _team_img(self, obj: dict | None) -> str:
        if not obj:
            return ""
        return obj.get("image_path") or ""

    def _match_state(self, fixture: dict) -> tuple[bool, bool]:
        """Derive (matchStarted, matchEnded) from Sportmonks status fields."""
        status = (fixture.get("status") or "").lower()
        live = fixture.get("live", False)

        finished_statuses = {"finished", "aban.", "abandoned", "cancelled", "no result"}
        in_progress = {
            "1st innings", "2nd innings", "innings break",
            "stumps", "lunch", "tea", "dinner", "drinks",
            "toss", "delayed", "rain delay", "super over",
        }

        if status in finished_statuses:
            return True, True
        if live or status in in_progress:
            return True, False
        return False, False

    def _build_scores(self, fixture: dict) -> list[dict]:
        """Build canonical score entries from the Sportmonks runs include."""
        runs_data = fixture.get("runs", {})
        if isinstance(runs_data, dict):
            runs_list = runs_data.get("data", [])
        elif isinstance(runs_data, list):
            runs_list = runs_data
        else:
            return []

        local_id = fixture.get("localteam_id")
        visitor_id = fixture.get("visitorteam_id")
        local_team = self._team_name(
            (fixture.get("localteam") or {}).get("data")
            if isinstance(fixture.get("localteam"), dict)
            else fixture.get("localteam")
        )
        visitor_team = self._team_name(
            (fixture.get("visitorteam") or {}).get("data")
            if isinstance(fixture.get("visitorteam"), dict)
            else fixture.get("visitorteam")
        )

        scores = []
        for run in runs_list:
            tid = run.get("team_id")
            inning_label = local_team if tid == local_id else visitor_team
            inning_num = run.get("inning", 1)
            if inning_num and inning_num > 1:
                inning_label = f"{inning_label} (2nd)"
            scores.append({
                "inning": inning_label,
                "r": run.get("score", 0),
                "w": run.get("wickets", 0),
                "o": run.get("overs", 0),
                "score": f"{run.get('score', 0)}/{run.get('wickets', 0)} ({run.get('overs', 0)})",
            })
        return scores

    def _extract_team(self, fixture: dict, key: str) -> dict | None:
        """Extract team object from a Sportmonks nested include."""
        raw = fixture.get(key)
        if not raw:
            return None
        if isinstance(raw, dict) and "data" in raw:
            return raw["data"]
        return raw

    # ── public API ──

    async def fetch_matches(self) -> list[dict]:
        data = await self._call("livescores", include="runs,localteam,visitorteam")
        items = data.get("data", [])
        if not isinstance(items, list):
            items = []

        out: list[dict] = []
        for m in items:
            local = self._extract_team(m, "localteam")
            visitor = self._extract_team(m, "visitorteam")
            t1 = self._team_name(local)
            t2 = self._team_name(visitor)
            started, ended = self._match_state(m)
            is_ipl = self._season_id > 0 and m.get("season_id") == self._season_id

            league_name = ""
            league = m.get("league") or {}
            if isinstance(league, dict):
                league_name = (league.get("data") or league).get("name", "") if isinstance(league.get("data"), dict) else league.get("name", "")

            toss_won_id = m.get("toss_won_team_id")
            toss_winner = ""
            if toss_won_id:
                toss_winner = t1 if toss_won_id == m.get("localteam_id") else t2 if toss_won_id == m.get("visitorteam_id") else ""
            toss_choice = m.get("elected") or ""

            entry = {
                "id": str(m.get("id", "")),
                "name": f"{t1} vs {t2}" if t1 and t2 else m.get("round", ""),
                "status": m.get("note") or m.get("status") or "",
                "dateTimeGMT": m.get("starting_at") or "",
                "matchType": m.get("type") or "",
                "series": league_name or ("IPL 2026" if is_ipl else ""),
                "teams": [t1, t2],
                "teamInfo": [
                    {"name": t1, "img": self._team_img(local)},
                    {"name": t2, "img": self._team_img(visitor)},
                ],
                "score": self._build_scores(m),
                "matchStarted": started,
                "matchEnded": ended,
                "isIPL": is_ipl,
            }
            if toss_winner:
                entry["tossWinner"] = toss_winner
                entry["tossChoice"] = toss_choice
            out.append(entry)
        return out

    async def fetch_scorecard(self, match_id: str) -> dict:
        data = await self._call(
            f"fixtures/{match_id}",
            include="localteam,visitorteam,runs,batting,bowling,venue,toss",
        )
        m = data.get("data", {})
        local = self._extract_team(m, "localteam")
        visitor = self._extract_team(m, "visitorteam")
        t1 = self._team_name(local)
        t2 = self._team_name(visitor)
        started, ended = self._match_state(m)

        venue_raw = m.get("venue") or {}
        venue_obj = venue_raw.get("data") if isinstance(venue_raw, dict) and "data" in venue_raw else venue_raw
        venue_name = (venue_obj or {}).get("name", "") if isinstance(venue_obj, dict) else ""

        toss_raw = m.get("toss") or {}
        toss_obj = toss_raw.get("data") if isinstance(toss_raw, dict) and "data" in toss_raw else toss_raw
        toss_won_id = (
            ((toss_obj or {}).get("winner_team_id") if isinstance(toss_obj, dict) else None)
            or m.get("toss_won_team_id")
        )
        toss_winner = t1 if toss_won_id == m.get("localteam_id") else t2 if toss_won_id == m.get("visitorteam_id") else ""
        toss_choice = ""
        if isinstance(toss_obj, dict):
            toss_choice = toss_obj.get("elected") or ""
        if not toss_choice:
            toss_choice = m.get("elected") or ""

        winner_id = m.get("winner_team_id")
        match_winner = t1 if winner_id == m.get("localteam_id") else t2 if winner_id == m.get("visitorteam_id") else ""

        scorecard = self._build_scorecard_array(m, local, visitor)

        return {
            "id": str(m.get("id", match_id)),
            "name": f"{t1} vs {t2}",
            "status": m.get("note") or m.get("status") or "",
            "venue": venue_name,
            "date": (m.get("starting_at") or "")[:10],
            "dateTimeGMT": m.get("starting_at") or "",
            "teams": [t1, t2],
            "teamInfo": [
                {"name": t1, "img": self._team_img(local)},
                {"name": t2, "img": self._team_img(visitor)},
            ],
            "score": self._build_scores(m),
            "tossWinner": toss_winner,
            "tossChoice": toss_choice,
            "matchWinner": match_winner,
            "scorecard": scorecard,
            "matchStarted": started,
            "matchEnded": ended,
        }

    async def fetch_match_info(self, match_id: str) -> dict:
        data = await self._call(
            f"fixtures/{match_id}",
            include="localteam,visitorteam,runs",
        )
        m = data.get("data", {})
        local = self._extract_team(m, "localteam")
        visitor = self._extract_team(m, "visitorteam")
        t1 = self._team_name(local)
        t2 = self._team_name(visitor)
        started, ended = self._match_state(m)

        return {
            "id": str(m.get("id", match_id)),
            "name": f"{t1} vs {t2}",
            "status": m.get("note") or m.get("status") or "",
            "venue": "",
            "teams": [t1, t2],
            "teamInfo": [
                {"name": t1, "img": self._team_img(local)},
                {"name": t2, "img": self._team_img(visitor)},
            ],
            "score": self._build_scores(m),
            "tossWinner": "",
            "tossChoice": "",
            "matchWinner": "",
            "matchStarted": started,
            "matchEnded": ended,
        }

    def _build_scorecard_array(self, fixture: dict, local: dict | None, visitor: dict | None) -> list[dict]:
        """Build a scorecard array from Sportmonks batting/bowling includes."""
        batting_raw = fixture.get("batting") or {}
        batting_list = batting_raw.get("data", []) if isinstance(batting_raw, dict) else batting_raw if isinstance(batting_raw, list) else []

        bowling_raw = fixture.get("bowling") or {}
        bowling_list = bowling_raw.get("data", []) if isinstance(bowling_raw, dict) else bowling_raw if isinstance(bowling_raw, list) else []

        local_id = fixture.get("localteam_id")
        visitor_id = fixture.get("visitorteam_id")
        t1 = self._team_name(local)
        t2 = self._team_name(visitor)

        innings_map: dict[str, dict] = {}
        for b in batting_list:
            tid = b.get("team_id")
            sb = b.get("scoreboard", "S1")
            team_label = t1 if tid == local_id else t2
            key = f"{team_label}_{sb}"
            entry = innings_map.setdefault(key, {
                "inning": team_label,
                "scoreboard": sb,
                "batsmen": [],
                "bowlers": [],
            })
            player = b.get("player") or {}
            if isinstance(player, dict) and "data" in player:
                player = player["data"]
            entry["batsmen"].append({
                "name": b.get("player_name") or (player.get("fullname") if isinstance(player, dict) else ""),
                "runs": b.get("score", 0),
                "balls": b.get("ball", 0),
                "fours": b.get("four_x", 0),
                "sixes": b.get("six_x", 0),
                "sr": b.get("rate", 0),
                "dismissal": b.get("catch_stump_player_id") and "out" or (
                    "not out" if not b.get("out") else "out"
                ),
            })

        for bw in bowling_list:
            tid = bw.get("team_id")
            sb = bw.get("scoreboard", "S1")
            bowling_team = t1 if tid == local_id else t2
            batting_team = t2 if tid == local_id else t1
            key = f"{batting_team}_{sb}"
            entry = innings_map.setdefault(key, {
                "inning": batting_team,
                "scoreboard": sb,
                "batsmen": [],
                "bowlers": [],
            })
            player = bw.get("player") or {}
            if isinstance(player, dict) and "data" in player:
                player = player["data"]
            entry["bowlers"].append({
                "name": bw.get("player_name") or (player.get("fullname") if isinstance(player, dict) else ""),
                "overs": bw.get("overs", 0),
                "maidens": bw.get("medians", 0),
                "runs": bw.get("runs", 0),
                "wickets": bw.get("wickets", 0),
                "economy": bw.get("rate", 0),
            })

        ordered = sorted(innings_map.values(), key=lambda x: x.get("scoreboard", "S1"))
        return [
            {"inning": e["inning"], "batsmen": e["batsmen"], "bowlers": e["bowlers"]}
            for e in ordered
        ]


# ─── Provider registry / factory ────────────────────────────────────

_PROVIDERS: dict[str, type] = {
    "cricapi": CricAPIProvider,
    "cricketdata": CricAPIProvider,
    "sportmonks": SportmonksProvider,
}

_instance: CricketAPIProvider | None = None


def get_cricket_api() -> CricketAPIProvider:
    """Return the singleton cricket API provider."""
    global _instance
    if _instance is not None:
        return _instance

    name = os.getenv("CRICKET_API_PROVIDER", "cricapi").lower()

    if name == "sportmonks":
        token = os.getenv("SPORTMONKS_API_TOKEN", "")
        _instance = SportmonksProvider(api_token=token)
    elif name == "cricketdata":
        key = os.getenv("CRICKETDATA_API_KEY", "")
        _instance = CricAPIProvider(api_key=key, base_url=os.getenv("CRICKET_API_BASE_URL"))
    else:
        key = os.getenv("CRICAPI_KEY", "")
        _instance = CricAPIProvider(api_key=key, base_url=os.getenv("CRICKET_API_BASE_URL"))

    logger.info(
        "Cricket API provider: %s (configured=%s)", name, _instance.is_configured()
    )
    return _instance
