"""
Agent Board — Project routes.

Full CRUD + stats endpoint.

GET    /           — list all projects
POST   /           — create project
GET    /{id}       — single project
PUT    /{id}       — update project
DELETE /{id}       — delete project (admin only)
GET    /{id}/stats — ticket counts by status for this project
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

import aiosqlite
from app.database import get_db
from app.middleware.auth import get_current_admin, require_auth
from app.services.activity_service import log_activity

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    status: Optional[str] = "active"
    metadata: Optional[str] = "{}"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/")
async def list_projects(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT p.id, p.name, p.slug, p.description, p.status,
               p.metadata, p.created_at, p.updated_at,
               COUNT(t.id) as ticket_count
        FROM projects p
        LEFT JOIN tickets t ON t.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
        """
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    valid_statuses = {"active", "archived", "paused"}
    if body.status and body.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid_statuses}")

    try:
        cursor = await db.execute(
            """
            INSERT INTO projects (name, slug, description, status, metadata)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id, name, slug, description, status, metadata, created_at, updated_at
            """,
            (
                body.name,
                body.slug,
                body.description,
                body.status or "active",
                body.metadata or "{}",
            ),
        )
        row = await cursor.fetchone()
        await log_activity(
            db,
            event_type="project.created",
            entity_type="project",
            entity_id=row["id"],
            agent_id=None,
            project_id=row["id"],
            old_value=None,
            new_value=body.name,
            summary=f"Project '{body.name}' created",
        )
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return row_to_dict(row)


@router.get("/{project_id}")
async def get_project(project_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT p.id, p.name, p.slug, p.description, p.status,
               p.metadata, p.created_at, p.updated_at,
               COUNT(t.id) as ticket_count
        FROM projects p
        LEFT JOIN tickets t ON t.project_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
        """,
        (project_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return row_to_dict(row)


@router.put("/{project_id}")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    valid_statuses = {"active", "archived", "paused"}
    if body.status and body.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid_statuses}")

    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.slug is not None:
        updates["slug"] = body.slug
    if body.description is not None:
        updates["description"] = body.description
    if body.status is not None:
        updates["status"] = body.status
    if body.metadata is not None:
        updates["metadata"] = body.metadata

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    set_parts = [f"{k} = ?" for k in updates] + ["updated_at = datetime('now')"]
    set_clause = ", ".join(set_parts)
    values = list(updates.values()) + [project_id]

    try:
        await db.execute(f"UPDATE projects SET {set_clause} WHERE id = ?", values)
        await log_activity(
            db,
            event_type="project.updated",
            entity_type="project",
            entity_id=project_id,
            agent_id=None,
            project_id=project_id,
            old_value=None,
            new_value=str(updates),
            summary=f"Project #{project_id} updated",
        )
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    cursor = await db.execute(
        "SELECT id, name, slug, description, status, metadata, created_at, updated_at "
        "FROM projects WHERE id = ?",
        (project_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await _cascade_delete_project(db, project_id)
    await db.commit()


class BulkDeleteRequest(BaseModel):
    ids: list[int]


@router.post("/bulk/delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_projects(
    body: BulkDeleteRequest,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    if not body.ids:
        raise HTTPException(status_code=422, detail="ids list must not be empty")

    for pid in body.ids:
        await _cascade_delete_project(db, pid)
    await db.commit()


async def _cascade_delete_project(db: aiosqlite.Connection, project_id: int):
    """Cascade-delete a project and all related data."""
    # Collect ticket ids for this project
    cursor = await db.execute(
        "SELECT id FROM tickets WHERE project_id = ?", (project_id,)
    )
    ticket_ids = [r["id"] for r in await cursor.fetchall()]

    if ticket_ids:
        placeholders = ",".join("?" * len(ticket_ids))
        # Delete from tables that reference tickets but use SET NULL
        await db.execute(
            f"DELETE FROM tool_usage_log WHERE ticket_id IN ({placeholders})",
            ticket_ids,
        )
        await db.execute(
            f"DELETE FROM agent_sessions WHERE ticket_id IN ({placeholders})",
            ticket_ids,
        )

    # Delete from tables that reference project_id with SET NULL
    await db.execute(
        "DELETE FROM activity_log WHERE project_id = ?", (project_id,)
    )
    await db.execute(
        "DELETE FROM agent_sessions WHERE project_id = ?", (project_id,)
    )
    await db.execute(
        "DELETE FROM standup_entries WHERE project_id = ?", (project_id,)
    )

    # FK cascades handle: sprints, tickets, comments, blockers, ticket_metrics
    await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))


@router.get("/{project_id}/stats")
async def project_stats(project_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id, name FROM projects WHERE id = ?", (project_id,))
    project = await cursor.fetchone()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    cursor = await db.execute(
        """
        SELECT status, COUNT(*) as cnt
        FROM tickets
        WHERE project_id = ?
        GROUP BY status
        """,
        (project_id,),
    )
    status_rows = await cursor.fetchall()

    cursor = await db.execute(
        """
        SELECT priority, COUNT(*) as cnt
        FROM tickets
        WHERE project_id = ?
        GROUP BY priority
        """,
        (project_id,),
    )
    priority_rows = await cursor.fetchall()

    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM blockers b "
        "JOIN tickets t ON t.id = b.ticket_id "
        "WHERE t.project_id = ? AND b.status = 'active'",
        (project_id,),
    )
    blockers_row = await cursor.fetchone()

    return {
        "project_id": project_id,
        "project_name": project["name"],
        "tickets_by_status": {r["status"]: r["cnt"] for r in status_rows},
        "tickets_by_priority": {r["priority"]: r["cnt"] for r in priority_rows},
        "active_blockers": blockers_row["cnt"] if blockers_row else 0,
    }
