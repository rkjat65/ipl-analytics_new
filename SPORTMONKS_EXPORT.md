# Sportmonks → Historical Database Export

This document explains how live IPL match data from Sportmonks is converted to
Cricsheet format and ingested into `ipl.duckdb` for historical analytics.

---

## How It Works

### Pipeline Overview

```
Sportmonks API (ball-by-ball)
        │
        ▼
fixture_to_cricsheet()        ← converts to Cricsheet JSON schema
        │
        ▼
ipl_json/sm_<fixture_id>.json ← saved as canonical JSON
        │
        ▼
ingest.py                     ← parses into matches + deliveries tables
        │
        ▼
ipl.duckdb                    ← historical analytics database
```

### Key Files

| File | Purpose |
|------|---------|
| `backend/sportmonks_cricsheet_export.py` | Converts a Sportmonks fixture (with `balls` include) into a Cricsheet-shaped dict |
| `backend/sportmonks_history.py` | Orchestrates: fetch fixture → write JSON → ingest into DuckDB |
| `backend/player_resolve.py` | Maps Sportmonks full names to Cricsheet names already in DuckDB (e.g. "Virat Kohli" → "V Kohli") |
| `ingest.py` | Generic Cricsheet JSON → DuckDB ingester |
| `ipl_json/sm_*.json` | Exported match files |

---

## Auto-Promotion (Default Behavior)

The live poller **automatically promotes** finished IPL matches into DuckDB.
No manual action is needed for typical use.

**Trigger:** After each scorecard poll, `try_promote_after_scorecard()` checks:

1. Is the match ended? (`matchEnded == true`)
2. Is it an IPL match? (`isIPL == true`)
3. Is the fixture from the configured season? (`SEASON_ID` env var)
4. Is it already in DuckDB? (skip if yes)

If all conditions pass, it:
- Fetches the fixture with `balls.batsman,balls.bowler,balls.score,balls.catchstump` includes (1 API hit)
- Converts to Cricsheet JSON via `fixture_to_cricsheet()`
- Normalizes player names to match existing DuckDB entries
- Writes `ipl_json/sm_<id>.json`
- Ingests into `ipl.duckdb` with `replace_existing_match=True`

**Log confirmation:**
```
backend.sportmonks_history INFO Promoted sm_69519 into DuckDB
```

---

## Manual Export (When Needed)

### Option 1: Python Script

```bash
cd /Users/ksjain/rk/ipl-analytics_new
source .venv/bin/activate

python3 -c "
import asyncio
from backend.sportmonks_history import promote_sportmonks_fixture

async def main():
    ok, hits = await promote_sportmonks_fixture(
        '69519',           # Sportmonks fixture ID
        skip_if_in_db=False # Force re-export even if already present
    )
    print(f'Ingested: {ok}, API hits: {hits}')

asyncio.run(main())
"
```

### Option 2: Export JSON Only (Without DuckDB Ingest)

```bash
python3 -c "
import asyncio
from backend.sportmonks_history import export_sportmonks_fixture_to_json

async def main():
    path = await export_sportmonks_fixture_to_json('69519')
    print(f'Wrote: {path}')

asyncio.run(main())
"
```

### Option 3: Ingest Existing JSON Into DuckDB

```bash
python3 -c "
from backend.sportmonks_history import ingest_sm_json
ingest_sm_json('sm_69519')
print('Done')
"
```

---

## Finding Sportmonks Fixture IDs

Fixture IDs are visible in:

1. **Admin page** → Fetch Matches → match IDs shown in the list
2. **Backend logs** → look for `fixtures/<id>` in API calls
3. **Database** → `SELECT match_id FROM live_matches` in `live_scores.db`
4. **Sportmonks dashboard** → `https://my.sportmonks.com`

---

## Verifying Export Success

### Check DuckDB for Sportmonks Matches

```bash
python3 -c "
import duckdb
con = duckdb.connect('ipl.duckdb', read_only=True)
r = con.execute(\"\"\"
    SELECT m.match_id, m.date, m.team1, m.team2, m.winner,
           COUNT(d.match_id) as ball_count
    FROM matches m
    LEFT JOIN deliveries d ON m.match_id = d.match_id
    WHERE m.match_id LIKE 'sm_%'
    GROUP BY m.match_id, m.date, m.team1, m.team2, m.winner
    ORDER BY m.date DESC
\"\"\").fetchall()
for row in r:
    print(f'{row[0]} | {row[1]} | {row[2]} vs {row[3]} | Winner: {row[4]} | {row[5]} balls')
con.close()
"
```

### Check Exported JSON Files

```bash
ls -lt ipl_json/sm_*.json
```

---

## Export Log — IPL 2026

| Date | Fixture ID | Match ID | Teams | Balls | Method |
|------|-----------|----------|-------|-------|--------|
| 2026-03-28 | 69518 | sm_69518 | RCB vs SRH | 225 | Auto-promoted |
| 2026-03-29 | 69519 | sm_69519 | MI vs KKR | 247 | Auto-promoted |
| 2026-03-30 | 69520 | sm_69520 | RR vs CSK | ? | MISSING — needs manual promote |
| 2026-03-31 | 69521 | sm_69521 | PBKS vs GT | ? | MISSING — needs manual promote |

---

## Troubleshooting

### "fixture has no balls"
The Sportmonks API didn't return ball-by-ball data. This can happen if:
- The match hasn't ended yet
- The `balls.*` includes were rejected (API limits)
- Wait and retry after the match is fully completed

### Rate limited during export
The fixture fetch for ball-by-ball data counts as 1 API hit. If rate-limited,
wait 1–2 minutes and retry.

### Player names don't match existing DuckDB data
`normalize_cricsheet_names_to_duckdb()` uses `player_resolve.py` to map names.
If a new player isn't matched, they'll appear with their Sportmonks full name.
Add a mapping in `player_resolve.py` if needed.

### Re-exporting a match
Use `skip_if_in_db=False` to force re-export:
```python
await promote_sportmonks_fixture('69519', skip_if_in_db=False)
```
This replaces the existing match data in DuckDB.
