"""Authentication router — register, login, logout, Google OAuth."""

import hashlib
import json
import os
import secrets
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..auth_db import get_auth_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
SESSION_EXPIRY_DAYS = 7


# ── Pydantic models ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# ── Password helpers ─────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hash_val = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 100000
    )
    return f"{salt}:{hash_val.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, hash_val = stored.split(":")
    new_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 100000
    )
    return new_hash.hex() == hash_val


# ── Session helpers ──────────────────────────────────────────────────

def _create_session(user_id: str) -> str:
    """Create a session token, clean expired sessions, return the token."""
    db = get_auth_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    # Clean up expired sessions
    db.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
    token = secrets.token_urlsafe(32)
    expires = (
        datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    ).strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires),
    )
    db.commit()
    return token


def _user_dict(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "avatar_url": row["avatar_url"],
    }


def _validate_email(email: str):
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")


# ── Dependency: get current user (optional) ──────────────────────────

def get_current_user(
    authorization: Optional[str] = Header(None),
) -> Optional[dict]:
    """Extract and validate session token from Authorization header.

    Returns user dict or None if not authenticated.
    """
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1]
    db = get_auth_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    row = db.execute(
        """
        SELECT u.id, u.name, u.email, u.avatar_url
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
        """,
        (token, now),
    ).fetchone()
    if not row:
        return None
    return _user_dict(row)


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest):
    _validate_email(body.email)
    if len(body.password) < 6:
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters"
        )
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    db = get_auth_db()
    existing = db.execute(
        "SELECT id FROM users WHERE email = ?", (body.email.lower(),)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid4())
    pw_hash = hash_password(body.password)
    db.execute(
        """
        INSERT INTO users (id, email, name, password_hash, auth_provider, is_verified)
        VALUES (?, ?, ?, ?, 'email', 0)
        """,
        (user_id, body.email.lower(), body.name.strip(), pw_hash),
    )
    db.commit()

    token = _create_session(user_id)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": body.name.strip(),
            "email": body.email.lower(),
            "avatar_url": None,
        },
    }


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    db = get_auth_db()
    row = db.execute(
        "SELECT * FROM users WHERE email = ?", (body.email.lower(),)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not row["password_hash"]:
        raise HTTPException(
            status_code=401,
            detail="This account uses Google sign-in. Please log in with Google.",
        )
    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_session(row["id"])
    return {"token": token, "user": _user_dict(row)}


@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = parts[1]
    db = get_auth_db()
    db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    db.commit()
    return {"detail": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.get("/admin/users")
def admin_list_users(authorization: Optional[str] = Header(None)):
    """List all registered users. Only accessible to the first registered user (admin)."""
    current = get_current_user(authorization)
    if not current:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_auth_db()
    # The first user (earliest created_at) is the admin
    first_user = db.execute(
        "SELECT id FROM users ORDER BY created_at ASC LIMIT 1"
    ).fetchone()
    if not first_user or first_user["id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Admin access only")

    rows = db.execute(
        """
        SELECT id, email, name, auth_provider, avatar_url, is_verified,
               created_at, updated_at,
               (SELECT COUNT(*) FROM sessions s WHERE s.user_id = users.id
                AND s.expires_at > datetime('now')) as active_sessions
        FROM users ORDER BY created_at DESC
        """
    ).fetchall()

    return [
        {
            "id": r["id"],
            "email": r["email"],
            "name": r["name"],
            "auth_provider": r["auth_provider"],
            "avatar_url": r["avatar_url"],
            "is_verified": bool(r["is_verified"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "active_sessions": r["active_sessions"],
        }
        for r in rows
    ]


@router.get("/admin/stats")
def admin_stats(authorization: Optional[str] = Header(None)):
    """Quick platform stats. Admin only."""
    current = get_current_user(authorization)
    if not current:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_auth_db()
    first_user = db.execute(
        "SELECT id FROM users ORDER BY created_at ASC LIMIT 1"
    ).fetchone()
    if not first_user or first_user["id"] != current["id"]:
        raise HTTPException(status_code=403, detail="Admin access only")

    total = db.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    google_users = db.execute(
        "SELECT COUNT(*) as c FROM users WHERE auth_provider = 'google'"
    ).fetchone()["c"]
    email_users = db.execute(
        "SELECT COUNT(*) as c FROM users WHERE auth_provider = 'email'"
    ).fetchone()["c"]
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    active_sessions = db.execute(
        "SELECT COUNT(*) as c FROM sessions WHERE expires_at > ?", (now,)
    ).fetchone()["c"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_signups = db.execute(
        "SELECT COUNT(*) as c FROM users WHERE created_at >= ?", (today,)
    ).fetchone()["c"]

    return {
        "total_users": total,
        "google_users": google_users,
        "email_users": email_users,
        "active_sessions": active_sessions,
        "today_signups": today_signups,
    }


@router.post("/google", response_model=AuthResponse)
def google_login(body: GoogleLoginRequest):
    """Verify a Google ID token and create/login the user."""
    # Call Google's tokeninfo endpoint to verify the token
    url = (
        f"https://oauth2.googleapis.com/tokeninfo?id_token={body.credential}"
    )
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        raise HTTPException(
            status_code=401, detail="Invalid Google credential"
        )

    # Verify audience matches our client ID (if configured)
    if GOOGLE_CLIENT_ID and data.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=401, detail="Google token audience mismatch"
        )

    google_id = data.get("sub")
    email = data.get("email", "").lower()
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")

    if not email:
        raise HTTPException(
            status_code=401, detail="Google account has no email"
        )

    db = get_auth_db()

    # Check if user exists by google_id or email
    row = db.execute(
        "SELECT * FROM users WHERE google_id = ? OR email = ?",
        (google_id, email),
    ).fetchone()

    if row:
        # Update google_id / avatar if needed
        user_id = row["id"]
        db.execute(
            """
            UPDATE users
            SET google_id = ?, avatar_url = COALESCE(?, avatar_url),
                updated_at = datetime('now')
            WHERE id = ?
            """,
            (google_id, picture, user_id),
        )
        db.commit()
    else:
        # Create new user
        user_id = str(uuid4())
        db.execute(
            """
            INSERT INTO users (id, email, name, auth_provider, google_id,
                               avatar_url, is_verified)
            VALUES (?, ?, ?, 'google', ?, ?, 1)
            """,
            (user_id, email, name, google_id, picture),
        )
        db.commit()

    # Fetch fresh user data
    user_row = db.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    token = _create_session(user_id)
    return {"token": token, "user": _user_dict(user_row)}
