"""
Agent Board — Ticket routes.

POST /                          — create ticket
GET  /                          — list with filters + pagination
GET  /{id}                      — single ticket with comments and blockers
PUT  /{id}                      — update ticket fields
DELETE /{id}                    — admin only

Lifecycle:
  POST /{id}/start
  POST /{id}/block
  POST /{id}/unblock
  POST /{id}/review
  POST /{id}/done

Comments:
  GET  /{id}/comments
  POST /{id}/comments

Blockers:
  GET  /{id}/blockers
  POST /{id}/blockers
  PUT  /{id}/blockers/{bid}/resolve

Bulk:
  POST /bulk/assign
  POST /bulk/status
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

import aiosqlite
from app.database import get_db
from app.middleware.auth import get_current_admin, require_auth
from app.services.activity_service import log_activity

router = APIRouter()

# Valid status transitions
_TRANSITIONS: dict[str, set[str]] = {
    "todo":        {"in_progress", "cancelled"},
    "in_progress": {"review", "blocked", "todo", "cancelled"},
    "blocked":     {"in_progress", "cancelled"},
    "review":      {"done", "in_progress", "cancelled"},
    "done":        set(),
    "cancelled":   set(),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


def _validate_transition(current: str, target: str) -> None:
    allowed = _TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{current}' to '{target}'. "
                   f"Allowed transitions: {sorted(allowed) or 'none'}",
        )


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class TicketCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "p2"
    project_id: int
    assignee_id: Optional[int] = None
    reporter_id: Optional[int] = None
    sprint_id: Optional[int] = None
    parent_id: Optional[int] = None
    tags: Optional[str] = "[]"
    metadata: Optional[str] = "{}"


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[int] = None
    sprint_id: Optional[int] = None
    parent_id: Optional[int] = None
    tags: Optional[str] = None
    metadata: Optional[str] = None
    close_summary: Optional[str] = None


class BlockBody(BaseModel):
    reason: str
    blocked_by_ticket_id: Optional[int] = None
    blocked_by_agent_id: Optional[int] = None


class CommentCreate(BaseModel):
    body: str
    author_id: int
    metadata: Optional[str] = "{}"


class BlockerCreate(BaseModel):
    reason: str
    blocked_by_ticket_id: Optional[int] = None
    blocked_by_agent_id: Optional[int] = None


class BulkAssign(BaseModel):
    ticket_ids: list[int]
    assignee_id: int


class BulkStatus(BaseModel):
    ticket_ids: list[int]
    status: str


# ---------------------------------------------------------------------------
# Routes — Core CRUD
# ---------------------------------------------------------------------------


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: TicketCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    valid_statuses = {"todo", "in_progress", "review", "done", "blocked", "cancelled"}
    valid_priorities = {"p0", "p1", "p2", "p3"}

    if body.status and body.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid_statuses}")
    if body.priority and body.priority not in valid_priorities:
        raise HTTPException(status_code=422, detail=f"priority must be one of {valid_priorities}")

    # Verify project exists
    cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (body.project_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        cursor = await db.execute(
            """
            INSERT INTO tickets
                (title, description, status, priority, project_id, assignee_id,
                 reporter_id, sprint_id, parent_id, tags, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, title, description, status, priority, project_id,
                      assignee_id, reporter_id, sprint_id, parent_id,
                      tags, close_summary, closed_at, metadata, created_at, updated_at
            """,
            (
                body.title,
                body.description,
                body.status or "todo",
                body.priority or "p2",
                body.project_id,
                body.assignee_id,
                body.reporter_id,
                body.sprint_id,
                body.parent_id,
                body.tags or "[]",
                body.metadata or "{}",
            ),
        )
        row = await cursor.fetchone()
        await log_activity(
            db,
            event_type="ticket.created",
            entity_type="ticket",
            entity_id=row["id"],
            agent_id=body.reporter_id,
            project_id=body.project_id,
            old_value=None,
            new_value=body.title,
            summary=f"Ticket '{body.title}' created in project #{body.project_id}",
        )
        await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return row_to_dict(row)


@router.get("/")
async def list_tickets(
    project_id: Optional[int] = None,
    ticket_status: Optional[str] = Query(None, alias="status"),
    assignee_id: Optional[int] = None,
    priority: Optional[str] = None,
    sprint_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
):
    conditions = []
    params: list = []

    if project_id is not None:
        conditions.append("t.project_id = ?")
        params.append(project_id)
    if ticket_status:
        conditions.append("t.status = ?")
        params.append(ticket_status)
    if assignee_id is not None:
        conditions.append("t.assignee_id = ?")
        params.append(assignee_id)
    if priority:
        conditions.append("t.priority = ?")
        params.append(priority)
    if sprint_id is not None:
        conditions.append("t.sprint_id = ?")
        params.append(sprint_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_cursor = await db.execute(
        f"SELECT COUNT(*) as cnt FROM tickets t {where}", params
    )
    total = (await count_cursor.fetchone())["cnt"]

    offset = (page - 1) * per_page
    cursor = await db.execute(
        f"""
        SELECT t.id, t.title, t.description, t.status, t.priority,
               t.project_id, t.assignee_id, t.reporter_id, t.sprint_id,
               t.parent_id, t.tags, t.close_summary, t.closed_at,
               t.metadata, t.created_at, t.updated_at,
               a.display_name as assignee_name,
               p.name as project_name
        FROM tickets t
        LEFT JOIN agents a ON a.id = t.assignee_id
        LEFT JOIN projects p ON p.id = t.project_id
        {where}
        ORDER BY
            CASE t.priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
            t.created_at DESC
        LIMIT ? OFFSET ?
        """,
        [*params, per_page, offset],
    )
    rows = await cursor.fetchall()

    return {
        "data": [row_to_dict(r) for r in rows],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": max(1, -(-total // per_page)),
        },
    }


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT t.id, t.title, t.description, t.status, t.priority,
               t.project_id, t.assignee_id, t.reporter_id, t.sprint_id,
               t.parent_id, t.tags, t.close_summary, t.closed_at,
               t.metadata, t.created_at, t.updated_at,
               a.display_name as assignee_name,
               r.display_name as reporter_name,
               p.name as project_name
        FROM tickets t
        LEFT JOIN agents a ON a.id = t.assignee_id
        LEFT JOIN agents r ON r.id = t.reporter_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.id = ?
        """,
        (ticket_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Comments
    c_cursor = await db.execute(
        """
        SELECT c.id, c.ticket_id, c.author_id, c.body, c.metadata, c.created_at,
               a.display_name as author_name
        FROM comments c
        LEFT JOIN agents a ON a.id = c.author_id
        WHERE c.ticket_id = ?
        ORDER BY c.created_at ASC
        """,
        (ticket_id,),
    )
    comments = [row_to_dict(r) for r in await c_cursor.fetchall()]

    # Blockers
    b_cursor = await db.execute(
        """
        SELECT b.id, b.ticket_id, b.blocked_by_ticket_id, b.blocked_by_agent_id,
               b.reason, b.status, b.resolved_at, b.created_at,
               bt.title as blocked_by_ticket_title,
               ba.display_name as blocked_by_agent_name
        FROM blockers b
        LEFT JOIN tickets bt ON bt.id = b.blocked_by_ticket_id
        LEFT JOIN agents ba ON ba.id = b.blocked_by_agent_id
        WHERE b.ticket_id = ?
        ORDER BY b.created_at DESC
        """,
        (ticket_id,),
    )
    blockers = [row_to_dict(r) for r in await b_cursor.fetchall()]

    ticket = row_to_dict(row)
    ticket["comments"] = comments
    ticket["blockers"] = blockers
    return ticket


@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id: int,
    body: TicketUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        "SELECT id, project_id FROM tickets WHERE id = ?", (ticket_id,)
    )
    ticket = await cursor.fetchone()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.description is not None:
        updates["description"] = body.description
    if body.priority is not None:
        valid = {"p0", "p1", "p2", "p3"}
        if body.priority not in valid:
            raise HTTPException(status_code=422, detail=f"priority must be one of {valid}")
        updates["priority"] = body.priority
    if body.assignee_id is not None:
        updates["assignee_id"] = body.assignee_id
    if body.sprint_id is not None:
        updates["sprint_id"] = body.sprint_id
    if body.parent_id is not None:
        updates["parent_id"] = body.parent_id
    if body.tags is not None:
        updates["tags"] = body.tags
    if body.metadata is not None:
        updates["metadata"] = body.metadata
    if body.close_summary is not None:
        updates["close_summary"] = body.close_summary

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    set_parts = [f"{k} = ?" for k in updates] + ["updated_at = datetime('now')"]
    set_clause = ", ".join(set_parts)
    values = list(updates.values()) + [ticket_id]

    await db.execute(f"UPDATE tickets SET {set_clause} WHERE id = ?", values)
    await log_activity(
        db,
        event_type="ticket.updated",
        entity_type="ticket",
        entity_id=ticket_id,
        agent_id=None,
        project_id=ticket["project_id"],
        old_value=None,
        new_value=str(updates),
        summary=f"Ticket #{ticket_id} updated",
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT id, title, description, status, priority, project_id, assignee_id, "
        "reporter_id, sprint_id, parent_id, tags, close_summary, closed_at, "
        "metadata, created_at, updated_at FROM tickets WHERE id = ?",
        (ticket_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(
    ticket_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id FROM tickets WHERE id = ?", (ticket_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    await db.execute("DELETE FROM tickets WHERE id = ?", (ticket_id,))
    await db.commit()


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------


async def _transition(
    ticket_id: int,
    target_status: str,
    db: aiosqlite.Connection,
    extra_fields: Optional[dict] = None,
    agent_id: Optional[int] = None,
) -> dict:
    cursor = await db.execute(
        "SELECT id, status, project_id, title FROM tickets WHERE id = ?",
        (ticket_id,),
    )
    ticket = await cursor.fetchone()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    _validate_transition(ticket["status"], target_status)

    set_parts = ["status = ?", "updated_at = datetime('now')"]
    values: list = [target_status]

    if extra_fields:
        for k, v in extra_fields.items():
            set_parts.append(f"{k} = ?")
            values.append(v)

    values.append(ticket_id)
    await db.execute(
        f"UPDATE tickets SET {', '.join(set_parts)} WHERE id = ?", values
    )
    await log_activity(
        db,
        event_type=f"ticket.{target_status}",
        entity_type="ticket",
        entity_id=ticket_id,
        agent_id=agent_id,
        project_id=ticket["project_id"],
        old_value=ticket["status"],
        new_value=target_status,
        summary=f"Ticket #{ticket_id} '{ticket['title']}' moved to {target_status}",
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT id, title, status, priority, project_id, assignee_id, "
        "close_summary, closed_at, updated_at FROM tickets WHERE id = ?",
        (ticket_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.post("/{ticket_id}/start")
async def start_ticket(
    ticket_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    return await _transition(ticket_id, "in_progress", db)


@router.post("/{ticket_id}/block")
async def block_ticket(
    ticket_id: int,
    body: BlockBody,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    result = await _transition(ticket_id, "blocked", db)

    # Insert blocker record
    await db.execute(
        """
        INSERT INTO blockers (ticket_id, blocked_by_ticket_id, blocked_by_agent_id, reason)
        VALUES (?, ?, ?, ?)
        """,
        (ticket_id, body.blocked_by_ticket_id, body.blocked_by_agent_id, body.reason),
    )
    await db.commit()
    return result


@router.post("/{ticket_id}/unblock")
async def unblock_ticket(
    ticket_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    # Resolve all active blockers for this ticket
    await db.execute(
        "UPDATE blockers SET status = 'resolved', resolved_at = datetime('now') "
        "WHERE ticket_id = ? AND status = 'active'",
        (ticket_id,),
    )
    return await _transition(ticket_id, "in_progress", db)


@router.post("/{ticket_id}/review")
async def review_ticket(
    ticket_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    return await _transition(ticket_id, "review", db)


@router.post("/{ticket_id}/done")
async def done_ticket(
    ticket_id: int,
    close_summary: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    extra: dict = {"closed_at": "datetime('now')"}
    if close_summary:
        extra["close_summary"] = close_summary
    return await _transition(ticket_id, "done", db, extra_fields=extra)


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------


@router.get("/{ticket_id}/comments")
async def list_comments(ticket_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM tickets WHERE id = ?", (ticket_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    cursor = await db.execute(
        """
        SELECT c.id, c.ticket_id, c.author_id, c.body, c.metadata, c.created_at,
               a.display_name as author_name
        FROM comments c
        LEFT JOIN agents a ON a.id = c.author_id
        WHERE c.ticket_id = ?
        ORDER BY c.created_at ASC
        """,
        (ticket_id,),
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}


@router.post("/{ticket_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    ticket_id: int,
    body: CommentCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        "SELECT id, project_id FROM tickets WHERE id = ?", (ticket_id,)
    )
    ticket = await cursor.fetchone()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    cursor = await db.execute(
        """
        INSERT INTO comments (ticket_id, author_id, body, metadata)
        VALUES (?, ?, ?, ?)
        RETURNING id, ticket_id, author_id, body, metadata, created_at
        """,
        (ticket_id, body.author_id, body.body, body.metadata or "{}"),
    )
    row = await cursor.fetchone()
    await log_activity(
        db,
        event_type="ticket.commented",
        entity_type="ticket",
        entity_id=ticket_id,
        agent_id=body.author_id,
        project_id=ticket["project_id"],
        old_value=None,
        new_value=None,
        summary=f"Comment added to ticket #{ticket_id}",
    )
    await db.commit()
    return row_to_dict(row)


# ---------------------------------------------------------------------------
# Blockers
# ---------------------------------------------------------------------------


@router.get("/{ticket_id}/blockers")
async def list_blockers(ticket_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM tickets WHERE id = ?", (ticket_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    cursor = await db.execute(
        """
        SELECT b.id, b.ticket_id, b.blocked_by_ticket_id, b.blocked_by_agent_id,
               b.reason, b.status, b.resolved_at, b.created_at,
               bt.title as blocked_by_ticket_title,
               ba.display_name as blocked_by_agent_name
        FROM blockers b
        LEFT JOIN tickets bt ON bt.id = b.blocked_by_ticket_id
        LEFT JOIN agents ba ON ba.id = b.blocked_by_agent_id
        WHERE b.ticket_id = ?
        ORDER BY b.created_at DESC
        """,
        (ticket_id,),
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}


@router.post("/{ticket_id}/blockers", status_code=status.HTTP_201_CREATED)
async def add_blocker(
    ticket_id: int,
    body: BlockerCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        "SELECT id, project_id FROM tickets WHERE id = ?", (ticket_id,)
    )
    ticket = await cursor.fetchone()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    cursor = await db.execute(
        """
        INSERT INTO blockers (ticket_id, blocked_by_ticket_id, blocked_by_agent_id, reason)
        VALUES (?, ?, ?, ?)
        RETURNING id, ticket_id, blocked_by_ticket_id, blocked_by_agent_id,
                  reason, status, resolved_at, created_at
        """,
        (ticket_id, body.blocked_by_ticket_id, body.blocked_by_agent_id, body.reason),
    )
    row = await cursor.fetchone()
    await log_activity(
        db,
        event_type="ticket.blocker_added",
        entity_type="ticket",
        entity_id=ticket_id,
        agent_id=None,
        project_id=ticket["project_id"],
        old_value=None,
        new_value=body.reason,
        summary=f"Blocker added to ticket #{ticket_id}: {body.reason}",
    )
    await db.commit()
    return row_to_dict(row)


@router.put("/{ticket_id}/blockers/{blocker_id}/resolve")
async def resolve_blocker(
    ticket_id: int,
    blocker_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        "SELECT id, project_id FROM tickets WHERE id = ?", (ticket_id,)
    )
    ticket = await cursor.fetchone()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    cursor = await db.execute(
        "SELECT id, status FROM blockers WHERE id = ? AND ticket_id = ?",
        (blocker_id, ticket_id),
    )
    blocker = await cursor.fetchone()
    if blocker is None:
        raise HTTPException(status_code=404, detail="Blocker not found")

    if blocker["status"] == "resolved":
        raise HTTPException(status_code=422, detail="Blocker is already resolved")

    await db.execute(
        "UPDATE blockers SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?",
        (blocker_id,),
    )
    await log_activity(
        db,
        event_type="ticket.blocker_resolved",
        entity_type="ticket",
        entity_id=ticket_id,
        agent_id=None,
        project_id=ticket["project_id"],
        old_value="active",
        new_value="resolved",
        summary=f"Blocker #{blocker_id} resolved on ticket #{ticket_id}",
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT id, ticket_id, reason, status, resolved_at, created_at FROM blockers WHERE id = ?",
        (blocker_id,),
    )
    return row_to_dict(await cursor.fetchone())


# ---------------------------------------------------------------------------
# Bulk operations
# ---------------------------------------------------------------------------


@router.post("/bulk/assign")
async def bulk_assign(
    body: BulkAssign,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    if not body.ticket_ids:
        raise HTTPException(status_code=422, detail="ticket_ids cannot be empty")

    # Verify assignee exists
    cursor = await db.execute(
        "SELECT id FROM agents WHERE id = ?", (body.assignee_id,)
    )
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Assignee agent not found")

    placeholders = ",".join("?" * len(body.ticket_ids))
    await db.execute(
        f"UPDATE tickets SET assignee_id = ?, updated_at = datetime('now') "
        f"WHERE id IN ({placeholders})",
        [body.assignee_id, *body.ticket_ids],
    )
    await db.commit()

    return {"updated": len(body.ticket_ids), "assignee_id": body.assignee_id}


@router.post("/bulk/status")
async def bulk_status(
    body: BulkStatus,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    if not body.ticket_ids:
        raise HTTPException(status_code=422, detail="ticket_ids cannot be empty")

    valid = {"todo", "in_progress", "review", "done", "blocked", "cancelled"}
    if body.status not in valid:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid}")

    placeholders = ",".join("?" * len(body.ticket_ids))
    await db.execute(
        f"UPDATE tickets SET status = ?, updated_at = datetime('now') "
        f"WHERE id IN ({placeholders})",
        [body.status, *body.ticket_ids],
    )
    await db.commit()

    return {"updated": len(body.ticket_ids), "status": body.status}
