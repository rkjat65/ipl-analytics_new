"""Resolve live/API display names to canonical names in the deliveries table."""

import functools

from .database import query
from .player_aliases import PLAYER_ALIASES


@functools.lru_cache(maxsize=512)
def resolve_player_name(name: str, role: str = "bat") -> str:
    """Map a full player name (e.g. from Sportmonks) to the historical DB name."""
    col = "batter" if role == "bat" else "bowler"
    raw = name.strip()

    term = raw.lower()
    if term in PLAYER_ALIASES:
        cand = PLAYER_ALIASES[term]
        hit = query(
            f"SELECT DISTINCT {col} FROM deliveries WHERE {col} = ? LIMIT 1",
            [cand],
        )
        if hit:
            return hit[0][col]

    exact = query(
        f"SELECT DISTINCT {col} FROM deliveries WHERE {col} = ? LIMIT 1",
        [raw],
    )
    if exact:
        return exact[0][col]

    parts = raw.split()
    if len(parts) >= 2:
        last = parts[-1]
        first_initial = parts[0][0].upper()
        abbr = f"{parts[0][0]} {last}"
        abbr_rows = query(
            f"SELECT DISTINCT {col} FROM deliveries WHERE {col} = ? LIMIT 1",
            [abbr],
        )
        if abbr_rows:
            return abbr_rows[0][col]

        if len(parts) >= 3:
            mid_initial = parts[1][0] if len(parts[1]) > 0 else ""
            abbr2 = f"{parts[0][0]}{mid_initial} {last}"
            abbr2_rows = query(
                f"SELECT DISTINCT {col} FROM deliveries WHERE {col} = ? LIMIT 1",
                [abbr2],
            )
            if abbr2_rows:
                return abbr2_rows[0][col]

        like_rows = query(
            f"SELECT DISTINCT {col} FROM deliveries WHERE {col} LIKE ? LIMIT 40",
            [f"%{last}%"],
        )
        if len(like_rows) == 1:
            return like_rows[0][col]
        # Disambiguate same surname (e.g. A Ashish Reddy vs Nithish Kumar Reddy):
        # require last-name suffix AND same first-letter as the live feed name.
        initial_hits = [
            row[col]
            for row in like_rows
            if (row[col] or "").endswith(last)
            and len(row[col]) > 0
            and row[col][0].upper() == first_initial
        ]
        if len(initial_hits) == 1:
            return initial_hits[0]
        if len(initial_hits) > 1:
            target_first = parts[0].lower()
            for val in initial_hits:
                fw = val.split()[0].lower() if val.split() else ""
                if fw.startswith(target_first[: min(4, len(target_first))]) or target_first.startswith(
                    fw[: min(4, len(fw))] if fw else ""
                ):
                    return val
            return initial_hits[0]

    return name


def _has_batting_rows(canonical: str) -> bool:
    r = query(
        "SELECT 1 FROM deliveries WHERE batter = ? AND is_super_over = false LIMIT 1",
        [canonical],
    )
    return bool(r)


def _has_bowling_rows(canonical: str) -> bool:
    r = query(
        "SELECT 1 FROM deliveries WHERE bowler = ? AND is_super_over = false LIMIT 1",
        [canonical],
    )
    return bool(r)


def canonical_player_slug(display_name: str) -> str | None:
    """Return canonical DB name for profile URL if player has batting or bowling data."""
    raw = (display_name or "").strip()
    if not raw:
        return None
    db_bat = resolve_player_name(raw, "bat")
    if _has_batting_rows(db_bat):
        return db_bat
    db_bowl = resolve_player_name(raw, "bowl")
    if _has_bowling_rows(db_bowl):
        return db_bowl
    return None
