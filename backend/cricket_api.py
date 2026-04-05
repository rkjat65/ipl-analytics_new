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
    "playerOfMatch": {"name": str, "image": str} | null,
    "scorecard": list,
    "matchStarted": bool, "matchEnded": bool,
  }
"""

from __future__ import annotations

import logging
import os
import re
from abc import ABC, abstractmethod

import httpx

logger = logging.getLogger(__name__)


class RateLimitError(RuntimeError):
    """Sportmonks API rate limit hit — stop retrying immediately."""
    pass

# Sportmonks (and some feeds) occasionally glue a wicket count to a city token,
# e.g. "won by 6Bengaluru wickets" — insert a space before known venue/city tokens.
_STATUS_CITY_GLUE = re.compile(
    r"(\d)(Bengaluru|Bangalore|Hyderabad|Mumbai|Chennai|Kolkata|Jaipur|Lucknow|Ahmedabad|"
    r"Guwahati|Raipur|Delhi|Chandigarh|Dharamshala)\b",
    re.IGNORECASE,
)
# e.g. "won by 6 Bengaluru wickets" → "won by 6 wickets" (city duplicated from team name)
_STATUS_CITY_BEFORE_WICKETS = re.compile(
    r"(\d)\s+(?:Bengaluru|Bangalore|Hyderabad|Mumbai|Chennai|Kolkata|Jaipur|Lucknow|Ahmedabad|"
    r"Guwahati|Raipur|Delhi|Chandigarh|Dharamshala)\s+wickets\b",
    re.IGNORECASE,
)


def sanitize_match_status_text(text: str | None) -> str:
    """Normalize provider result lines for display (fixes digit+city concatenation)."""
    if not text or not isinstance(text, str):
        return (text or "").strip()
    t = _STATUS_CITY_GLUE.sub(r"\1 \2", text).strip()
    t = _STATUS_CITY_BEFORE_WICKETS.sub(r"\1 wickets", t)
    return t


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
                "status": sanitize_match_status_text(m.get("status", "") or ""),
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
        self._last_good_tier: dict[str, int] = {}  # match_id → tier index

    def reset_tier_cache(self, match_id: str) -> None:
        """Reset cached include tier for a match so the next fetch tries the richest tier."""
        self._last_good_tier.pop(match_id, None)
        self._last_good_tier.pop(f"{match_id}:balls", None)

    def is_configured(self) -> bool:
        return bool(self._token)

    async def _call(self, path: str, include: str = "") -> dict:
        params: dict[str, str] = {"api_token": self._token}
        if include:
            params["include"] = include
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{self._BASE}/{path}", params=params)
            if r.status_code in (400, 429):
                try:
                    body = r.json()
                except Exception:
                    body = {}
                msg = ""
                if isinstance(body.get("message"), dict):
                    msg = body["message"].get("message", "")
                elif isinstance(body.get("message"), str):
                    msg = body["message"]
                if "too many" in msg.lower():
                    raise RateLimitError(f"Rate limited by Sportmonks: {msg}")
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
        return self._sportmonks_image_url(obj.get("image_path") or "")

    @staticmethod
    def _sportmonks_image_url(path: str | None) -> str:
        """Turn Sportmonks image_path into a usable URL (often relative to CDN)."""
        p = (path or "").strip()
        if not p:
            return ""
        lower = p.lower()
        if lower.startswith("http://") or lower.startswith("https://"):
            return p
        if p.startswith("//"):
            return f"https:{p}"
        if p.startswith("/"):
            return f"https://cdn.sportmonks.com{p}"
        return f"https://cdn.sportmonks.com/{p.lstrip('/')}"

    def _player_dict_from_embedded_player(self, player: dict | None) -> dict | None:
        if not player or not isinstance(player, dict):
            return None
        name = player.get("fullname") or player.get("lastname") or ""
        if not name:
            return None
        return {
            "name": name,
            "image": self._sportmonks_image_url(player.get("image_path", "")),
        }

    def _extract_player_of_match(self, fixture: dict) -> dict | None:
        raw = fixture.get("manofmatch") or fixture.get("man_of_match") or fixture.get("player_of_match")
        if not raw:
            return None
        if isinstance(raw, dict) and "data" in raw:
            d = raw["data"]
            if isinstance(d, list) and d:
                d = d[0]
            if not isinstance(d, dict):
                return None
            pl = d.get("player")
            if isinstance(pl, dict):
                inner = pl.get("data") if isinstance(pl.get("data"), dict) else pl
                got = self._player_dict_from_embedded_player(inner if isinstance(inner, dict) else None)
                if got:
                    return got
            return self._player_dict_from_embedded_player(d)
        if isinstance(raw, dict):
            return self._player_dict_from_embedded_player(raw)
        return None

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
        local_team = self._team_name(self._extract_team(fixture, "localteam"))
        visitor_team = self._team_name(self._extract_team(fixture, "visitorteam"))

        scores = []
        for run in sorted(runs_list, key=lambda r: r.get("inning", 1)):
            tid = run.get("team_id")
            team_name = local_team if tid == local_id else visitor_team
            inning_num = run.get("inning", 1)
            inning_label = team_name
            if inning_num and inning_num > 1:
                inning_label = f"{team_name} (2nd)"
            scores.append({
                "inning": inning_label,
                "team": team_name,
                "inningNumber": inning_num,
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

    @staticmethod
    def _unwrap_sm(obj):
        if isinstance(obj, dict) and isinstance(obj.get("data"), dict):
            return obj["data"]
        return obj

    def _sm_player_fullname(self, obj) -> str:
        o = self._unwrap_sm(obj)
        if not isinstance(o, dict):
            return ""
        return (o.get("fullname") or o.get("lastname") or "").strip()

    def _batting_dismissal_detail(self, b: dict) -> tuple[str, bool]:
        """Build dismissal text from a Sportmonks batting row; return (text, is_not_out)."""
        is_active = b.get("active", False)
        sc = self._unwrap_sm(b.get("score"))
        kind = (sc.get("name") or "").strip() if isinstance(sc, dict) else ""
        is_out_score = bool(sc.get("out") or sc.get("is_wicket")) if isinstance(sc, dict) else False

        bowler_name = self._sm_player_fullname(b.get("bowler"))
        fielder_name = self._sm_player_fullname(
            b.get("catchstump") or b.get("catch_stump") or b.get("catchstumpplayer")
        )

        has_fow = (b.get("fow_score") or 0) > 0 or (b.get("fow_balls") or 0) > 0
        has_bowler_slot = b.get("bowling_player_id") is not None

        if is_active:
            return "not out", True

        if not kind and not is_out_score and not has_fow and not has_bowler_slot:
            return "not out", True

        kl = kind.lower()
        if "caught" in kl or "catch" in kl:
            if fielder_name and bowler_name:
                text = f"c {fielder_name} b {bowler_name}"
            elif bowler_name:
                text = f"c — b {bowler_name}"
            elif fielder_name:
                text = f"c {fielder_name}"
            else:
                text = kind or "caught"
        elif "lbw" in kl:
            text = f"lbw b {bowler_name}" if bowler_name else (kind or "lbw")
        elif "bowled" in kl:
            text = f"b {bowler_name}" if bowler_name else (kind or "bowled")
        elif "run out" in kl or "runout" in kl.replace(" ", ""):
            text = f"{kind or 'run out'}" + (f" ({fielder_name})" if fielder_name else "")
        elif "stump" in kl:
            if fielder_name and bowler_name:
                text = f"st {fielder_name} b {bowler_name}"
            elif bowler_name:
                text = f"st — b {bowler_name}"
            else:
                text = kind or "stumped"
        elif "hit wicket" in kl:
            text = f"hit wicket b {bowler_name}" if bowler_name else (kind or "hit wicket")
        elif bowler_name:
            text = f"{kind + ' ' if kind else ''}b {bowler_name}".strip()
        elif kind:
            text = kind
        elif has_fow or has_bowler_slot:
            text = "out"
        else:
            return "not out", True

        return text, False

    # ── public API ──

    async def fetch_matches(self) -> list[dict]:
        try:
            data = await self._call(
                "livescores",
                include="runs,localteam,visitorteam,manofmatch",
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (400, 422):
                logger.warning("livescores: manofmatch include rejected, retrying without (%s)", e)
                data = await self._call(
                    "livescores",
                    include="runs,localteam,visitorteam",
                )
            else:
                raise
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

            league_name = ""
            league = m.get("league") or {}
            if isinstance(league, dict):
                league_name = (league.get("data") or league).get("name", "") if isinstance(league.get("data"), dict) else league.get("name", "")

            # isIPL: match by season_id (if SEASON_ID env set) OR by league name fallback
            l_lower = league_name.lower()
            _league_is_ipl = any(x in l_lower for x in ["indian premier league", "ipl", "premier league", "t20 league"])
            is_ipl = _league_is_ipl or (self._season_id > 0 and m.get("season_id") == self._season_id)

            toss_won_id = m.get("toss_won_team_id")
            toss_winner = ""
            if toss_won_id:
                toss_winner = t1 if toss_won_id == m.get("localteam_id") else t2 if toss_won_id == m.get("visitorteam_id") else ""
            toss_choice = m.get("elected") or ""

            winner_id = m.get("winner_team_id")
            match_winner = (
                t1 if winner_id == m.get("localteam_id")
                else t2 if winner_id == m.get("visitorteam_id") else ""
            )
            raw_status = m.get("note") or m.get("status") or ""
            pom = self._extract_player_of_match(m)

            entry = {
                "id": str(m.get("id", "")),
                "name": f"{t1} vs {t2}" if t1 and t2 else m.get("round", ""),
                "status": sanitize_match_status_text(raw_status),
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
            if match_winner:
                entry["matchWinner"] = match_winner
            if pom:
                entry["playerOfMatch"] = pom
            if toss_winner:
                entry["tossWinner"] = toss_winner
                entry["tossChoice"] = toss_choice
            out.append(entry)
        return out

    async def fetch_scorecard(self, match_id: str, *, include_balls: bool = False) -> dict:
        _BALLS_SUFFIX = ",balls.batsman,balls.bowler,balls.score,balls.catchstump"

        include_tiers = [
            # Full nested includes (richest data)
            "localteam,visitorteam,runs,batting.batsman,batting.bowler,batting.score,"
            "batting.catchstump,bowling.bowler,venue,manofmatch,lineup",
            "localteam,visitorteam,runs,batting.batsman,batting.bowler,batting.score,"
            "batting.catchstump,bowling.bowler,venue,manofmatch,lineup",
            "localteam,visitorteam,runs,batting.batsman,batting.bowler,batting.score,bowling.bowler,venue,manofmatch,lineup",
            "localteam,visitorteam,runs,batting.batsman,bowling.bowler,venue,manofmatch,lineup",
            # Without lineup
            "localteam,visitorteam,runs,batting.batsman,batting.bowler,batting.score,"
            "batting.catchstump,bowling.bowler,venue,manofmatch",
            "localteam,visitorteam,runs,batting.batsman,batting.bowler,batting.score,bowling.bowler,venue,manofmatch",
            "localteam,visitorteam,runs,batting.batsman,bowling.bowler,venue,manofmatch",
            # Flat includes (no nesting — API may reject nested during live)
            "localteam,visitorteam,runs,batting,bowling,venue,manofmatch,lineup",
            "localteam,visitorteam,runs,batting,bowling,venue,manofmatch",
            "localteam,visitorteam,runs,batting,bowling,manofmatch",
            # Bare minimum
            "localteam,visitorteam,runs,venue,manofmatch",
            "localteam,visitorteam,runs",
        ]

        # When ball sync is enabled, try with balls first, then fall back to without.
        # The API may reject the combined includes — the tier system handles that.
        if include_balls:
            balls_tiers = [t + _BALLS_SUFFIX for t in include_tiers]
            all_tiers = balls_tiers + include_tiers
        else:
            all_tiers = include_tiers

        # Use separate tier cache keys so balls-mode doesn't pollute scorecard-only
        tier_cache_key = f"{match_id}:balls" if include_balls else match_id
        start_idx = self._last_good_tier.get(tier_cache_key, 0)
        if start_idx >= len(all_tiers):
            start_idx = 0
        ordered_tiers = list(range(start_idx, len(all_tiers))) + list(range(0, start_idx))

        data: dict = {}
        last_err: Exception | None = None
        for tier_idx in ordered_tiers:
            inc = all_tiers[tier_idx]
            try:
                data = await self._call(f"fixtures/{match_id}", include=inc)
                self._last_good_tier[tier_cache_key] = tier_idx
                break
            except RateLimitError:
                logger.warning("fixtures/%s: rate limited — stopping tier attempts", match_id)
                raise
            except httpx.HTTPStatusError as e:
                last_err = e
                if e.response.status_code in (400, 422):
                    logger.warning("fixtures/%s: include tier %d failed, trying next", match_id, tier_idx)
                    continue
                raise
        else:
            if last_err:
                raise last_err
            raise RuntimeError("fetch_scorecard: no include tier succeeded")
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
        lineup = self._build_lineup(m, local, visitor)
        raw_status = m.get("note") or m.get("status") or ""
        pom = self._extract_player_of_match(m)

        out_sc = {
            "id": str(m.get("id", match_id)),
            "name": f"{t1} vs {t2}",
            "status": sanitize_match_status_text(raw_status),
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
        if pom:
            out_sc["playerOfMatch"] = pom
        if lineup:
            out_sc["lineup"] = lineup
        # Attach raw fixture for ball extraction (internal, stripped before serving)
        if include_balls:
            out_sc["_raw_fixture"] = m
        return out_sc

    async def fetch_fixture_raw_for_ingest(self, match_id: str) -> dict:
        """Fetch a fixture with ball-by-ball data for DuckDB / Cricsheet export.

        Returns the inner ``data`` object (fixture dict) including a ``balls`` list.
        Tries progressively smaller include sets if the API rejects nested includes.
        """
        include_tiers = [
            "localteam,visitorteam,venue,runs,season,league,manofmatch,"
            "balls.batsman,balls.bowler,balls.score,balls.catchstump",
            "localteam,visitorteam,venue,runs,season,league,manofmatch,"
            "balls.batsman,balls.bowler,balls.score",
            "localteam,visitorteam,venue,runs,manofmatch,"
            "balls.batsman,balls.bowler,balls.score,balls.catchstump",
            "localteam,visitorteam,venue,runs,manofmatch,"
            "balls.batsman,balls.bowler,balls.score",
            "localteam,visitorteam,runs,manofmatch,"
            "balls.batsman,balls.bowler,balls.score",
        ]
        last_err: Exception | None = None
        for inc in include_tiers:
            try:
                raw = await self._call(f"fixtures/{match_id}", include=inc)
                m = raw.get("data")
                if not isinstance(m, dict):
                    continue
                balls = m.get("balls")
                ball_list: list = []
                if isinstance(balls, list):
                    ball_list = balls
                elif isinstance(balls, dict) and isinstance(balls.get("data"), list):
                    ball_list = balls["data"]
                if ball_list:
                    return m
                last_err = RuntimeError("fixture has no balls (empty or missing)")
            except httpx.HTTPStatusError as e:
                last_err = e
                if e.response.status_code in (400, 422):
                    logger.warning(
                        "fixtures/%s ingest include failed, trying simpler (%s)",
                        match_id,
                        inc[:70],
                    )
                    continue
                raise
        if last_err:
            raise last_err
        raise RuntimeError(f"fetch_fixture_raw_for_ingest: no tier succeeded for {match_id}")

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
        winner_id = m.get("winner_team_id")
        match_winner = (
            t1 if winner_id == m.get("localteam_id")
            else t2 if winner_id == m.get("visitorteam_id") else ""
        )
        raw_status = m.get("note") or m.get("status") or ""

        return {
            "id": str(m.get("id", match_id)),
            "name": f"{t1} vs {t2}",
            "status": sanitize_match_status_text(raw_status),
            "venue": "",
            "teams": [t1, t2],
            "teamInfo": [
                {"name": t1, "img": self._team_img(local)},
                {"name": t2, "img": self._team_img(visitor)},
            ],
            "score": self._build_scores(m),
            "tossWinner": "",
            "tossChoice": "",
            "matchWinner": match_winner,
            "matchStarted": started,
            "matchEnded": ended,
        }

    def _build_lineup(
        self, fixture: dict, local: dict | None, visitor: dict | None,
    ) -> list[dict]:
        """Build a per-team playing XI array from the Sportmonks ``lineup`` include.

        Returns a list of two dicts (one per team), each with ``team``, ``teamImg``,
        and ``players`` — an ordered list of player dicts with name, image, captain,
        and wicketkeeper flags.
        """
        raw = fixture.get("lineup")
        if not raw:
            return []
        lineup_list: list[dict] = []
        if isinstance(raw, dict) and isinstance(raw.get("data"), list):
            lineup_list = raw["data"]
        elif isinstance(raw, list):
            lineup_list = raw
        if not lineup_list:
            return []

        local_id = fixture.get("localteam_id")
        visitor_id = fixture.get("visitorteam_id")
        t1 = self._team_name(local)
        t2 = self._team_name(visitor)

        teams_map: dict[int, dict] = {
            local_id: {"team": t1, "teamImg": self._team_img(local), "players": []},
            visitor_id: {"team": t2, "teamImg": self._team_img(visitor), "players": []},
        }

        for entry in lineup_list:
            if not isinstance(entry, dict):
                continue
            tid = entry.get("team_id")
            if tid not in teams_map:
                continue

            name = (
                entry.get("fullname")
                or entry.get("lastname")
                or entry.get("firstname")
                or ""
            ).strip()
            image = self._sportmonks_image_url(entry.get("image_path") or "")
            captain = bool(entry.get("captain"))
            wicketkeeper = bool(entry.get("wicketkeeper"))

            teams_map[tid]["players"].append({
                "name": name,
                "image": image,
                "captain": captain,
                "wicketkeeper": wicketkeeper,
            })

        result = [v for v in teams_map.values() if v["players"]]
        return result

    def _player_lookup_from_lineup(self, fixture: dict) -> dict[int, dict]:
        """Build player_id → {name, image} lookup from lineup data."""
        lookup: dict[int, dict] = {}
        raw = fixture.get("lineup")
        items: list = []
        if isinstance(raw, dict) and isinstance(raw.get("data"), list):
            items = raw["data"]
        elif isinstance(raw, list):
            items = raw
        for entry in items:
            if not isinstance(entry, dict):
                continue
            pid = entry.get("id")
            if pid is None:
                continue
            name = (
                entry.get("fullname")
                or entry.get("lastname")
                or entry.get("firstname")
                or ""
            ).strip()
            image = self._sportmonks_image_url(entry.get("image_path") or "")
            lookup[pid] = {"name": name, "image": image}
        return lookup

    def _resolve_player(self, nested: dict | None, player_id: int | None, lookup: dict[int, dict]) -> tuple[str, str]:
        """Return (name, image_url) from nested include, lineup lookup, or fallback."""
        if isinstance(nested, dict):
            obj = nested.get("data") if "data" in nested else nested
            if isinstance(obj, dict):
                name = obj.get("fullname") or obj.get("lastname") or ""
                image = self._sportmonks_image_url(obj.get("image_path") or "")
                if name:
                    return name, image
        if player_id and player_id in lookup:
            return lookup[player_id]["name"], lookup[player_id]["image"]
        if player_id:
            return f"Player #{player_id}", ""
        return "", ""

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

        player_lookup = self._player_lookup_from_lineup(fixture)

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
            name, image = self._resolve_player(
                b.get("batsman"), b.get("player_id"), player_lookup,
            )
            is_active = b.get("active", False)
            dismiss_text, is_not_out = self._batting_dismissal_detail(b)
            entry["batsmen"].append({
                "name": name,
                "fullName": name,
                "runs": b.get("score", 0),
                "balls": b.get("ball", 0),
                "fours": b.get("four_x", 0),
                "sixes": b.get("six_x", 0),
                "sr": b.get("rate", 0),
                "dismissal": "not out" if is_not_out else "out",
                "dismissalDetail": dismiss_text,
                "active": is_active,
                "image": image,
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
            bname, bimage = self._resolve_player(
                bw.get("bowler"), bw.get("player_id"), player_lookup,
            )
            entry["bowlers"].append({
                "name": bname,
                "fullName": bname,
                "overs": bw.get("overs", 0),
                "maidens": bw.get("maidens") or bw.get("medians", 0),
                "runs": bw.get("runs", 0),
                "wickets": bw.get("wickets", 0),
                "economy": bw.get("rate", 0),
                "active": bw.get("active", False),
                "image": bimage,
            })

        ordered = sorted(innings_map.values(), key=lambda x: x.get("scoreboard", "S1"))
        return [
            {
                "inning": e["inning"],
                "scoreboard": e.get("scoreboard", "S1"),
                "batsmen": e["batsmen"],
                "bowlers": e["bowlers"],
            }
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
