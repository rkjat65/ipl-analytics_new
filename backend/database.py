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
