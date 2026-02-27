"""
routers/payments.py
===================
Paystack payment integration.
- POST /payments/initialize  — creates a Paystack transaction
- GET  /payments/verify      — verifies payment and updates subscription
- POST /payments/webhook     — Paystack webhook for subscription events
"""

import os
import hmac
import hashlib
import json
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from jose import jwt, JWTError

SUPABASE_JWT_SECRET_KEY = os.getenv("SUPABASE_JWT_SECRET", "eeVjr4TPk3WzjvLwrXQF5hwTAgHrPeqjNSLqTU9quWcYpnJegwNB3uyrflKRrlNoJtfCSPe8tBUE+TexJLBY9w==")

def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        return jwt.decode(token, SUPABASE_JWT_SECRET_KEY, algorithms=["HS256"], options={"verify_aud": False})
    except JWTError:
        return None

router = APIRouter(prefix="/payments", tags=["payments"])

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE       = "https://api.paystack.co"
PLAN_AMOUNT         = 1000000  # ₦10,000 in kobo
SUPABASE_URL        = "https://lisyiprowqxybfttenud.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


async def _supabase_upsert_subscription(user_id: str, data: dict):
    """Upsert subscription record in Supabase using service role key."""
    async with httpx.AsyncClient() as client:
        # Check if subscription exists
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/subscriptions",
            params={"user_id": f"eq.{user_id}"},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            }
        )
        existing = res.json()

        if existing:
            # Update
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/subscriptions",
                params={"user_id": f"eq.{user_id}"},
                json={**data, "updated_at": datetime.now(timezone.utc).isoformat()},
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                }
            )
        else:
            # Insert
            await client.post(
                f"{SUPABASE_URL}/rest/v1/subscriptions",
                json={"user_id": user_id, **data},
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                }
            )


@router.post("/initialize")
async def initialize_payment(request: Request):
    """Initialize a Paystack transaction for the current user."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    email    = user.get("email", "")
    user_id  = user.get("sub", "")
    callback = "https://eure-mlytics.vercel.app?payment=verify"

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{PAYSTACK_BASE}/transaction/initialize",
            json={
                "email":        email,
                "amount":       PLAN_AMOUNT,
                "currency":     "NGN",
                "callback_url": callback,
                "metadata": {
                    "user_id":     user_id,
                    "plan":        "pro_monthly",
                    "cancel_action": "https://eure-mlytics.vercel.app",
                },
                "channels": ["card", "bank", "ussd", "bank_transfer"],
            },
            headers={
                "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                "Content-Type":  "application/json",
            }
        )

    data = res.json()
    if not data.get("status"):
        raise HTTPException(status_code=400, detail=data.get("message", "Payment initialization failed"))

    return {
        "authorization_url": data["data"]["authorization_url"],
        "reference":         data["data"]["reference"],
    }


@router.get("/verify")
async def verify_payment(request: Request, reference: str = Query(...)):
    """Verify a Paystack payment and activate subscription."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{PAYSTACK_BASE}/transaction/verify/{reference}",
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
        )

    data = res.json()
    if not data.get("status"):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    tx = data["data"]
    if tx["status"] != "success":
        raise HTTPException(status_code=400, detail=f"Payment not successful: {tx['status']}")

    # Activate subscription for 30 days
    user_id    = user.get("sub", "")
    period_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    await _supabase_upsert_subscription(user_id, {
        "status":              "active",
        "current_period_end":  period_end,
        "paystack_customer_code": tx.get("customer", {}).get("customer_code", ""),
    })

    return {"status": "active", "current_period_end": period_end}


@router.get("/subscription")
async def get_subscription(request: Request):
    """Get current user's subscription status."""
    user = get_current_user(request)
    if not user:
        return {"status": "free"}

    user_id = user.get("sub", "")

    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/subscriptions",
            params={"user_id": f"eq.{user_id}", "select": "status,current_period_end"},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            }
        )

    rows = res.json()
    if not rows:
        return {"status": "free"}

    sub = rows[0]
    # Check if subscription has expired
    if sub["status"] == "active" and sub.get("current_period_end"):
        period_end = datetime.fromisoformat(sub["current_period_end"])
        if period_end < datetime.now(timezone.utc):
            # Expired — update to free
            await _supabase_upsert_subscription(user_id, {"status": "free"})
            return {"status": "free"}

    return {"status": sub["status"], "current_period_end": sub.get("current_period_end")}


@router.post("/webhook")
async def paystack_webhook(request: Request):
    """Handle Paystack webhook events."""
    body      = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    # Verify webhook signature
    expected = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        body,
        hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event = json.loads(body)
    etype = event.get("event", "")
    data  = event.get("data", {})

    if etype == "charge.success":
        metadata = data.get("metadata", {})
        user_id  = metadata.get("user_id", "")
        if user_id:
            period_end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            await _supabase_upsert_subscription(user_id, {
                "status":             "active",
                "current_period_end": period_end,
            })

    return JSONResponse({"status": "ok"})
