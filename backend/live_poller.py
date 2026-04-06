"""Background poller — fetches live scores from the cricket API and caches in SQLite.

Runs as an asyncio task inside the FastAPI process.  During an IPL match
window it polls every MATCH_POLL_INTERVAL seconds; outside match windows
it sleeps and rechecks every IDLE_CHECK_INTERVAL seconds.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from .ball_sync import compute_innings_scores_from_balls, compute_scorecard_from_balls, process_balls_from_fixture
from .cricket_api import RateLimitError, get_cricket_api
from .ipl_schedule import is_match_window, next_match_window
from .live_db import (
    get_ball_sync_state,
    get_scorecard,
    get_setting,
    get_today_api_hits,
    get_tracked_match_ids,
    log_poll,
    set_setting,
    upsert_ball_sync_state,
    upsert_matches,
    upsert_scorecard,
)
from .sportmonks_history import (
    promote_completed_ipl_fixtures,
    try_promote_after_scorecard,
)

logger = logging.getLogger(__name__)

DEFAULT_POLL_INTERVAL_MS = 15_000   # 15 seconds
MIN_POLL_INTERVAL_MS = 5_000        # 5 seconds (floor)
MAX_POLL_INTERVAL_MS = 900_000      # 15 minutes (ceiling)
IDLE_CHECK_INTERVAL = 300           # seconds between checks outside match windows
DAILY_HIT_BUDGET = 9_500            # safety margin below 10 000

LAST_DAILY_PROMOTION: date | None = None


@dataclass
class PollerState:
    """Observable state exposed to the /api/live/poller-status endpoint."""
    running: bool = False
    paused: bool = False
    in_match_window: bool = False
    poll_interval_ms: int = DEFAULT_POLL_INTERVAL_MS
    last_poll_at: str | None = None
    last_error: str | None = None
    total_cycles: int = 0
    consecutive_errors: int = 0
    provider_name: str = ""
    _next_window: str | None = field(default=None, repr=False)
    _force_poll: asyncio.Event = field(default_factory=asyncio.Event, repr=False)

    def to_dict(self) -> dict:
        return {
            "running": self.running,
            "paused": self.paused,
            "inMatchWindow": self.in_match_window,
            "pollIntervalMs": self.poll_interval_ms,
            "lastPollAt": self.last_poll_at,
            "lastError": self.last_error,
            "totalCycles": self.total_cycles,
            "consecutiveErrors": self.consecutive_errors,
            "providerName": self.provider_name,
            "nextMatchWindow": self._next_window,
            "apiHitsToday": get_today_api_hits(),
        }


poller_state = PollerState()


def _patch_scorecard_with_live_data(match_id: str, match_data: dict):
    """Update a cached scorecard's score/status fields from livescores data.

    When the detailed fixtures endpoint is rate-limited, we still receive
    fresh score data via the livescores endpoint. Merge it into the stored
    scorecard so the frontend shows up-to-date scores.
    """
    existing = get_scorecard(match_id)
    if not existing:
        return
    changed = False
    for key in ("score", "status", "matchStarted", "matchEnded", "matchWinner", "playerOfMatch"):
        if key in match_data and match_data[key] != existing.get(key):
            existing[key] = match_data[key]
            changed = True
    if changed:
        upsert_scorecard(match_id, existing)
        logger.info("Patched scorecard %s with livescores data", match_id)


async def _poll_once() -> int:
    """Run a single poll cycle.

    1. Refresh the match list (1 API hit) so scores stay current.
    2. Fetch scorecards for tracked matches (1 hit per match) for player details.
    3. If fixtures endpoint is rate-limited, patch cached scorecards from livescores data.
    """
    api = get_cricket_api()
    hits = 0
    matches: list[dict] = []

    try:
        matches = await api.fetch_matches()
        hits += 1
        upsert_matches(matches)
        log_poll("matches", "success", hits=1)
        logger.debug("Match list refreshed — %d matches", len(matches))
    except Exception as exc:
        logger.warning("Match list refresh failed: %s", exc)
        log_poll("matches", "error", error_msg=str(exc)[:500])

    match_lookup = {m["id"]: m for m in matches if m.get("id")}

    tracked_ids = get_tracked_match_ids()
    if not tracked_ids:
        logger.debug("No matches tracked — skipping scorecard fetch")
        return hits

    for mid in tracked_ids:
        prev = get_scorecard(mid)
        was_live = prev and not prev.get("matchEnded")
        live_data = match_lookup.get(mid, {})
        now_ended = live_data.get("matchEnded", False)
        if was_live and now_ended:
            api.reset_tier_cache(mid)
            logger.info("Match %s just ended — reset tier cache to fetch MOTM", mid)

    rate_limited = False
    for mid in tracked_ids:
        # Always include balls for tracked matches — same API call, 0 extra hits.
        # Ball-by-ball data is the ground truth for scoring/wickets; it corrects
        # stale Sportmonks bowling/batting includes.
        ball_sync = get_ball_sync_state(mid)
        if not ball_sync or not ball_sync.get("is_synced"):
            # Auto-enable ball sync so we start storing balls from now on
            upsert_ball_sync_state(mid, is_synced=1, mode="auto")

        try:
            sc = await api.fetch_scorecard(mid, include_balls=True)
            hits += 1

            # Extract and store balls from the same response (0 extra API hits)
            raw_fixture = sc.pop("_raw_fixture", None)
            if raw_fixture:
                try:
                    process_balls_from_fixture(mid, raw_fixture)
                except Exception as exc:
                    logger.warning("Ball storage failed for %s: %s", mid, exc)

            # Always try to compute from stored balls — even if this cycle's
            # storage failed, previous cycles may have stored usable data.
            try:
                ball_scores = compute_innings_scores_from_balls(mid)
                if ball_scores:
                    sc["score"] = ball_scores
                ball_scorecard = compute_scorecard_from_balls(mid)
                if ball_scorecard:
                    sc["scorecard"] = ball_scorecard
            except Exception as exc:
                logger.warning("Ball scorecard compute failed for %s: %s", mid, exc)

            prev = get_scorecard(mid)
            if not sc.get("playerOfMatch"):
                if prev and prev.get("playerOfMatch"):
                    sc["playerOfMatch"] = prev["playerOfMatch"]
            # Preserve previously stored matchWinner if the fresh fetch lost it
            # (Sportmonks may populate winner_team_id with a delay after match end)
            if not sc.get("matchWinner"):
                if prev and prev.get("matchWinner"):
                    sc["matchWinner"] = prev["matchWinner"]
            upsert_scorecard(mid, sc)
            log_poll("scorecard", "success", match_id=mid, hits=1)
            extra = await try_promote_after_scorecard(mid, sc)
            hits += extra
        except RateLimitError as exc:
            logger.warning("Rate limited fetching %s — using livescores fallback", mid)
            log_poll("scorecard", "rate_limited", match_id=mid, error_msg=str(exc)[:500])
            rate_limited = True
            if mid in match_lookup:
                _patch_scorecard_with_live_data(mid, match_lookup[mid])
            break
        except Exception as exc:
            logger.warning("Scorecard fetch failed for %s: %s", mid, exc)
            log_poll("scorecard", "error", match_id=mid, error_msg=str(exc)[:500])

    if rate_limited:
        for mid in tracked_ids:
            if mid in match_lookup:
                _patch_scorecard_with_live_data(mid, match_lookup[mid])

    return hits


async def refresh_match_list() -> int:
    """Fetch the current match list from the external API and cache it.

    Uses upsert to preserve tracking settings and cached scorecards.
    Costs 1 API hit.  Called manually by admin or automatically by the poller.
    """
    api = get_cricket_api()
    matches = await api.fetch_matches()
    upsert_matches(matches)
    log_poll("matches", "success", hits=1)
    logger.info("Match list refreshed — %d matches cached", len(matches))
    return len(matches)


def set_poll_interval(ms: int):
    """Update the polling interval (clamped to safe bounds) and persist to DB."""
    clamped = max(MIN_POLL_INTERVAL_MS, min(ms, MAX_POLL_INTERVAL_MS))
    poller_state.poll_interval_ms = clamped
    set_setting("poll_interval_ms", str(clamped))
    logger.info("Poll interval changed to %d ms (persisted)", clamped)
    return clamped


def load_persisted_interval():
    """Restore the polling interval from DB (if previously saved)."""
    saved = get_setting("poll_interval_ms")
    if saved is not None:
        try:
            ms = int(saved)
            clamped = max(MIN_POLL_INTERVAL_MS, min(ms, MAX_POLL_INTERVAL_MS))
            poller_state.poll_interval_ms = clamped
            logger.info("Loaded persisted poll interval: %d ms", clamped)
        except ValueError:
            pass


def pause_poller():
    poller_state.paused = True
    logger.info("Poller paused by admin")


def resume_poller():
    poller_state.paused = False
    logger.info("Poller resumed by admin")


def trigger_force_poll():
    """Wake the poller to run one cycle immediately."""
    poller_state._force_poll.set()
    logger.info("Force poll triggered by admin")


async def run_poller():
    """Main poller loop — intended to be launched via asyncio.create_task."""
    load_persisted_interval()
    api = get_cricket_api()
    poller_state.provider_name = type(api).__name__
    poller_state.running = True

    if not api.is_configured():
        logger.info("Cricket API key not configured — poller will idle")

    logger.info("Live-score poller started (provider=%s)", poller_state.provider_name)

    try:
        while True:
            if not api.is_configured():
                await asyncio.sleep(IDLE_CHECK_INTERVAL)
                continue

            if poller_state.paused:
                # Still wake up if force-poll is triggered
                try:
                    await asyncio.wait_for(poller_state._force_poll.wait(), timeout=IDLE_CHECK_INTERVAL)
                    poller_state._force_poll.clear()
                except asyncio.TimeoutError:
                    continue
                # Fall through to run one cycle even while paused

            now = datetime.now(timezone.utc)
            in_window = is_match_window(now)
            poller_state.in_match_window = in_window

            forced = poller_state._force_poll.is_set()
            poller_state._force_poll.clear()

            if not in_window and not forced:
                nxt = next_match_window(now)
                poller_state._next_window = nxt.isoformat() if nxt else None
                logger.debug(
                    "Outside match window — next window at %s",
                    poller_state._next_window or "season over",
                )

                # Once-a-day catch-up: promote any completed IPL fixtures not yet in DuckDB.
                global LAST_DAILY_PROMOTION
                today = now.date()
                if LAST_DAILY_PROMOTION != today:
                    try:
                        promoted, extra_hits = await promote_completed_ipl_fixtures()
                        logger.info(
                            "Daily auto-promote complete: %d promoted, %d hits",
                            promoted,
                            extra_hits,
                        )
                        LAST_DAILY_PROMOTION = today
                    except Exception as exc:
                        logger.warning(
                            "Daily auto-promote failed: %s",
                            exc,
                            exc_info=True,
                        )

                await asyncio.sleep(IDLE_CHECK_INTERVAL)
                continue

            if get_today_api_hits() >= DAILY_HIT_BUDGET and not forced:
                logger.warning("Daily API hit budget reached (%d) — pausing", DAILY_HIT_BUDGET)
                await asyncio.sleep(IDLE_CHECK_INTERVAL)
                continue

            try:
                hits = await _poll_once()
                poller_state.last_poll_at = datetime.now(timezone.utc).isoformat()
                poller_state.last_error = None
                poller_state.consecutive_errors = 0
                poller_state.total_cycles += 1
                logger.info(
                    "Poll cycle #%d complete — %d API hit(s)",
                    poller_state.total_cycles, hits,
                )
            except RateLimitError as exc:
                poller_state.last_error = f"Rate limited: {exc}"
                poller_state.consecutive_errors += 1
                backoff = min(60 * poller_state.consecutive_errors, 300)
                logger.warning("Rate limited — backing off %ds", backoff)
                log_poll("matches", "rate_limited", error_msg=str(exc)[:500])
                await asyncio.sleep(backoff)
                continue
            except Exception as exc:
                poller_state.last_error = str(exc)[:500]
                poller_state.consecutive_errors += 1
                logger.error("Poll cycle failed: %s", exc, exc_info=True)
                log_poll("matches", "error", error_msg=str(exc)[:500])
                interval_s = poller_state.poll_interval_ms / 1000
                backoff = min(interval_s * poller_state.consecutive_errors, 300)
                await asyncio.sleep(backoff)
                continue

            interval_s = poller_state.poll_interval_ms / 1000
            try:
                await asyncio.wait_for(poller_state._force_poll.wait(), timeout=interval_s)
                poller_state._force_poll.clear()
            except asyncio.TimeoutError:
                pass

    except asyncio.CancelledError:
        logger.info("Live-score poller shutting down")
    finally:
        poller_state.running = False
