"""Billing router — usage tracking, plan info, quota checking, Razorpay integration."""

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from ..auth_db import get_auth_db
from .auth import get_current_user, _is_admin

# ── Razorpay Setup ───────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "").strip()
RAZORPAY_PRO_PLAN_ID = os.getenv("RAZORPAY_PRO_PLAN_ID", "").strip()
RAZORPAY_ULTIMATE_PLAN_ID = os.getenv("RAZORPAY_ULTIMATE_PLAN_ID", "").strip()

razorpay_client = None
RAZORPAY_AVAILABLE = False

try:
    import razorpay
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        RAZORPAY_AVAILABLE = True
except ImportError:
    pass

PLAN_TO_RAZORPAY_ID = {
    "pro": RAZORPAY_PRO_PLAN_ID,
    "ultimate": RAZORPAY_ULTIMATE_PLAN_ID,
}
RAZORPAY_ID_TO_PLAN = {v: k for k, v in PLAN_TO_RAZORPAY_ID.items() if v}

router = APIRouter(prefix="/api/billing", tags=["billing"])

# ── Plan definitions ─────────────────────────────────────────────────
PLANS = {
    "free": {
        "name": "Free",
        "limits": {
            "ai_query": 5,       # Ask Cricket queries per day
            "ai_caption": 3,     # AI captions per day
            "ai_image": 0,       # AI infographics per day
            "ai_thread": 2,      # Thread generation per day
        },
    },
    "pro": {
        "name": "Pro",
        "price": 299,  # INR/month
        "limits": {
            "ai_query": 50,
            "ai_caption": 30,
            "ai_image": 10,
            "ai_thread": 20,
        },
    },
    "ultimate": {
        "name": "Ultimate",
        "price": 599,  # INR/month
        "limits": {
            "ai_query": -1,     # -1 = unlimited
            "ai_caption": -1,
            "ai_image": 50,
            "ai_thread": -1,
        },
    },
}

FEATURE_LABELS = {
    "ai_query": "AI Queries",
    "ai_caption": "AI Captions",
    "ai_image": "AI Infographics",
    "ai_thread": "AI Threads",
}


# ── Helpers ──────────────────────────────────────────────────────────

def get_user_plan(user_id: str) -> str:
    """Get the user's current plan, checking expiry."""
    db = get_auth_db()
    row = db.execute(
        "SELECT plan, plan_expires FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    if not row:
        return "free"
    plan = row["plan"] or "free"
    expires = row["plan_expires"]
    if plan != "free" and expires:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        if expires < now:
            # Plan expired, revert to free
            db.execute(
                "UPDATE users SET plan = 'free', plan_expires = NULL WHERE id = ?",
                (user_id,),
            )
            db.commit()
            return "free"
    return plan


def get_today_usage(user_id: str, feature: str) -> int:
    """Count how many times a user has used a feature today."""
    db = get_auth_db()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = db.execute(
        "SELECT COUNT(*) as cnt FROM usage WHERE user_id = ? AND feature = ? AND used_at >= ?",
        (user_id, feature, today),
    ).fetchone()
    return row["cnt"] if row else 0


def record_usage(user_id: str, feature: str):
    """Record a usage event."""
    db = get_auth_db()
    db.execute(
        "INSERT INTO usage (user_id, feature) VALUES (?, ?)",
        (user_id, feature),
    )
    db.commit()


def check_quota(user_id: str, feature: str) -> dict:
    """Check if user can use a feature. Returns {allowed, used, limit, plan}."""
    plan_name = get_user_plan(user_id)
    plan = PLANS.get(plan_name, PLANS["free"])
    limit = plan["limits"].get(feature, 0)
    used = get_today_usage(user_id, feature)

    if limit == -1:
        return {"allowed": True, "used": used, "limit": -1, "plan": plan_name}
    if limit == 0:
        return {"allowed": False, "used": used, "limit": 0, "plan": plan_name}

    return {
        "allowed": used < limit,
        "used": used,
        "limit": limit,
        "plan": plan_name,
    }


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/plans")
def list_plans():
    """Return all available plans with their limits."""
    return {"plans": PLANS, "feature_labels": FEATURE_LABELS}


@router.get("/usage")
def get_usage(authorization: Optional[str] = Header(None)):
    """Get current user's usage summary for today."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")

    plan_name = get_user_plan(user["id"])
    plan = PLANS.get(plan_name, PLANS["free"])

    usage_summary = {}
    for feature, limit in plan["limits"].items():
        used = get_today_usage(user["id"], feature)
        usage_summary[feature] = {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used) if limit >= 0 else -1,
            "label": FEATURE_LABELS.get(feature, feature),
        }

    return {
        "plan": plan_name,
        "plan_name": plan["name"],
        "usage": usage_summary,
    }


@router.get("/check/{feature}")
def check_feature_quota(feature: str, authorization: Optional[str] = Header(None)):
    """Check if a specific feature can be used."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")

    if feature not in FEATURE_LABELS:
        raise HTTPException(400, f"Unknown feature: {feature}")

    result = check_quota(user["id"], feature)
    result["feature_label"] = FEATURE_LABELS.get(feature, feature)
    return result


