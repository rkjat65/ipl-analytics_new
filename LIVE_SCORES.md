# Live Scores — System Design & Implementation

## Overview

Live cricket scores are fetched by a **background poller** running inside the FastAPI process. Users never hit the external cricket API directly — they read from a local SQLite cache that the poller keeps up to date.

```
┌──────────── Railway (Single Service) ──────────────────────┐
│                                                             │
│   FastAPI Process                                           │
│   ┌────────────────────┐    ┌────────────────────────────┐ │
│   │  Web Endpoints      │    │  Background Poller         │ │
│   │                    │    │  (asyncio task)             │ │
│   │  GET /api/live/*   │    │                            │ │
│   │  reads from SQLite │    │  • Checks IPL schedule     │ │
│   │                    │    │  • If match window →       │ │
│   │                    │    │    poll cricket API (30s)   │ │
│   │                    │    │  • Writes to SQLite        │ │
│   └────────┬───────────┘    └─────────────┬──────────────┘ │
│            │                              │                 │
│            ▼                              ▼                 │
│       ┌────────────────────────────────────┐                │
│       │   SQLite (data/live_scores.db)     │                │
│       │   • live_matches                   │                │
│       │   • live_scorecards                │                │
│       │   • poll_log                       │                │
│       └────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
        ▲                              │
        │  Users read from DB          │  Poller calls external API
        │  (fast, no rate limits)      ▼
   ┌─────────┐               ┌───────────────┐
   │ Browser │               │ CricketData / │
   │ (React) │               │ CricAPI       │
   └─────────┘               └───────────────┘
```

## API Budget

The CricketData plan provides **10,000 API hits/day**. The poller uses a safety cap of 9,500.

| Scenario                          | Poll interval | Hits/match | Hits/day (single) | Hits/day (double header) |
| --------------------------------- | ------------- | ---------- | ------------------ | ------------------------ |
| Match list only                   | 30s           | 480        | 480                | 960                      |
| List + 1 scorecard                | 30s each      | 960        | 960                | 1,920                    |
| List + 2 scorecards (worst case)  | 30s each      | 1,440      | 1,440              | 2,880                    |

Even the most aggressive double-header scenario uses under 3,000 hits — well within the 10,000 daily budget.

## File Structure

```
backend/
├── cricket_api.py      # Abstracted API client (provider pattern)
├── ipl_schedule.py     # IPL 2026 schedule + match window detection
├── live_db.py          # SQLite operations for live score caching
├── live_poller.py      # Background poller (asyncio task)
├── main.py             # Lifespan launches the poller on startup
└── routers/
    └── live.py         # /api/live/* endpoints (read from SQLite)
```

## How Each File Works

### `cricket_api.py` — API Abstraction Layer

This is the **only file that talks to the external cricket API**. It defines:

- **`CricketAPIProvider`** — abstract base class with three methods:
  - `fetch_matches()` → list of current/recent/upcoming matches
  - `fetch_scorecard(match_id)` → full scorecard with batting/bowling details
  - `fetch_match_info(match_id)` → lightweight match info
  - `is_configured()` → checks if the API key is set

- **`CricAPIProvider`** — concrete implementation for CricAPI / CricketData (both use the same upstream API at `api.cricapi.com`).

- **`get_cricket_api()`** — singleton factory that reads `CRICKET_API_PROVIDER` from env and returns the right provider.

All responses are normalised into canonical dict shapes so the rest of the code never needs to know which provider is in use.

### `ipl_schedule.py` — Schedule & Match Window Detection

Contains the full IPL 2026 league-stage schedule (70 matches) and provides:

- **`is_match_window(now)`** — returns `True` if the current time falls within any match's active window: `[match_start - 15min, match_start + 4h30m]`
- **`next_match_window(now)`** — returns the datetime of the next upcoming window
- **`compute_schedule_with_status()`** — builds the `/api/live/schedule` response with computed `live`/`upcoming`/`completed` status per match

Times are stored as IST and converted to UTC internally.

### `live_db.py` — SQLite Cache

Stores three tables in `backend/data/live_scores.db`:

| Table              | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `live_matches`     | Cached match list (JSON blob per match, indexed by ID) |
| `live_scorecards`  | Cached scorecards (JSON blob per match)                |
| `poll_log`         | Audit trail: every API call logged with timestamp      |

Write operations (called by the poller):
- `upsert_matches(matches)` — INSERT OR UPDATE match rows
- `upsert_scorecard(match_id, data)` — INSERT OR UPDATE scorecard
- `log_poll(type, status, ...)` — record a poll attempt

Read operations (called by API endpoints):
- `get_all_matches()` — sorted: IPL first → live → upcoming → completed
- `get_scorecard(match_id)` — single scorecard lookup
- `get_match(match_id)` — single match lookup
- `get_today_api_hits()` — count of successful API calls today
- `get_last_poll_time()` — timestamp of most recent successful poll

### `live_poller.py` — Background Poller

