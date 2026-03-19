"""Meta endpoints: seasons, teams, players search."""

from fastapi import APIRouter, Query
from ..database import query, normalize_team
from ..player_aliases import resolve_aliases

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/seasons")
def list_seasons():
    rows = query("SELECT DISTINCT season FROM matches ORDER BY season")
    return [r["season"] for r in rows]


@router.get("/teams")
def list_teams():
    rows = query("""
        SELECT DISTINCT team FROM (
            SELECT team1 AS team FROM matches
            UNION
            SELECT team2 AS team FROM matches
        ) t
        ORDER BY team
    """)
    return sorted(set(normalize_team(r["team"]) for r in rows))


@router.get("/players")
def search_players(q: str = Query("", min_length=0)):
    if not q:
        rows = query("SELECT name FROM players ORDER BY name LIMIT 50")
        return [r["name"] for r in rows]

    # 1. Resolve aliases for the search term
    alias_matches = resolve_aliases(q)

    # 2. Verify alias matches actually exist in the database
    verified_aliases: list[str] = []
    for name in alias_matches:
        check = query(
            "SELECT name FROM players WHERE name = ? LIMIT 1",
            [name],
        )
        if check:
            verified_aliases.append(check[0]["name"])

    # 3. Regular LIKE search
    like_rows = query(
        "SELECT name FROM players WHERE LOWER(name) LIKE '%' || LOWER(?) || '%' ORDER BY name LIMIT 50",
        [q],
    )
    like_names = [r["name"] for r in like_rows]

    # 4. Combine: alias matches first, then LIKE results, deduplicated
    seen: set[str] = set()
    results: list[str] = []
    for name in verified_aliases + like_names:
        if name not in seen:
            seen.add(name)
            results.append(name)

    return results[:50]