# ── Admin: set user plan ─────────────────────────────────────────────

class SetPlanRequest(BaseModel):
    user_id: str
    plan: str
    days: int = 30


@router.post("/admin/set-plan")
def admin_set_plan(body: SetPlanRequest, authorization: Optional[str] = Header(None)):
    """Admin: manually set a user's plan."""
    current = get_current_user(authorization)
    if not current:
        raise HTTPException(401, "Not authenticated")
    if not _is_admin(current):
        raise HTTPException(403, "Admin access only")

    if body.plan not in PLANS:
        raise HTTPException(400, f"Invalid plan: {body.plan}")

    db = get_auth_db()
    user = db.execute("SELECT id FROM users WHERE id = ?", (body.user_id,)).fetchone()
    if not user:
        raise HTTPException(404, "User not found")

    expires = None
    if body.plan != "free":
        expires = (
            datetime.now(timezone.utc) + timedelta(days=body.days)
        ).strftime("%Y-%m-%d %H:%M:%S")

    db.execute(
        "UPDATE users SET plan = ?, plan_expires = ? WHERE id = ?",
        (body.plan, expires, body.user_id),
    )
    db.commit()
    return {"detail": f"Plan set to {body.plan} for user {body.user_id}"}


# ── Razorpay endpoints ───────────────────────────────────────────────

@router.get("/payment-status")
def payment_status():
    """Check if Razorpay is configured."""
    return {
        "available": RAZORPAY_AVAILABLE,
        "key_id": RAZORPAY_KEY_ID if RAZORPAY_AVAILABLE else None,
        "has_pro_plan": bool(RAZORPAY_PRO_PLAN_ID),
        "has_ultimate_plan": bool(RAZORPAY_ULTIMATE_PLAN_ID),
    }


class SubscriptionRequest(BaseModel):
    plan: str


