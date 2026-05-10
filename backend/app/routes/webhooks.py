"""
Webhook management API — CRUD for webhook subscriptions + delivery history.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import require_auth

router = APIRouter()


class WebhookCreate(BaseModel):
    url: str
    secret: Optional[str] = None
    events: list[str] = ["*"]
    description: Optional[str] = None


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    secret: Optional[str] = None
    events: Optional[list[str]] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


@router.get("/")
async def list_webhooks(
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        "SELECT id, url, events, is_active, description, created_at, updated_at FROM webhooks ORDER BY created_at DESC"
    )
    rows = await cursor.fetchall()
    return {"data": [dict(r) for r in rows]}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: WebhookCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cursor = await db.execute(
        """INSERT INTO webhooks (url, secret, events, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (body.url, body.secret, json.dumps(body.events), body.description, now, now),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "url": body.url, "events": body.events}


@router.put("/{webhook_id}")
async def update_webhook(
    webhook_id: int,
    body: WebhookUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute("SELECT id FROM webhooks WHERE id = ?", (webhook_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Webhook not found")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    updates = []
    params = []
    if body.url is not None:
        updates.append("url = ?")
        params.append(body.url)
    if body.secret is not None:
        updates.append("secret = ?")
        params.append(body.secret)
    if body.events is not None:
        updates.append("events = ?")
        params.append(json.dumps(body.events))
    if body.is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if body.is_active else 0)
    if body.description is not None:
        updates.append("description = ?")
        params.append(body.description)

    if updates:
        updates.append("updated_at = ?")
        params.append(now)
        params.append(webhook_id)
        await db.execute(f"UPDATE webhooks SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()

    return {"ok": True}


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    await db.execute("DELETE FROM webhooks WHERE id = ?", (webhook_id,))
    await db.commit()


@router.get("/{webhook_id}/deliveries")
async def list_deliveries(
    webhook_id: int,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        """SELECT id, event, status_code, success, attempt, created_at
           FROM webhook_deliveries WHERE webhook_id = ?
           ORDER BY created_at DESC LIMIT ?""",
        (webhook_id, limit),
    )
    rows = await cursor.fetchall()
    return {"data": [dict(r) for r in rows]}


@router.post("/test", status_code=status.HTTP_200_OK)
async def test_webhook(
    body: WebhookCreate,
    _current=Depends(require_auth),
):
    """Send a test event to a webhook URL without saving it."""
    import urllib.request
    import urllib.error

    test_payload = json.dumps({
        "event": "test",
        "payload": {"message": "This is a test webhook from Agent Board"},
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    })

    try:
        req = urllib.request.Request(
            body.url,
            data=test_payload.encode(),
            headers={"Content-Type": "application/json", "X-AgentBoard-Event": "test"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"success": True, "status_code": resp.status}
    except urllib.error.HTTPError as e:
        return {"success": False, "status_code": e.code, "error": e.read().decode()[:200]}
    except Exception as e:
        return {"success": False, "status_code": 0, "error": str(e)[:200]}
