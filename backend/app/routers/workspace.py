"""
routers/workspace.py
====================
Team workspace management.
- POST /workspace/create          — create workspace (team owner)
- GET  /workspace/mine            — get current user's workspace
- POST /workspace/invite          — invite a member by email
- DELETE /workspace/member/{email} — remove a member
- GET  /workspace/members         — list all members
- POST /workspace/accept          — accept an invitation (called on login)
- GET  /workspace/history         — shared file history for workspace
- POST /workspace/history         — save a clean job to history
"""

import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/workspace", tags=["workspace"])

SUPABASE_URL         = "https://lisyiprowqxybfttenud.supabase.co"
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
RESEND_API_KEY       = os.getenv("RESEND_API_KEY", "")
FRONTEND_URL         = "https://eure-mlytics.vercel.app"
MAX_MEMBERS          = 5


# ─── Auth helpers (same pattern as payments.py) ───────────────

def _headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_SERVICE_KEY},
        )
    if r.status_code != 200:
        return None
    u = r.json()
    return {"id": u.get("id"), "email": u.get("email")}


# ─── Supabase helpers ─────────────────────────────────────────

async def _sb_get(path: str, params: dict = {}):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{SUPABASE_URL}/rest/v1/{path}", params=params, headers=_headers())
    return r.json()


async def _sb_post(path: str, data: dict):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/{path}",
            json=data,
            headers={**_headers(), "Prefer": "return=representation"},
        )
    return r.json()


async def _sb_patch(path: str, params: dict, data: dict):
    async with httpx.AsyncClient() as client:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/{path}",
            params=params,
            json=data,
            headers={**_headers(), "Prefer": "return=minimal"},
        )
    return r.status_code


async def _sb_delete(path: str, params: dict):
    async with httpx.AsyncClient() as client:
        r = await client.delete(
            f"{SUPABASE_URL}/rest/v1/{path}",
            params=params,
            headers=_headers(),
        )
    return r.status_code


# ─── Email helper ─────────────────────────────────────────────

