"""
Agent Board — Auth routes.

POST /login   — validate username/password, create session, return token
POST /logout  — delete session
GET  /me      — return current admin info
POST /setup   — initial admin setup (only when no admin exists)

User management (admin only):
GET    /users      — list all users
POST   /users      — create a new user
PUT    /users/{id} — update a user
DELETE /users/{id} — delete a user
"""

from __future__ import annotations

from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

import aiosqlite
from app.database import get_db
from app.middleware.auth import (
    create_session,
    delete_session,
    delete_sessions_for_user,
    get_current_admin,
    hash_password,
    require_admin,
    update_sessions_for_user,
    verify_password,
)

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)

VALID_ROLES = ("admin", "lead", "viewer")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class SetupRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"
    display_name: str | None = None
    email: str | None = None
    team_id: int | None = None


class UpdateUserRequest(BaseModel):
    username: str | None = None
    password: str | None = None
    role: str | None = None
    display_name: str | None = None
    email: str | None = None
    team_id: int | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


def _user_response(row) -> dict:
    """Build a safe user dict (no password_hash)."""
    d = dict(row)
    d.pop("password_hash", None)
    return d


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/login")
async def login(body: LoginRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, username, password_hash, role, display_name FROM admin_users WHERE username = ?",
        (body.username,),
    )
    row = await cursor.fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_session(row["id"], row["username"], row["role"])
    return {
        "token": token,
        "admin": {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
            "display_name": row["display_name"],
        },
    }


@router.post("/logout")
async def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
):
    if credentials:
        delete_session(credentials.credentials)
    return {"ok": True}


@router.get("/me")
async def me(
    current: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id, username, role, display_name, email, team_id FROM admin_users WHERE id = ?",
        (current["admin_id"],),
    )
    row = await cursor.fetchone()
    if row is None:
        return {
            "id": current["admin_id"],
            "username": current["username"],
            "role": current["role"],
        }
    return dict(row)


@router.post("/setup", status_code=status.HTTP_201_CREATED)
async def setup(body: SetupRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM admin_users")
    row = await cursor.fetchone()
    if row and row["cnt"] > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Admin already exists. Use /login instead.",
        )

    pw_hash = hash_password(body.password)
    cursor = await db.execute(
        "INSERT INTO admin_users (username, password_hash, role, display_name) "
        "VALUES (?, ?, 'admin', ?) RETURNING id, username, role, display_name",
        (body.username, pw_hash, body.username),
    )
    new_row = await cursor.fetchone()
    await db.commit()

    token = create_session(new_row["id"], new_row["username"], new_row["role"])
    return {
        "token": token,
        "admin": row_to_dict(new_row),
    }


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------


@router.get("/users")
async def list_users(
    current: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id, username, role, display_name, email, team_id, created_at "
        "FROM admin_users ORDER BY created_at"
    )
    rows = await cursor.fetchall()
    return {"data": [dict(r) for r in rows]}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    current: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}",
        )

    # Check for duplicate username
    cursor = await db.execute(
        "SELECT id FROM admin_users WHERE username = ?", (body.username,)
    )
    if await cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{body.username}' already exists.",
        )

    pw_hash = hash_password(body.password)
    cursor = await db.execute(
        "INSERT INTO admin_users (username, password_hash, role, display_name, email, team_id) "
        "VALUES (?, ?, ?, ?, ?, ?) "
        "RETURNING id, username, role, display_name, email, team_id, created_at",
        (body.username, pw_hash, body.role, body.display_name, body.email, body.team_id),
    )
    new_row = await cursor.fetchone()
    await db.commit()
    return dict(new_row)


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    current: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    # Verify user exists
    cursor = await db.execute("SELECT * FROM admin_users WHERE id = ?", (user_id,))
    existing = await cursor.fetchone()
    if existing is None:
        raise HTTPException(status_code=404, detail="User not found.")

    if body.role is not None and body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}",
        )

    # Check username uniqueness if changing
    if body.username is not None and body.username != existing["username"]:
        cursor = await db.execute(
            "SELECT id FROM admin_users WHERE username = ? AND id != ?",
            (body.username, user_id),
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{body.username}' already exists.",
            )

    # Build SET clause dynamically
    updates = {}
    if body.username is not None:
        updates["username"] = body.username
    if body.password is not None:
        updates["password_hash"] = hash_password(body.password)
    if body.role is not None:
        updates["role"] = body.role
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.email is not None:
        updates["email"] = body.email
    if body.team_id is not None:
        updates["team_id"] = body.team_id

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [user_id]
    await db.execute(
        f"UPDATE admin_users SET {set_clause} WHERE id = ?", values
    )
    await db.commit()

    # Refresh active sessions for this user if role changed
    if body.role is not None or body.username is not None:
        update_sessions_for_user(user_id, username=body.username, role=body.role)

    cursor = await db.execute(
        "SELECT id, username, role, display_name, email, team_id, created_at "
        "FROM admin_users WHERE id = ?",
        (user_id,),
    )
    row = await cursor.fetchone()
    return dict(row)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current: dict = Depends(require_admin),
    db: aiosqlite.Connection = Depends(get_db),
):
    if current["admin_id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account.",
        )

    cursor = await db.execute("SELECT id FROM admin_users WHERE id = ?", (user_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="User not found.")

    await db.execute("DELETE FROM admin_users WHERE id = ?", (user_id,))
    await db.commit()

    # Invalidate any sessions for the deleted user
    delete_sessions_for_user(user_id)

    return {"ok": True}