Runs as an `asyncio.create_task` inside the FastAPI process. The main loop:

```
while True:
    if API key not configured → sleep 5 min, continue
    if NOT in match window   → sleep 5 min, continue
    if daily hit budget reached → sleep 5 min, continue

    # In match window with budget remaining:
    1. Fetch match list from API (1 hit)
    2. Write all matches to SQLite
    3. For each live IPL match, fetch scorecard (1 hit each)
    4. Write scorecards to SQLite
    5. Sleep 30 seconds
```

Error handling:
- Individual scorecard failures don't crash the cycle
- Full cycle failures trigger exponential backoff (30s, 60s, 90s… up to 5 min)
- All errors are logged to `poll_log` and to the console

Observable state is exposed via the `poller_state` singleton (used by the `/poller-status` endpoint).

### `routers/live.py` — API Endpoints

All endpoints read from SQLite. Zero external API calls on user requests.

| Endpoint                      | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `GET /api/live/status`        | Is the API configured? Poller state summary.    |
| `GET /api/live/matches`       | Cached match list from DB                       |
| `GET /api/live/scorecard/:id` | Cached scorecard (falls back to match data)     |
| `GET /api/live/info/:id`      | Lightweight match info from DB                  |
| `GET /api/live/schedule`      | IPL 2026 schedule with computed status          |
| `GET /api/live/poller-status` | Debug: poller state, API hits today, last poll   |

### `main.py` — Application Lifecycle

Uses FastAPI's `lifespan` context manager:

```python
@asynccontextmanager
async def lifespan(app):
    init_auth_db()
    init_live_db()
    poller_task = asyncio.create_task(run_poller())
    yield
    poller_task.cancel()
```

The poller starts automatically on server boot and stops on shutdown.

## Configuration

Add these to `backend/.env`:

```env
# Required — pick one:
CRICKETDATA_API_KEY=your_key_here
# or
CRICAPI_KEY=your_key_here

# Optional — defaults shown:
CRICKET_API_PROVIDER=cricketdata    # or "cricapi"
CRICKET_API_BASE_URL=               # override API base URL if needed
LIVE_DB_PATH=                       # override SQLite path (default: backend/data/live_scores.db)
```

## Switching API Providers

### Using a different key tier (same API)

Just change the env var:

```env
CRICKET_API_PROVIDER=cricketdata
CRICKETDATA_API_KEY=new_key
```

### Adding a completely new provider

1. Create a new class in `backend/cricket_api.py`:

```python
class ESPNProvider(CricketAPIProvider):
    async def fetch_matches(self) -> list[dict]:
        # Fetch from ESPN API
        # Return normalised match dicts (same shape as CricAPIProvider)
        ...

    async def fetch_scorecard(self, match_id: str) -> dict:
        ...

    async def fetch_match_info(self, match_id: str) -> dict:
        ...

    def is_configured(self) -> bool:
        return bool(os.getenv("ESPN_API_KEY"))
```

2. Register it:

```python
_PROVIDERS = {
    "cricapi": CricAPIProvider,
    "cricketdata": CricAPIProvider,
    "espn": ESPNProvider,          # ← add here
}
```

3. Set in `.env`:

```env
CRICKET_API_PROVIDER=espn
ESPN_API_KEY=your_key
```

No other code changes needed — the poller, DB, and endpoints all work through the abstraction.

## Frontend Changes

- Poll interval reduced from **15 minutes** to **30 seconds** (safe because it reads from the local DB, not the external API)
- Setup guide updated to mention CricketData alongside CricAPI
- Auto-refresh label updated to "Refreshes every 30s"

## Monitoring

### Via the API

```
GET /api/live/poller-status
```

Returns:

```json
{
  "running": true,
  "inMatchWindow": true,
  "lastPollAt": "2026-03-28T14:30:00+00:00",
  "lastError": null,
  "totalCycles": 142,
  "consecutiveErrors": 0,
  "providerName": "CricAPIProvider",
  "nextMatchWindow": null,
  "apiHitsToday": 284
}
```

### Via logs

The poller logs to stdout:

```
2026-03-28 14:00:15 backend.live_poller INFO  Live-score poller started (provider=CricAPIProvider)
2026-03-28 14:00:45 backend.live_poller INFO  Poll cycle #1 complete — 2 API hit(s)
2026-03-28 14:01:15 backend.live_poller INFO  Poll cycle #2 complete — 2 API hit(s)
```

### Safety mechanisms

| Mechanism              | Behaviour                                                         |
| ---------------------- | ----------------------------------------------------------------- |
| Daily hit budget       | Stops polling at 9,500 hits (below the 10,000 limit)             |
| Match window gating    | Only polls during scheduled IPL match windows                    |
| Exponential backoff    | On errors: 30s → 60s → 90s → … → 5 min max                     |
| Scorecard isolation    | One scorecard failure doesn't stop other scorecards or the cycle |
| Graceful shutdown      | Poller cancels cleanly when the server stops                     |
