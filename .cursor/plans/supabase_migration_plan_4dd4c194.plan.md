---
name: Supabase Migration Plan
overview: Migrate all three databases (DuckDB analytics, SQLite live scores, SQLite auth) from Railway file volumes to a single Supabase PostgreSQL instance, updating the connection layer and fixing SQL syntax incompatibilities across 18+ backend files.
todos:
  - id: supabase-schema
    content: Create Supabase project and run full schema DDL (13 tables + indexes)
    status: pending
  - id: data-export
    content: Export data from DuckDB (CSV) and SQLite (live + auth) on Railway
    status: pending
  - id: data-import
    content: Import CSV data into Supabase via psql COPY
    status: pending
  - id: db-pool
    content: Create new backend/db.py with psycopg ConnectionPool
    status: pending
  - id: rewrite-database
    content: Rewrite backend/database.py to use Postgres pool instead of DuckDB
    status: pending
  - id: rewrite-live-db
    content: "Rewrite backend/live_db.py: sqlite3 -> psycopg, ? -> %s, jsonb handling"
    status: pending
  - id: rewrite-auth-db
    content: "Rewrite backend/auth_db.py: sqlite3 -> psycopg, ? -> %s"
    status: pending
  - id: update-main
    content: Update backend/main.py lifespan to init/close Postgres pool
    status: pending
  - id: fix-qualify
    content: Fix QUALIFY syntax in routers/analytics.py (2 occurrences)
    status: pending
  - id: fix-int-div
    content: Fix // integer division in routers/matches.py (1) and routers/players.py (4)
    status: pending
  - id: fix-first
    content: Fix FIRST() aggregate in routers/players.py (1 occurrence)
    status: pending
  - id: migrate-params
    content: Global ? -> %s and list -> tuple across all 11 router files + player_resolve.py
    status: pending
  - id: update-auth-billing
    content: Update routers/auth.py and routers/billing.py to use new db module
    status: pending
  - id: update-ingest
    content: "Rewrite ingest.py: duckdb -> psycopg, INSERT OR REPLACE -> ON CONFLICT"
    status: pending
  - id: update-sportmonks
    content: Update sportmonks_history.py to use Postgres instead of DuckDB
    status: pending
  - id: update-deps
    content: "Update requirements.txt: add psycopg[binary] + psycopg-pool, remove duckdb"
    status: pending
  - id: update-env
    content: Add DATABASE_URL to backend/.env, remove LIVE_DB_PATH/AUTH_DB_PATH
    status: pending
  - id: test-verify
    content: Test all API endpoints, live poller, auth flow, and ingest pipeline
    status: pending
isProject: false
---

# Supabase PostgreSQL Migration Plan

## Current State

Three file-based databases running on Railway volumes:

```mermaid
flowchart LR
  subgraph railway [Railway Volume]
    DuckDB["ipl.duckdb\n4 tables\n~250K rows"]
    LiveSQLite["live_scores.db\n6 tables"]
    AuthSQLite["users.db\n3 tables"]
  end
  subgraph backend [FastAPI Backend]
    DB["database.py\nduckdb.connect()"]
    LDB["live_db.py\nsqlite3.connect()"]
    ADB["auth_db.py\nsqlite3.connect()"]
  end
  DB --> DuckDB
  LDB --> LiveSQLite
  ADB --> AuthSQLite
```



## Target State

Single Supabase PostgreSQL instance, all 13 tables, one connection pool:

```mermaid
flowchart LR
  subgraph supabase [Supabase PostgreSQL]
    Analytics["matches, innings,\ndeliveries, players"]
    Live["live_matches, live_scorecards,\npoll_log, settings,\nlive_balls, ball_sync_state"]
    Auth["users, sessions, usage"]
  end
  subgraph backend [FastAPI Backend]
    Pool["db.py\npsycopg connection pool"]
  end
  Pool --> Analytics
  Pool --> Live
  Pool --> Auth
```



---

## Step 1: Create Supabase Project and Schema