def _send_invite_email(inviter_email: str, invitee_email: str, workspace_name: str):
    try:
        import resend  # lazy import — won't crash startup if missing
        resend.api_key = RESEND_API_KEY
        accept_url = f"{FRONTEND_URL}?workspace_invite=accept&email={invitee_email}"
        resend.Emails.send({
            "from": "Oxdemi <onboarding@resend.dev>",
            "to": [invitee_email],
            "subject": f"You've been invited to join {workspace_name} on Oxdemi",
            "html": f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
              <div style="background:#1a1a18;padding:1rem 1.5rem;border-radius:8px;margin-bottom:1.5rem">
                <span style="color:#fff;font-weight:700;font-size:1.1rem">OXD</span>
                <span style="color:#888;font-size:0.7rem;margin-left:0.5rem">BETA</span>
              </div>
              <h2 style="color:#1a1a18;margin-bottom:0.5rem">You're invited to a team workspace</h2>
              <p style="color:#555;margin-bottom:1.5rem">
                <strong>{inviter_email}</strong> has invited you to join the
                <strong>{workspace_name}</strong> workspace on Oxdemi — where your team cleans and manages data together.
              </p>
              <a href="{accept_url}" style="display:inline-block;background:#1a1a18;color:#fff;padding:0.75rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:600;margin-bottom:1.5rem">
                Accept Invitation →
              </a>
              <p style="color:#999;font-size:0.75rem">
                If you don't have an Oxdemi account yet, you'll be asked to create one first.
                The invitation link will work after sign-up.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0">
              <p style="color:#bbb;font-size:0.7rem">Oxdemi.io · Raw in. Clean out.</p>
            </div>
            """
        })
    except Exception as e:
        print(f"[workspace] invite email failed: {e}")


# ─── Request models ───────────────────────────────────────────

class CreateWorkspaceRequest(BaseModel):
    name: str

class InviteRequest(BaseModel):
    email: str

class HistoryEntry(BaseModel):
    session_id:    str
    filename:      str
    original_rows: int
    cleaned_rows:  int
    columns:       int
    avg_score:     float
    actions_taken: int


# ─── Endpoints ───────────────────────────────────────────────

@router.post("/create")
async def create_workspace(body: CreateWorkspaceRequest, request: Request):
    """Create a team workspace. User must have a team subscription."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Check they have a team subscription
    subs = await _sb_get("subscriptions", {"user_id": f"eq.{user['id']}", "select": "plan,status"})
    if not subs or subs[0].get("status") != "active" or subs[0].get("plan") != "team":
        raise HTTPException(status_code=403, detail="Team subscription required to create a workspace.")

    # Check they don't already own one
    existing = await _sb_get("workspaces", {"owner_id": f"eq.{user['id']}"})
    if existing:
        return existing[0]

    name = body.name.strip()[:60] or f"{user['email'].split('@')[0]}'s Workspace"

    # Create workspace
    ws = await _sb_post("workspaces", {"name": name, "owner_id": user["id"]})
    workspace_id = ws[0]["id"]

    # Add owner as first member
    await _sb_post("workspace_members", {
        "workspace_id": workspace_id,
        "user_id":      user["id"],
        "email":        user["email"],
        "role":         "owner",
        "status":       "active",
        "joined_at":    datetime.now(timezone.utc).isoformat(),
    })

    # Link subscription to workspace
    await _sb_patch("subscriptions", {"user_id": f"eq.{user['id']}"}, {"workspace_id": workspace_id})

    return ws[0]


@router.get("/mine")
async def get_my_workspace(request: Request):
    """Get the workspace the current user belongs to (as owner or member)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Check if member of any workspace
    memberships = await _sb_get("workspace_members", {
        "user_id": f"eq.{user['id']}",
        "status":  "eq.active",
        "select":  "workspace_id,role",
    })
    if not memberships:
        return {"workspace": None}

    workspace_id = memberships[0]["workspace_id"]
    role         = memberships[0]["role"]

    workspaces = await _sb_get("workspaces", {"id": f"eq.{workspace_id}"})
    if not workspaces:
        return {"workspace": None}

    return {"workspace": workspaces[0], "role": role}


@router.get("/members")
async def list_members(request: Request):
    """List all members of the current user's workspace."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    memberships = await _sb_get("workspace_members", {
        "user_id": f"eq.{user['id']}",
        "status":  "eq.active",
        "select":  "workspace_id,role",
    })
    if not memberships:
        raise HTTPException(status_code=404, detail="No workspace found.")

    workspace_id = memberships[0]["workspace_id"]

    members = await _sb_get("workspace_members", {
        "workspace_id": f"eq.{workspace_id}",
        "select":       "id,email,role,status,invited_at,joined_at",
        "order":        "invited_at.asc",
    })
    return {"members": members, "max": MAX_MEMBERS}


