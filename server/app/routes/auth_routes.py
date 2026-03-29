"""
Agent Board — Auth routes.

POST /login   — validate username/password, create session, return token
POST /logout  — delete session
GET  /me      — return current admin info
POST /setup   — initial admin setup (only when no admin exists)
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
    get_current_admin,
    hash_password,
    sessions,
    verify_password,
)

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class SetupRequest(BaseModel):
    username: str
    password: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/login")
async def login(body: LoginRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, username, password_hash, role FROM admin_users WHERE username = ?",
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
async def me(current: dict = Depends(get_current_admin)):
    return {
        "id": current["admin_id"],
        "username": current["username"],
        "role": current["role"],
    }


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
        "INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, 'admin') RETURNING id, username, role",
        (body.username, pw_hash),
    )
    new_row = await cursor.fetchone()
    await db.commit()

    token = create_session(new_row["id"], new_row["username"], new_row["role"])
    return {
        "token": token,
        "admin": row_to_dict(new_row),
    }
