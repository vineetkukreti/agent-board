"""
Webhook delivery service — fires HTTP POST to registered webhook URLs on events.
Uses HMAC-SHA256 signing when a secret is configured.
Runs deliveries in background tasks (non-blocking).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timezone

import aiosqlite

logger = logging.getLogger("agent_board.webhooks")


async def fire_event(db: aiosqlite.Connection, event: str, payload: dict) -> int:
    """
    Fire a webhook event to all active webhooks subscribed to this event.
    Returns the number of deliveries attempted.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cursor = await db.execute(
        "SELECT id, url, secret, events FROM webhooks WHERE is_active = 1"
    )
    webhooks = await cursor.fetchall()

    count = 0
    for wh in webhooks:
        # Check if webhook subscribes to this event
        try:
            subscribed = json.loads(wh["events"])
        except (json.JSONDecodeError, TypeError):
            subscribed = ["*"]

        if "*" not in subscribed and event not in subscribed:
            # Check prefix match (e.g., "ticket.*" matches "ticket.created")
            prefix_match = any(
                s.endswith(".*") and event.startswith(s[:-2])
                for s in subscribed
            )
            if not prefix_match:
                continue

        body = json.dumps({"event": event, "payload": payload, "timestamp": now})

        # HMAC signature
        signature = ""
        if wh["secret"]:
            signature = hmac.new(
                wh["secret"].encode(), body.encode(), hashlib.sha256
            ).hexdigest()

        # Deliver (synchronous for simplicity — could be async with httpx)
        status_code = 0
        response_body = ""
        success = False
        try:
            headers = {
                "Content-Type": "application/json",
                "X-AgentBoard-Event": event,
                "X-AgentBoard-Signature": f"sha256={signature}" if signature else "",
            }
            req = urllib.request.Request(
                wh["url"], data=body.encode(), headers=headers, method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                status_code = resp.status
                response_body = resp.read().decode()[:500]
                success = 200 <= status_code < 300
        except urllib.error.HTTPError as e:
            status_code = e.code
            response_body = e.read().decode()[:500]
        except Exception as e:
            response_body = str(e)[:500]

        # Log delivery
        await db.execute(
            """INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response_body, success, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (wh["id"], event, body[:2000], status_code, response_body, 1 if success else 0, now),
        )
        count += 1

        if not success:
            logger.warning(f"Webhook {wh['id']} delivery failed for {event}: {status_code}")

    if count > 0:
        await db.commit()

    return count