@router.post("/invite")
async def invite_member(body: InviteRequest, request: Request):
    """Invite a member to the workspace. Owner only."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Must be owner
    membership = await _sb_get("workspace_members", {
        "user_id": f"eq.{user['id']}",
        "role":    "eq.owner",
        "status":  "eq.active",
        "select":  "workspace_id",
    })
    if not membership:
        raise HTTPException(status_code=403, detail="Only the workspace owner can invite members.")

    workspace_id = membership[0]["workspace_id"]

    # Check workspace details
    ws = await _sb_get("workspaces", {"id": f"eq.{workspace_id}"})
    workspace_name = ws[0]["name"] if ws else "your team"

    # Count current members
    all_members = await _sb_get("workspace_members", {
        "workspace_id": f"eq.{workspace_id}",
        "select":       "id,status",
    })
    active_count = sum(1 for m in all_members if m["status"] == "active")

    if active_count >= MAX_MEMBERS:
        raise HTTPException(
            status_code=400,
            detail=f"Workspace is full. Maximum {MAX_MEMBERS} members allowed."
        )

    invite_email = body.email.strip().lower()

    # Check not already a member
    already = [m for m in all_members if m.get("email", "").lower() == invite_email]
    if already:
        raise HTTPException(status_code=400, detail="This email is already a member or has a pending invitation.")

    # Can't invite yourself
    if invite_email == user["email"].lower():
        raise HTTPException(status_code=400, detail="You can't invite yourself.")

    # Check if the invitee already has an account — link user_id if so
    auth_users = await _sb_get("users", {"email": f"eq.{invite_email}", "select": "id"})  # won't work via REST
    # We'll link user_id when they accept instead

    # Create pending membership
    await _sb_post("workspace_members", {
        "workspace_id": workspace_id,
        "email":        invite_email,
        "role":         "member",
        "status":       "pending",
    })

    # Send invite email
    _send_invite_email(user["email"], invite_email, workspace_name)

    return {"status": "invited", "email": invite_email}


@router.post("/accept")
async def accept_invite(request: Request):
    """
    Called automatically on login/signup if the user's email
    has a pending workspace invitation.
    Links their user_id to the pending membership row.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    email = user["email"].strip().lower()

    # Find pending invite for this email
    pending = await _sb_get("workspace_members", {
        "email":  f"eq.{email}",
        "status": "eq.pending",
        "select": "id,workspace_id",
    })
    if not pending:
        return {"status": "no_invite"}

    member_id    = pending[0]["id"]
    workspace_id = pending[0]["workspace_id"]

    # Activate membership
    await _sb_patch(
        "workspace_members",
        {"id": f"eq.{member_id}"},
        {
            "user_id":   user["id"],
            "status":    "active",
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"status": "accepted", "workspace_id": workspace_id}


@router.delete("/member/{email}")
async def remove_member(email: str, request: Request):
    """Remove a member from the workspace. Owner only."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Must be owner
    membership = await _sb_get("workspace_members", {
        "user_id": f"eq.{user['id']}",
        "role":    "eq.owner",
        "status":  "eq.active",
        "select":  "workspace_id",
    })
    if not membership:
        raise HTTPException(status_code=403, detail="Only the workspace owner can remove members.")

    workspace_id  = membership[0]["workspace_id"]
    target_email  = email.strip().lower()

    # Can't remove yourself (owner)
    if target_email == user["email"].lower():
        raise HTTPException(status_code=400, detail="You can't remove yourself as owner.")

    await _sb_delete("workspace_members", {
        "workspace_id": f"eq.{workspace_id}",
        "email":        f"eq.{target_email}",
    })

    return {"status": "removed", "email": target_email}


@router.post("/history")
async def save_history(body: HistoryEntry, request: Request):
    """Save a clean job to file history."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Get workspace_id if member of one
    memberships = await _sb_get("workspace_members", {
        "user_id": f"eq.{user['id']}",
        "status":  "eq.active",
        "select":  "workspace_id",
    })
    workspace_id = memberships[0]["workspace_id"] if memberships else None

    await _sb_post("file_history", {
        "user_id":      user["id"],
        "workspace_id": workspace_id,
        "session_id":   body.session_id,
        "filename":     body.filename,
        "original_rows":body.original_rows,
        "cleaned_rows": body.cleaned_rows,
        "columns":      body.columns,
        "avg_score":    body.avg_score,
        "actions_taken":body.actions_taken,
    })

    return {"status": "saved"}


@router.get("/history")
async def get_history(request: Request):
    """
    Get file history.
    - Team members: see all files cleaned in the workspace
    - Solo users: see their own files only
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Check workspace membership
    memberships = await _sb_get("workspace_members", {
        "user_id": f"eq.{user['id']}",
        "status":  "eq.active",
        "select":  "workspace_id",
    })

    if memberships:
        workspace_id = memberships[0]["workspace_id"]
        history = await _sb_get("file_history", {
            "workspace_id": f"eq.{workspace_id}",
            "select":       "id,user_id,session_id,filename,original_rows,cleaned_rows,columns,avg_score,actions_taken,created_at",
            "order":        "created_at.desc",
            "limit":        "50",
        })
    else:
        history = await _sb_get("file_history", {
            "user_id": f"eq.{user['id']}",
            "select":  "id,session_id,filename,original_rows,cleaned_rows,columns,avg_score,actions_taken,created_at",
            "order":   "created_at.desc",
            "limit":   "10",
        })

    return {"history": history}
