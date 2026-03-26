"""SQLite database for user authentication and sessions."""

import os
import sqlite3
import threading

# Use AUTH_DB_PATH env var if set (e.g. Railway volume), else store inside backend dir
_default_path = os.path.join(os.path.dirname(__file__), "data", "users.db")
AUTH_DB_PATH = os.environ.get("AUTH_DB_PATH", _default_path)
_local = threading.local()


def get_auth_db() -> sqlite3.Connection:
    """Return a thread-local SQLite connection for the auth database."""
    if not hasattr(_local, "auth_conn") or _local.auth_conn is None:
        os.makedirs(os.path.dirname(AUTH_DB_PATH), exist_ok=True)
        _local.auth_conn = sqlite3.connect(AUTH_DB_PATH)
        _local.auth_conn.row_factory = sqlite3.Row
    return _local.auth_conn


def init_auth_db():
    """Create auth tables if they don't exist."""
    os.makedirs(os.path.dirname(AUTH_DB_PATH), exist_ok=True)
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
    # Add last_login column if it doesn't exist (migration-safe)
    try:
        conn.execute("ALTER TABLE users ADD COLUMN last_login TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    # Add login_count column if it doesn't exist
    try:
        conn.execute("ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    # Billing columns
    for col, defn in [
        ("plan", "TEXT DEFAULT 'free'"),
        ("plan_expires", "TEXT"),
        ("stripe_customer_id", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {defn}")
        except sqlite3.OperationalError:
            pass
    # Usage tracking table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            feature TEXT NOT NULL,
            used_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()
