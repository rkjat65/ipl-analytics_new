"""SQLite database for user authentication and sessions."""

import os
import sqlite3
import threading

AUTH_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "users.db")
_local = threading.local()


def get_auth_db() -> sqlite3.Connection:
    """Return a thread-local SQLite connection for the auth database."""
    if not hasattr(_local, "auth_conn") or _local.auth_conn is None:
        _local.auth_conn = sqlite3.connect(AUTH_DB_PATH)
        _local.auth_conn.row_factory = sqlite3.Row
    return _local.auth_conn


def init_auth_db():
    """Create auth tables if they don't exist."""
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT,
            auth_provider TEXT DEFAULT 'email',
            google_id TEXT UNIQUE,
            avatar_url TEXT,
            is_verified INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()