1. Go to [supabase.com](https://supabase.com), create a new project
2. Copy the connection string from Settings > Database > Connection string (URI)
3. Open SQL Editor in Supabase Dashboard
4. Run the full schema DDL (all 13 tables) -- I will provide this as a migration SQL file

Key Postgres adaptations from the current schema:

- `TEXT` data columns in live tables become `JSONB` (better querying, indexing)
- `INTEGER` booleans become proper `BOOLEAN`
- `datetime('now')` defaults become `NOW()`
- Add indexes on `deliveries(match_id)`, `deliveries(batter)`, `deliveries(bowler)` for analytical query performance

---

## Step 2: Export Data from Railway

**DuckDB** -- export 4 tables to CSV:

```python
import duckdb
con = duckdb.connect("ipl.duckdb", read_only=True)
for t in ["matches", "innings", "deliveries", "players"]:
    con.execute(f"COPY {t} TO '{t}.csv' (HEADER, DELIMITER ',')")
```

**SQLite** -- export live + auth data:

```bash
sqlite3 live_scores.db ".mode csv" ".headers on" ".output live_matches.csv" "SELECT * FROM live_matches;"
# repeat for each table
sqlite3 users.db ".mode csv" ".headers on" ".output users.csv" "SELECT * FROM users;"
```

---

## Step 3: Import Data into Supabase

Use `psql` with `\COPY`:

```bash
psql "$DATABASE_URL" -c "\COPY matches FROM 'matches.csv' CSV HEADER"
psql "$DATABASE_URL" -c "\COPY innings FROM 'innings.csv' CSV HEADER"
psql "$DATABASE_URL" -c "\COPY players FROM 'players.csv' CSV HEADER"
psql "$DATABASE_URL" -c "\COPY deliveries FROM 'deliveries.csv' CSV HEADER"
```

---

## Step 4: New Unified Connection Layer

Create a new `[backend/db.py](backend/db.py)` that replaces all three connection modules with a single `psycopg` connection pool.

- **New dependency**: `psycopg[binary]>=3.1` in `[backend/requirements.txt](backend/requirements.txt)`
- **Single pool** initialized in `[backend/main.py](backend/main.py)` lifespan, shared across all modules
- `**query(sql, params)`** function stays the same signature but uses `%s` placeholders internally
- Thread-safety handled by psycopg's built-in `ConnectionPool`

```python
# backend/db.py (new unified module)
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

pool: ConnectionPool | None = None

def init_pool(conninfo: str):
    global pool
    pool = ConnectionPool(conninfo, min_size=2, max_size=10, kwargs={"row_factory": dict_row})

def get_conn():
    return pool.connection()

def query(sql: str, params: tuple | None = None) -> list[dict]:
    with pool.connection() as conn:
        cur = conn.execute(sql, params)
        if cur.description:
            return cur.fetchall()
        return []
```

---

## Step 5: Rewrite `database.py` (DuckDB analytics layer)

`[backend/database.py](backend/database.py)` -- change `query()` to use the new `db.py` pool instead of `duckdb.connect()`. Keep all the helper functions (`normalize_team`, `team_variants`, `VENUE_NORM_SQL`, `SUPER_OVER_WINNER_CTE`) unchanged since they are pure Python or standard SQL.

Remove:

- `duckdb` import and `get_db()` thread-local logic
- `refresh_db()` (no longer needed -- Postgres is always live)

Change:

- `query()` delegates to `db.query()`
- `?` placeholder style is no longer exposed here (routers will use `%s`)

---

## Step 6: Rewrite `live_db.py` (Live scores layer)

`[backend/live_db.py](backend/live_db.py)` -- replace `sqlite3.connect()` with `db.get_conn()`. Update all 20+ functions:

- `?` placeholders -> `%s`
- `json.dumps()`/`json.loads()` for `data` column -> psycopg handles `jsonb` natively (pass Python dict directly, retrieve as dict)
- `conn.commit()` -> handled by `with` context manager
- `sqlite3.Row` -> `dict_row` from psycopg (already set in pool)
- Remove `init_live_db()` (schema is pre-created in Supabase)

---

## Step 7: Rewrite `auth_db.py` (Auth layer)

`[backend/auth_db.py](backend/auth_db.py)` -- same pattern as live_db:

- `?` -> `%s`
- Remove `init_auth_db()` (schema pre-created)
- Remove migration `ALTER TABLE` blocks

---

## Step 8: Update `main.py` Lifespan

`[backend/main.py](backend/main.py)`:

- Import `db.init_pool` instead of `init_auth_db`/`init_live_db`
- Call `init_pool(os.environ["DATABASE_URL"])` in lifespan startup
- Call `pool.close()` in lifespan shutdown
- Remove `init_auth_db()` and `init_live_db()` calls

---

## Step 9: Fix DuckDB-Specific SQL in Routers

Only **3 syntax patterns** need changing across **3 files**:

### 9a. `QUALIFY` -> subquery (`[backend/routers/analytics.py](backend/routers/analytics.py)`)

Two occurrences (lines ~617, ~629). Wrap in subquery:

```sql
-- Before (DuckDB):
SELECT ... GROUP BY ... QUALIFY ROW_NUMBER() OVER (...) = 1

-- After (Postgres):
SELECT * FROM (SELECT ..., ROW_NUMBER() OVER (...) AS rn GROUP BY ...) sub WHERE rn = 1
```

### 9b. `//` integer division -> `FLOOR(... / ...)` (`[backend/routers/matches.py](backend/routers/matches.py)`, `[backend/routers/players.py](backend/routers/players.py)`)

```sql
-- Before (DuckDB):
CAST(x AS INTEGER) // 6

-- After (Postgres):
FLOOR(CAST(x AS INTEGER) / 6.0)::INTEGER
-- or simply:
(CAST(x AS INTEGER) / 6)   -- Postgres integer division with two integers
```

Occurrences: `matches.py` (1), `players.py` (4)

### 9c. `FIRST(x ORDER BY ...)` -> subquery (`[backend/routers/players.py](backend/routers/players.py)`)

```sql
-- Before (DuckDB):
FIRST(figures ORDER BY fig_w DESC, fig_r ASC) AS best_figures

-- After (Postgres):
(SELECT figures FROM best b2 WHERE b2.player = best.player ORDER BY fig_w DESC, fig_r ASC LIMIT 1) AS best_figures
```

One occurrence (line ~154).

---

## Step 10: Global `?` -> `%s` Placeholder Migration

All 11 router files that call `query()` need their SQL parameter placeholders changed from `?` to `%s`:


| File                                                                     | Approx `?` count |
| ------------------------------------------------------------------------ | ---------------- |
| `[backend/routers/analytics.py](backend/routers/analytics.py)`           | ~15              |
| `[backend/routers/matches.py](backend/routers/matches.py)`               | ~10              |
| `[backend/routers/players.py](backend/routers/players.py)`               | ~20              |
| `[backend/routers/teams.py](backend/routers/teams.py)`                   | ~30              |
| `[backend/routers/seasons.py](backend/routers/seasons.py)`               | ~15              |
| `[backend/routers/venues.py](backend/routers/venues.py)`                 | ~10              |
| `[backend/routers/pulse.py](backend/routers/pulse.py)`                   | ~10              |
| `[backend/routers/advanced.py](backend/routers/advanced.py)`             | ~15              |
| `[backend/routers/live_analytics.py](backend/routers/live_analytics.py)` | ~10              |
| `[backend/routers/meta.py](backend/routers/meta.py)`                     | ~5               |
| `[backend/routers/ai.py](backend/routers/ai.py)`                         | 0 (no params)    |


Also update:

- `[backend/routers/auth.py](backend/routers/auth.py)` -- uses `get_auth_db()` directly
- `[backend/routers/billing.py](backend/routers/billing.py)` -- uses `get_auth_db()` directly
- `[backend/player_resolve.py](backend/player_resolve.py)` -- uses `query()`
- `[backend/live_poller.py](backend/live_poller.py)` -- calls `live_db` functions
- `[backend/ball_sync.py](backend/ball_sync.py)` -- calls `live_db` functions

Additionally, `query()` params must change from `list` to `tuple` (psycopg requirement).

---

## Step 11: Update `ingest.py`

`[ingest.py](ingest.py)` -- rewrite to use psycopg instead of duckdb:

- `INSERT OR REPLACE` -> `INSERT ... ON CONFLICT DO UPDATE`
- `?` -> `%s`
- Remove `duckdb.connect()`, use `psycopg.connect(DATABASE_URL)`
- DataFrame-based bulk insert -> `COPY` or `executemany()`

---

## Step 12: Update `sportmonks_history.py`

`[backend/sportmonks_history.py](backend/sportmonks_history.py)`:

- `is_match_in_duckdb()` -> `is_match_in_db()` using psycopg
- Remove `duckdb` import
- `refresh_db()` calls can be removed (Postgres is always live)

---

## Step 13: Environment and Deployment

Add to `[backend/.env](backend/.env)`:

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres
```

Remove from deployment config:

- `LIVE_DB_PATH` and `AUTH_DB_PATH` env vars
- Railway volume mounts for SQLite files

Update `[backend/requirements.txt](backend/requirements.txt)`:

- Add: `psycopg[binary]>=3.1`, `psycopg-pool>=3.1`
- Remove: `duckdb==1.1.0`

---

## Step 14: Test and Verify

1. Run locally against Supabase with `DATABASE_URL` set
2. Verify all API endpoints return correct data
3. Test live poller writes and reads
4. Test auth login/session flow
5. Test ingest pipeline for new match data
6. Deploy to Railway (remove volume dependency)

---

## Files Changed Summary


| Category        | Files                                                                                      | Change Type                |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| New             | `backend/db.py`                                                                            | Connection pool module     |
| Full rewrite    | `backend/database.py`, `backend/live_db.py`, `backend/auth_db.py`                          | DuckDB/SQLite -> psycopg   |
| Modify          | `backend/main.py`                                                                          | Pool init in lifespan      |
| SQL syntax fix  | `backend/routers/analytics.py`, `backend/routers/matches.py`, `backend/routers/players.py` | QUALIFY, //, FIRST()       |
| Param migration | 11 router files + `player_resolve.py`                                                      | `?` -> `%s`, list -> tuple |
| Rewrite         | `ingest.py`, `backend/sportmonks_history.py`                                               | DuckDB -> psycopg          |
| Config          | `backend/requirements.txt`, `backend/.env`                                                 | Dependencies + env var     |
| Total           | ~20 files                                                                                  |                            |


