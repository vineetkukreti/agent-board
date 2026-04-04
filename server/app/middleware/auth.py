"""
Agent Board — FastAPI authentication dependencies.

Two auth paths:
  1. Agent auth  — Authorization: Bearer <api_key>
                   Validated by hashing with SHA-256 and looking up
                   agents.api_key_hash in the database.
  2. Admin auth  — Authorization: Bearer <session_token>
                   Validated against the in-memory session store.

Both use the standard Authorization header so a single require_auth
dependency can accept either credential type.
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Any

import aiosqlite
import bcrypt
from fastapi import Depends, HTTPException, Request, status

from app.database import get_db

# ---------------------------------------------------------------------------
# In-memory session store
# sessions[token] = {"admin_id": int, "username": str, "role": str}
# ---------------------------------------------------------------------------

sessions: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Helpers — hashing & key generation
# ---------------------------------------------------------------------------


def hash_api_key(key: str) -> str:
    """Return the hex-encoded SHA-256 digest of *key*."""
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> str:
    """Return a URL-safe random 32-byte API key (43 base64url chars)."""
    return secrets.token_urlsafe(32)


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain* suitable for storing in admin_users."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored bcrypt *hashed* password."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Helpers — session management
# ---------------------------------------------------------------------------


def create_session(admin_id: int, username: str, role: str = "admin") -> str:
    """Create a new admin session token, store it, and return the token."""
    token = secrets.token_urlsafe(32)
    sessions[token] = {"admin_id": admin_id, "username": username, "role": role}
    return token


def delete_session(token: str) -> None:
    """Invalidate a session token (logout)."""
    sessions.pop(token, None)


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------


def _extract_bearer(request: Request) -> str | None:
    """Pull the raw token/key out of the Authorization header, or return None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    value = auth_header[len("Bearer "):].strip()
    return value if value else None


# ---------------------------------------------------------------------------
# FastAPI auth dependencies
# ---------------------------------------------------------------------------


async def get_current_agent(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),
) -> aiosqlite.Row:
    """Validate an agent API key and return the full agents row.

    Reads ``Authorization: Bearer <api_key>``, hashes with SHA-256, and
    looks up the matching row in the agents table.

    Raises:
        401 if the header is missing, malformed, or the key is unknown.
    """
    raw_key = _extract_bearer(request)
    if raw_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected: Bearer <api_key>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    key_hash = hash_api_key(raw_key)
    cursor = await db.execute(
        "SELECT * FROM agents WHERE api_key_hash = ? LIMIT 1",
        (key_hash,),
    )
    agent = await cursor.fetchone()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return agent


async def get_current_admin(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),  # noqa: ARG001 — kept for DI symmetry
) -> dict[str, Any]:
    """Validate an admin session token and return the session payload dict.

    Reads ``Authorization: Bearer <token>`` and validates against the
    in-memory session store.

    Raises:
        401 if the token is missing or not found in the session store.
    """
    token = _extract_bearer(request)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session = sessions.get(token)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return session


async def require_auth(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),
) -> aiosqlite.Row | dict[str, Any]:
    """Accept either a valid agent API key or a valid admin session token.

    Tries agent auth first (one DB lookup), then falls back to the
    in-memory session store.  Raises 401 only if both fail.

    Returns:
        An ``aiosqlite.Row`` for agent auth or a session ``dict`` for admin
        auth. Callers that need to distinguish the two can check
        ``isinstance(result, dict)``.
    """
    raw_key = _extract_bearer(request)
    if raw_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected: Bearer <key_or_token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Try agent API key (DB lookup)
    key_hash = hash_api_key(raw_key)
    cursor = await db.execute(
        "SELECT * FROM agents WHERE api_key_hash = ? LIMIT 1",
        (key_hash,),
    )
    agent = await cursor.fetchone()
    if agent is not None:
        return agent

    # 2. Try admin session token (in-memory)
    session = sessions.get(raw_key)
    if session is not None:
        return session

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials — API key or session token not recognised.",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ---------------------------------------------------------------------------
# Role-based access helpers
# ---------------------------------------------------------------------------


def require_role(*allowed_roles: str):
    """Return a dependency that enforces the admin session has one of the
    allowed roles.  Must be used after ``get_current_admin``.

    Usage::

        @router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
        async def admin_only(...): ...
    """

    async def _check(current: dict = Depends(get_current_admin)):
        if current.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(allowed_roles)}. You have: {current.get('role')}",
            )
        return current

    return _check


async def require_admin(current: dict = Depends(get_current_admin)) -> dict:
    """Convenience dependency: admin-only access."""
    if current.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current


async def require_write(current: dict = Depends(get_current_admin)) -> dict:
    """Convenience dependency: admin or lead (non-viewer) access."""
    if current.get("role") not in ("admin", "lead"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Write access required. Viewers have read-only access.",
        )
    return current
