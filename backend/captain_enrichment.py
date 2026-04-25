"""Link DuckDB IPL matches to Sportmonks fixtures and cache playing-XI captains in SQLite.

Cricsheet / DuckDB rows do not store captains. Sportmonks lineups do. This module
fetches fixtures for a Sportmonks *season_id* (not the same as calendar season),
matches each fixture to a DuckDB row by franchise pair + date, and writes into
``duckdb_match_captains`` in ``live_scores.db``.

Find your IPL ``season_id`` in the Sportmonks dashboard (seasons for the IPL league),
then call the admin endpoint or ``enrich_duckdb_season_from_sportmonks`` from a script.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from .cricket_api import SportmonksProvider, get_cricket_api
from .database import normalize_team, query
from .live_db import get_duckdb_match_captains_for_season, upsert_duckdb_match_captains

log = logging.getLogger(__name__)


def _date_candidates_from_starting_at(starting_at: str | None) -> set[str]:
    """Possible calendar dates for a fixture (UTC date, IST date, ±1 day slack)."""
    if not starting_at or len(starting_at) < 10:
        return set()
    try:
        utc = datetime.fromisoformat(starting_at.replace("Z", "+00:00"))
    except ValueError:
        return {starting_at[:10]}
    utc_d = utc.astimezone(timezone.utc).date().isoformat()
    ist_d = (utc + timedelta(hours=5, minutes=30)).date().isoformat()
    out = {utc_d, ist_d}
    for dstr in (utc_d, ist_d):
        try:
            b = datetime.strptime(dstr, "%Y-%m-%d").date()
            out.add((b - timedelta(days=1)).isoformat())
            out.add((b + timedelta(days=1)).isoformat())
        except ValueError:
            pass
    return out


def _duckdb_match_index_for_season(duckdb_season: str) -> dict[tuple[frozenset[str], str], list[str]]:
    """(frozenset(team1, team2), yyyy-mm-dd) -> match_ids (Cricsheet ids)."""
    rows = query(
        """
        SELECT match_id, CAST(date AS VARCHAR) AS d, team1, team2
        FROM matches
        WHERE CAST(season AS VARCHAR) = ?
        ORDER BY date, match_id
        """,
        [str(duckdb_season)],
    )
    out: dict[tuple[frozenset[str], str], list[str]] = {}
    for r in rows:
        d = (r.get("d") or "")[:10]
        t1 = normalize_team(r.get("team1") or "")
        t2 = normalize_team(r.get("team2") or "")
        if not d or not t1 or not t2:
            continue
        key = (frozenset({t1, t2}), d)
        out.setdefault(key, []).append(str(r["match_id"]))
    return out


def _captains_from_fixture(api: SportmonksProvider, m: dict) -> dict[str, str]:
    """Canonical franchise -> captain display name from Sportmonks lineup."""
    local = api._extract_team(m, "localteam")
    visitor = api._extract_team(m, "visitorteam")
    lineup = api._build_lineup(m, local, visitor)
    caps: dict[str, str] = {}
    for block in lineup:
        if not isinstance(block, dict):
            continue
        team = normalize_team((block.get("team") or "").strip())
        if not team:
            continue
        for p in block.get("players") or []:
            if not isinstance(p, dict) or not p.get("captain"):
                continue
            name = (p.get("name") or "").strip()
            if name:
                caps[team] = name
                break
    return caps


def _fixture_franchises(api: SportmonksProvider, m: dict) -> tuple[str, str]:
    local = api._extract_team(m, "localteam")
    visitor = api._extract_team(m, "visitorteam")
    return normalize_team(api._team_name(local)), normalize_team(api._team_name(visitor))


async def enrich_duckdb_season_from_sportmonks(
    duckdb_season: str,
    sportmonks_season_id: int,
    *,
    dry_run: bool = False,
    max_pages: int | None = 80,
) -> dict:
    """Pull all fixture pages for ``sportmonks_season_id`` and upsert captains for ``duckdb_season``.

    ``max_pages`` caps API usage (each page is one request). Set ``None`` for no cap.
    """
    api = get_cricket_api()
    if not isinstance(api, SportmonksProvider):
        raise RuntimeError(
            "enrich_duckdb_season_from_sportmonks requires CRICKET_API_PROVIDER=sportmonks "
            "and SPORTMONKS_API_TOKEN",
        )

    idx = _duckdb_match_index_for_season(duckdb_season)
    matched = 0
    written = 0
    skipped_no_lineup = 0
    no_duck_match = 0
    ambiguous = 0
    pages_fetched = 0
    page = 1
    detail_fetches = 0

    while True:
        if max_pages is not None and pages_fetched >= max_pages:
            log.warning("Stopped at max_pages=%s", max_pages)
            break
        body = await api.fetch_fixtures_by_season_page(sportmonks_season_id, page=page)
        pages_fetched += 1
        data = body.get("data") or []
        if not isinstance(data, list) or not data:
            break

        for m in data:
            if not isinstance(m, dict):
                continue
            t1, t2 = _fixture_franchises(api, m)
            if not t1 or not t2:
                continue

            starting_at = m.get("starting_at") or ""
            # Skip per-fixture API call if this date/team combo cannot match DuckDB.
            maybe_key = False
            for d in _date_candidates_from_starting_at(starting_at):
                if (frozenset({t1, t2}), d) in idx:
                    maybe_key = True
                    break
            if not maybe_key:
                no_duck_match += 1
                continue

            fid = m.get("id")
            if fid is None:
                continue
            full = await api.fetch_fixture_for_lineup(str(fid))
            detail_fetches += 1
            await asyncio.sleep(0.06)
            if not full:
                skipped_no_lineup += 1
                continue

            caps = _captains_from_fixture(api, full)
            c_home = caps.get(t1)
            c_away = caps.get(t2)
            if not c_home or not c_away:
                skipped_no_lineup += 1
                continue

            duck_match_id: str | None = None
            for d in _date_candidates_from_starting_at(starting_at):
                key = (frozenset({t1, t2}), d)
                ids = idx.get(key)
                if not ids:
                    continue
                if len(ids) > 1:
                    ambiguous += 1
                duck_match_id = ids[0]
                break
            if not duck_match_id:
                no_duck_match += 1
                continue

            rows = query(
                "SELECT team1, team2, CAST(date AS VARCHAR) AS d FROM matches WHERE match_id = ?",
                [duck_match_id],
            )
            if not rows:
                continue
            dr = rows[0]
            du1 = normalize_team(dr.get("team1") or "")
            du2 = normalize_team(dr.get("team2") or "")
            cap_du1 = caps.get(du1, "")
            cap_du2 = caps.get(du2, "")
            if not cap_du1 or not cap_du2:
                skipped_no_lineup += 1
                continue

            matched += 1
            sm_id = str(full.get("id", "") or m.get("id", "") or "")
            d_str = (dr.get("d") or "")[:10]
            if not dry_run:
                upsert_duckdb_match_captains(
                    duck_match_id,
                    str(duckdb_season),
                    sm_id or None,
                    d_str,
                    dr.get("team1") or "",
                    dr.get("team2") or "",
                    cap_du1,
                    cap_du2,
                )
            written += 1

        meta = body.get("meta") or {}
        pg = meta.get("pagination") or {}
        try:
            cur = int(pg.get("current_page") or page)
            total = int(pg.get("total_pages") or 1)
        except (TypeError, ValueError):
            cur, total = page, page
        if cur >= total:
            break
        page = cur + 1
        await asyncio.sleep(0.12)

    return {
        "duckdbSeason": str(duckdb_season),
        "sportmonksSeasonId": int(sportmonks_season_id),
        "dryRun": dry_run,
        "pagesFetched": pages_fetched,
        "fixturesMatchedToDuckdb": matched,
        "rowsWritten": written,
        "skippedNoLineupCaptains": skipped_no_lineup,
        "noDuckdbMatchForFixture": no_duck_match,
        "ambiguousDateTeamBuckets": ambiguous,
        "fixtureDetailFetches": detail_fetches,
    }


def aggregate_captain_stats_from_duckdb_cache(season: str) -> dict:
    """Captain W/L/NR using DuckDB ``matches`` + SQLite ``duckdb_match_captains``."""
    caps_list = get_duckdb_match_captains_for_season(season)
    caps_by_mid = {r["match_id"]: r for r in caps_list}
    matches = query(
        """
        SELECT match_id, team1, team2, winner, result
        FROM matches
        WHERE CAST(season AS VARCHAR) = ?
        """,
        [str(season)],
    )

    pair: dict[tuple[str, str], dict[str, int]] = {}

    def _bump(key: tuple[str, str], field: str) -> None:
        d = pair.setdefault(key, {"won": 0, "lost": 0, "nr": 0})
        d[field] = d.get(field, 0) + 1

    matches_used = 0
    for m in matches:
        mid = str(m.get("match_id") or "")
        ce = caps_by_mid.get(mid)
        if not ce:
            continue
        du1 = normalize_team(m.get("team1") or "")
        du2 = normalize_team(m.get("team2") or "")
        w_raw = (m.get("winner") or "").strip()
        w_n = normalize_team(w_raw) if w_raw else ""
        res = (m.get("result") or "").strip().lower()

        cap1 = (ce.get("captain_team1") or "").strip()
        cap2 = (ce.get("captain_team2") or "").strip()
        if not cap1 or not cap2:
            continue

        if w_n and w_n in (du1, du2):
            loser = du2 if w_n == du1 else du1
            wc = cap1 if w_n == du1 else cap2
            lc = cap2 if w_n == du1 else cap1
            _bump((w_n, wc), "won")
            _bump((loser, lc), "lost")
            matches_used += 1
        elif res in ("no result", "tie") or "no result" in res:
            _bump((du1, cap1), "nr")
            _bump((du2, cap2), "nr")
            matches_used += 1

    by_team: dict[str, list[dict]] = {}
    for (franchise, cap_name), tallies in pair.items():
        w, l, nr = tallies.get("won", 0), tallies.get("lost", 0), tallies.get("nr", 0)
        played = w + l + nr
        dec = w + l
        win_pct = round(100.0 * w / dec, 1) if dec else None
        by_team.setdefault(franchise, []).append(
            {
                "captain": cap_name,
                "played": played,
                "won": w,
                "lost": l,
                "nr": nr,
                "winPct": win_pct,
            }
        )
    for flist in by_team.values():
        flist.sort(key=lambda x: (-x["won"], -x["played"], x["captain"]))

    cap_tot: dict[str, dict] = {}
    for (franchise, cap_name), tallies in pair.items():
        agg = cap_tot.setdefault(
            cap_name,
            {"won": 0, "lost": 0, "nr": 0, "teams": set()},
        )
        agg["won"] += tallies.get("won", 0)
        agg["lost"] += tallies.get("lost", 0)
        agg["nr"] += tallies.get("nr", 0)
        agg["teams"].add(franchise)

    captains_out: list[dict] = []
    for cap_name, agg in cap_tot.items():
        w, l, nr = agg["won"], agg["lost"], agg["nr"]
        played = w + l + nr
        dec = w + l
        win_pct = round(100.0 * w / dec, 1) if dec else None
        captains_out.append(
            {
                "captain": cap_name,
                "played": played,
                "won": w,
                "lost": l,
                "nr": nr,
                "winPct": win_pct,
                "teamsLed": sorted(agg["teams"]),
                "image": "",
            }
        )
    captains_out.sort(key=lambda x: (-x["won"], -(x["winPct"] or -1), -x["played"], x["captain"]))

    team_order = sorted(by_team.keys())
    by_team_out = [{"team": tm, "captains": by_team[tm]} for tm in team_order]

    return {
        "seasonYear": season,
        "matchesUsed": matches_used,
        "captains": captains_out,
        "byTeam": by_team_out,
        "source": "duckdb+sportmonks_captain_cache",
        "enrichedRows": len(caps_list),
    }
