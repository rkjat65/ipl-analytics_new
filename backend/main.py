"""
IPL Analytics – FastAPI Backend
================================
Run with:
  uvicorn backend.main:app --reload --port 8000

Interactive API docs at:
  http://localhost:8000/docs      (Swagger UI)
  http://localhost:8000/redoc     (ReDoc)
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import close_connection, get_connection
from backend.routers import analytics, matches, players


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm up the DB connection
    get_connection()
    yield
    # Shutdown: close gracefully
    close_connection()


app = FastAPI(
    title="IPL Analytics API",
    description=(
        "Production-grade REST API serving ball-by-ball IPL data "
        "from a local DuckDB analytical database."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow the Next.js dev server (port 3000) and any production origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(matches.router)
app.include_router(players.router)
app.include_router(analytics.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["Meta"])
def health():
    """Quick liveness check — also verifies the DB connection."""
    from backend.database import get_connection, query
    con = get_connection()
    counts = query(
        con,
        """
        SELECT
            (SELECT COUNT(*) FROM matches)    AS matches,
            (SELECT COUNT(*) FROM innings)    AS innings,
            (SELECT COUNT(*) FROM deliveries) AS deliveries,
            (SELECT COUNT(*) FROM players)    AS players
        """,
    )
    return {"status": "ok", "database": counts[0]}


@app.get("/api/meta/seasons", tags=["Meta"])
def all_seasons():
    """List of all IPL seasons available in the database."""
    from backend.database import get_connection, query
    con = get_connection()
    return query(
        con,
        "SELECT season FROM matches GROUP BY season ORDER BY MIN(date)",
    )


@app.get("/api/meta/teams", tags=["Meta"])
def all_teams():
    """List of all franchise names that appear in the database."""
    from backend.database import get_connection, query
    con = get_connection()
    return query(
        con,
        """
        SELECT DISTINCT team FROM (
            SELECT team1 AS team FROM matches
            UNION
            SELECT team2 AS team FROM matches
        ) ORDER BY team
        """,
    )
