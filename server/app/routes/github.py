"""
Agent Board — GitHub webhook integration.

POST /github  — receive GitHub webhook payloads (push, pull_request, check_run)

Validates optional webhook signature via GITHUB_WEBHOOK_SECRET env var.
Matches commit messages / PR titles / branch names to ticket IDs using
patterns: #123, AB-123, IDLI-001.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status

from app.database import get_db_ctx
from app.services.activity_service import log_activity

router = APIRouter()
logger = logging.getLogger("agent_board.github")

# Regex to find ticket IDs: #123, AB-123, IDLI-001
TICKET_ID_PATTERN = re.compile(r"(?:#(\d+))|(?:([A-Z][A-Z0-9]+-\d+))")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_ticket_ids(text: str) -> list[int]:
    """Extract numeric ticket IDs from text.

    Supports:
      - #123        -> ticket id 123
      - AB-123      -> ticket id 123
      - IDLI-001    -> ticket id 1
    """
    if not text:
        return []

    ids: list[int] = []
    for match in TICKET_ID_PATTERN.finditer(text):
        if match.group(1):
            # #123 style
            ids.append(int(match.group(1)))
        elif match.group(2):
            # AB-123 style — extract the numeric part
            num = match.group(2).split("-")[-1]
            ids.append(int(num))
    return list(set(ids))


def _verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook HMAC-SHA256 signature."""
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _get_ticket(db, ticket_id: int) -> Optional[dict]:
    """Fetch a ticket row by ID, return as dict or None."""
    cursor = await db.execute(
        "SELECT id, title, status, project_id, metadata FROM tickets WHERE id = ?",
        (ticket_id,),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def _add_comment(db, ticket_id: int, body: str, project_id: int) -> None:
    """Add a system comment to a ticket (author_id=NULL for webhook comments).

    Falls back gracefully if the comments table still has a NOT NULL
    constraint on author_id (older schema) — in that case we skip the
    comment insert and only log the activity.
    """
    try:
        await db.execute(
            """
            INSERT INTO comments (ticket_id, author_id, body, metadata)
            VALUES (?, NULL, ?, '{"source": "github_webhook"}')
            """,
            (ticket_id, body),
        )
    except Exception:
        # Older schema with NOT NULL author_id — log as activity only
        logger.debug(
            "Could not insert webhook comment (author_id NOT NULL constraint); "
            "logging as activity instead."
        )

    await log_activity(
        db,
        event_type="ticket.github_comment",
        entity_type="ticket",
        entity_id=ticket_id,
        agent_id=None,
        project_id=project_id,
        old_value=None,
        new_value=body,
        summary=f"GitHub webhook added comment to ticket #{ticket_id}",
    )


async def _update_ticket_metadata(db, ticket_id: int, updates: dict) -> None:
    """Merge updates into the ticket's metadata JSON field."""
    cursor = await db.execute(
        "SELECT metadata FROM tickets WHERE id = ?", (ticket_id,)
    )
    row = await cursor.fetchone()
    if not row:
        return

    try:
        existing = json.loads(row["metadata"] or "{}")
    except (json.JSONDecodeError, TypeError):
        existing = {}

    existing.update(updates)

    await db.execute(
        "UPDATE tickets SET metadata = ?, updated_at = datetime('now') WHERE id = ?",
        (json.dumps(existing), ticket_id),
    )


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------


async def _handle_push(payload: dict) -> dict:
    """Handle push event — match commits to tickets, add comments."""
    commits = payload.get("commits", [])
    repo_name = payload.get("repository", {}).get("full_name", "unknown")
    ref = payload.get("ref", "")
    branch = ref.replace("refs/heads/", "") if ref.startswith("refs/heads/") else ref

    matched_tickets: list[int] = []

    async with get_db_ctx() as db:
        for commit in commits:
            message = commit.get("message", "")
            author = commit.get("author", {}).get("name", "unknown")
            sha = commit.get("id", "")[:8]
            url = commit.get("url", "")

            ticket_ids = _extract_ticket_ids(message)

            # Also check branch name for ticket refs
            ticket_ids.extend(_extract_ticket_ids(branch))
            ticket_ids = list(set(ticket_ids))

            for tid in ticket_ids:
                ticket = await _get_ticket(db, tid)
                if not ticket:
                    continue

                comment = (
                    f"**Commit** [`{sha}`]({url}) on `{repo_name}/{branch}`\n"
                    f"**Author:** {author}\n"
                    f"**Message:** {message}"
                )
                await _add_comment(db, tid, comment, ticket["project_id"])
                matched_tickets.append(tid)

        await db.commit()

    return {
        "event": "push",
        "commits_processed": len(commits),
        "tickets_matched": matched_tickets,
    }


async def _handle_pull_request(payload: dict) -> dict:
    """Handle pull_request event — link PRs to tickets, auto-close on merge."""
    action = payload.get("action", "")
    pr = payload.get("pull_request", {})
    pr_url = pr.get("html_url", "")
    pr_title = pr.get("title", "")
    pr_body = pr.get("body", "") or ""
    pr_number = pr.get("number", 0)
    pr_merged = pr.get("merged", False)
    branch = pr.get("head", {}).get("ref", "")
    repo_name = payload.get("repository", {}).get("full_name", "unknown")

    # Search for ticket IDs in title, body, and branch name
    ticket_ids = _extract_ticket_ids(pr_title)
    ticket_ids.extend(_extract_ticket_ids(pr_body))
    ticket_ids.extend(_extract_ticket_ids(branch))
    ticket_ids = list(set(ticket_ids))

    matched_tickets: list[int] = []

    async with get_db_ctx() as db:
        for tid in ticket_ids:
            ticket = await _get_ticket(db, tid)
            if not ticket:
                continue

            matched_tickets.append(tid)

            if action == "opened" or action == "reopened":
                # Link PR to ticket via metadata
                await _update_ticket_metadata(db, tid, {
                    "pr_url": pr_url,
                    "pr_number": pr_number,
                    "pr_status": "open",
                    "pr_repo": repo_name,
                })

                comment = (
                    f"**Pull Request Opened:** [#{pr_number} {pr_title}]({pr_url})\n"
                    f"**Branch:** `{branch}`\n"
                    f"**Repo:** {repo_name}"
                )
                await _add_comment(db, tid, comment, ticket["project_id"])

                await log_activity(
                    db,
                    event_type="ticket.pr_linked",
                    entity_type="ticket",
                    entity_id=tid,
                    agent_id=None,
                    project_id=ticket["project_id"],
                    old_value=None,
                    new_value=pr_url,
                    summary=f"PR #{pr_number} linked to ticket #{tid}",
                )

            elif action == "closed" and pr_merged:
                # Auto-move ticket to done
                await _update_ticket_metadata(db, tid, {
                    "pr_url": pr_url,
                    "pr_number": pr_number,
                    "pr_status": "merged",
                    "pr_repo": repo_name,
                })

                current_status = ticket["status"]
                if current_status not in ("done", "cancelled"):
                    await db.execute(
                        "UPDATE tickets SET status = 'done', closed_at = datetime('now'), "
                        "updated_at = datetime('now') WHERE id = ?",
                        (tid,),
                    )
                    await log_activity(
                        db,
                        event_type="ticket.done",
                        entity_type="ticket",
                        entity_id=tid,
                        agent_id=None,
                        project_id=ticket["project_id"],
                        old_value=current_status,
                        new_value="done",
                        summary=f"Ticket #{tid} auto-closed: PR #{pr_number} merged",
                    )

                comment = (
                    f"**Pull Request Merged:** [#{pr_number} {pr_title}]({pr_url})\n"
                    f"Ticket automatically moved to **done**."
                )
                await _add_comment(db, tid, comment, ticket["project_id"])

            elif action == "closed" and not pr_merged:
                # PR closed without merge
                await _update_ticket_metadata(db, tid, {
                    "pr_url": pr_url,
                    "pr_number": pr_number,
                    "pr_status": "closed",
                    "pr_repo": repo_name,
                })

                comment = (
                    f"**Pull Request Closed** (not merged): "
                    f"[#{pr_number} {pr_title}]({pr_url})"
                )
                await _add_comment(db, tid, comment, ticket["project_id"])

        await db.commit()

    return {
        "event": "pull_request",
        "action": action,
        "pr_number": pr_number,
        "tickets_matched": matched_tickets,
    }


async def _handle_check_run(payload: dict) -> dict:
    """Handle check_run event — add badge/blocker based on CI result."""
    action = payload.get("action", "")
    check_run = payload.get("check_run", {})
    conclusion = check_run.get("conclusion", "")
    name = check_run.get("name", "")
    html_url = check_run.get("html_url", "")
    repo_name = payload.get("repository", {}).get("full_name", "unknown")

    if action != "completed":
        return {"event": "check_run", "action": action, "skipped": True}

    # Try to find ticket IDs from the head branch of the check suite
    head_branch = check_run.get("check_suite", {}).get("head_branch", "")
    head_sha = check_run.get("head_sha", "")[:8]
    ticket_ids = _extract_ticket_ids(head_branch)

    matched_tickets: list[int] = []

    async with get_db_ctx() as db:
        for tid in ticket_ids:
            ticket = await _get_ticket(db, tid)
            if not ticket:
                continue

            matched_tickets.append(tid)

            if conclusion == "success":
                # Add green CI badge to metadata
                await _update_ticket_metadata(db, tid, {
                    "ci_status": "success",
                    "ci_check_name": name,
                    "ci_url": html_url,
                })

                comment = (
                    f"**CI Passed:** `{name}` on `{head_sha}`\n"
                    f"[View check]({html_url})"
                )
                await _add_comment(db, tid, comment, ticket["project_id"])

            elif conclusion == "failure":
                # Add blocker to ticket
                await _update_ticket_metadata(db, tid, {
                    "ci_status": "failure",
                    "ci_check_name": name,
                    "ci_url": html_url,
                })

                await db.execute(
                    """
                    INSERT INTO blockers (ticket_id, reason)
                    VALUES (?, ?)
                    """,
                    (tid, f"CI check '{name}' failed — {html_url}"),
                )

                comment = (
                    f"**CI Failed:** `{name}` on `{head_sha}`\n"
                    f"[View check]({html_url})\n"
                    f"A blocker has been added to this ticket."
                )
                await _add_comment(db, tid, comment, ticket["project_id"])

                await log_activity(
                    db,
                    event_type="ticket.blocker_added",
                    entity_type="ticket",
                    entity_id=tid,
                    agent_id=None,
                    project_id=ticket["project_id"],
                    old_value=None,
                    new_value=f"CI '{name}' failed",
                    summary=f"CI blocker added to ticket #{tid}: {name} failed",
                )

        await db.commit()

    return {
        "event": "check_run",
        "conclusion": conclusion,
        "check_name": name,
        "tickets_matched": matched_tickets,
    }


# ---------------------------------------------------------------------------
# Main webhook endpoint
# ---------------------------------------------------------------------------


@router.post("/github")
async def github_webhook(request: Request):
    """Receive and process GitHub webhook payloads.

    Supports push, pull_request, and check_run events.
    Optionally validates HMAC-SHA256 signature if GITHUB_WEBHOOK_SECRET is set.
    """
    # Signature verification (optional)
    secret = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    if secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        if not signature:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing X-Hub-Signature-256 header",
            )

        body = await request.body()
        if not _verify_signature(body, signature, secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )
        payload = json.loads(body)
    else:
        payload = await request.json()

    event = request.headers.get("X-GitHub-Event", "")

    logger.info(f"GitHub webhook received: event={event}")

    if event == "push":
        result = await _handle_push(payload)
    elif event == "pull_request":
        result = await _handle_pull_request(payload)
    elif event == "check_run":
        result = await _handle_check_run(payload)
    elif event == "ping":
        return {"status": "ok", "event": "ping", "zen": payload.get("zen", "")}
    else:
        return {"status": "ok", "event": event, "message": "Event type not handled"}

    return {"status": "ok", **result}