@router.post("/create-subscription")
def create_subscription(body: SubscriptionRequest, authorization: Optional[str] = Header(None)):
    """Create a Razorpay subscription for upgrading."""
    if not RAZORPAY_AVAILABLE:
        raise HTTPException(503, "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env")

    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")

    plan_id = PLAN_TO_RAZORPAY_ID.get(body.plan)
    if not plan_id:
        raise HTTPException(400, f"No Razorpay plan configured for: {body.plan}")

    db = get_auth_db()
    row = db.execute("SELECT email, name FROM users WHERE id = ?", (user["id"],)).fetchone()
    email = row["email"] if row else user.get("email", "")
    name = row["name"] if row else user.get("name", "")

    try:
        subscription = razorpay_client.subscription.create({
            "plan_id": plan_id,
            "total_count": 12,  # 12 months max billing cycles
            "quantity": 1,
            "notes": {
                "user_id": user["id"],
                "plan": body.plan,
                "email": email,
            },
        })

        return {
            "subscription_id": subscription["id"],
            "key_id": RAZORPAY_KEY_ID,
            "plan": body.plan,
            "amount": PLANS[body.plan]["price"] * 100,  # paise
            "currency": "INR",
            "name": "Crickrida",
            "description": f"Crickrida {body.plan.title()} Plan — Monthly",
            "prefill": {
                "name": name,
                "email": email,
            },
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to create subscription: {str(e)}")


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str
    plan: str


@router.post("/verify-payment")
def verify_payment(body: VerifyPaymentRequest, authorization: Optional[str] = Header(None)):
    """Verify Razorpay payment signature and activate plan."""
    if not RAZORPAY_AVAILABLE:
        raise HTTPException(503, "Razorpay not configured")

    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")

    # Verify signature: HMAC SHA256 of payment_id|subscription_id with key_secret
    generated_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{body.razorpay_payment_id}|{body.razorpay_subscription_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if generated_signature != body.razorpay_signature:
        raise HTTPException(400, "Payment verification failed — invalid signature")

    # Activate plan
    db = get_auth_db()
    expires = (
        datetime.now(timezone.utc) + timedelta(days=35)
    ).strftime("%Y-%m-%d %H:%M:%S")

    db.execute(
        "UPDATE users SET plan = ?, plan_expires = ?, stripe_customer_id = ? WHERE id = ?",
        (body.plan, expires, body.razorpay_subscription_id, user["id"]),
    )
    db.commit()

    return {
        "verified": True,
        "plan": body.plan,
        "detail": f"Plan upgraded to {body.plan.title()}!",
    }


@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook events for subscription lifecycle."""
    payload = await request.body()

    # Verify webhook signature if secret is configured
    if RAZORPAY_WEBHOOK_SECRET:
        sig_header = request.headers.get("x-razorpay-signature", "")
        expected = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        if expected != sig_header:
            raise HTTPException(400, "Invalid webhook signature")

    try:
        event = json.loads(payload)
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(400, "Invalid JSON payload")

    event_type = event.get("event", "")
    entity = event.get("payload", {}).get("subscription", {}).get("entity", {})

    db = get_auth_db()

    if event_type in ("subscription.activated", "subscription.charged"):
        _handle_razorpay_activated(entity, db)
    elif event_type in ("subscription.cancelled", "subscription.expired", "subscription.paused"):
        _handle_razorpay_cancelled(entity, db)

    return {"received": True}


def _handle_razorpay_activated(entity, db):
    """Activate plan when subscription is activated/charged."""
    sub_id = entity.get("id", "")
    notes = entity.get("notes", {})
    user_id = notes.get("user_id")
    plan = notes.get("plan", "pro")

    if not user_id:
        # Try to find user by stored subscription ID (stripe_customer_id column reused)
        row = db.execute(
            "SELECT id FROM users WHERE stripe_customer_id = ?", (sub_id,)
        ).fetchone()
        user_id = row["id"] if row else None

    if not user_id:
        return

    expires = (
        datetime.now(timezone.utc) + timedelta(days=35)
    ).strftime("%Y-%m-%d %H:%M:%S")

    db.execute(
        "UPDATE users SET plan = ?, plan_expires = ?, stripe_customer_id = ? WHERE id = ?",
        (plan, expires, sub_id, user_id),
    )
    db.commit()


def _handle_razorpay_cancelled(entity, db):
    """Revert to free when subscription is cancelled/expired."""
    sub_id = entity.get("id", "")
    if not sub_id:
        return

    db.execute(
        "UPDATE users SET plan = 'free', plan_expires = NULL WHERE stripe_customer_id = ?",
        (sub_id,),
    )
    db.commit()
