"""DuckDB connection manager with thread-local connections."""

import os
import threading
import duckdb

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "ipl.duckdb")

# ── Team name normalisation ──────────────────────────────────────────
TEAM_NAME_MAP = {
    "Delhi Daredevils": "Delhi Capitals",
    "Kings XI Punjab": "Punjab Kings",
    "Royal Challengers Bangalore": "Royal Challengers Bengaluru",
    "Rising Pune Supergiant": "Rising Pune Supergiants",
}


def normalize_team(name):
    """Map historical team names to current names."""
    return TEAM_NAME_MAP.get(name, name)


def team_variants(name):
    """Return all historical names for a team."""
    canonical = normalize_team(name)
    variants = [canonical]
    for old, new in TEAM_NAME_MAP.items():
        if new == canonical:
            variants.append(old)
    return list(set(variants))

_local = threading.local()


def get_db() -> duckdb.DuckDBPyConnection:
    """Return a thread-local read-only DuckDB connection."""
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = duckdb.connect(DB_PATH, read_only=True)
    return _local.conn


# Reusable CTE that resolves super-over winners for tied matches.
# Returns match_id + so_winner.  Use: LEFT JOIN super_over_winners sow ON ...
# For the one double-tied super over (match 729315, KKR vs RR 2014),
# KKR won on boundary count (1 six vs 1 four).
SUPER_OVER_WINNER_CTE = """
    super_over_winners AS (
        SELECT i.match_id,
            CASE
                WHEN MAX(CASE WHEN rn = 2 THEN total_runs END) > MAX(CASE WHEN rn = 1 THEN total_runs END)
                    THEN MAX(CASE WHEN rn = 2 THEN batting_team END)
                WHEN MAX(CASE WHEN rn = 1 THEN total_runs END) > MAX(CASE WHEN rn = 2 THEN total_runs END)
                    THEN MAX(CASE WHEN rn = 1 THEN batting_team END)
                -- Tied super over (only match 729315): KKR won by boundary count
                WHEN i.match_id = 729315
                    THEN 'Kolkata Knight Riders'
                ELSE NULL
            END AS so_winner
        FROM (
            SELECT match_id, innings_number, batting_team, total_runs,
                ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY innings_number DESC) AS rn
            FROM innings
            WHERE is_super_over = true
        ) i
        WHERE rn <= 2
        GROUP BY i.match_id
    )
"""


def query(sql: str, params: list | None = None) -> list[dict]:
    """Execute a SQL query and return results as a list of dicts."""
    conn = get_db()
    if params:
        result = conn.execute(sql, params)
    else:
        result = conn.execute(sql)
    columns = [desc[0] for desc in result.description]
    rows = result.fetchall()
    return [dict(zip(columns, row)) for row in rows]
