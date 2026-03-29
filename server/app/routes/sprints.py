"""
Agent Board — Sprint routes.

Full CRUD + activate/complete lifecycle + board view.

GET    /              — list sprints (optionally filter by project_id)
POST   /              — create sprint
GET    /{id}          — single sprint
PUT    /{id}          — update sprint
DELETE /{id}          — delete sprint (admin only)
POST   /{id}/activate — move sprint from planning → active
POST   /{id}/complete — move sprint from active → completed
GET    /{id}/board    — tickets in this sprint grouped by status
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class SprintCreate(BaseModel):
    name: str
    goal: Optional[str] = None
    project_id: int
    status: Optional[str] = "planning"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    metadata: Optional[str] = "{}"


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    metadata: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/")
async def list_sprints(
    project_id: Optional[int] = None,
    sprint_status: Optional[str] = Query(None, alias="status"),
    db: aiosqlite.Connection = Depends(get_db),
):
    conditions = []
    params: list = []

    if project_id is not None:
        conditions.append("s.project_id = ?")
        params.append(project_id)
    if sprint_status:
        conditions.append("s.status = ?")
        params.append(sprint_status)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    cursor = await db.execute(
        f"""
        SELECT s.id, s.name, s.goal, s.project_id, s.status,
               s.start_date, s.end_date, s.metadata, s.created_at, s.updated_at,
               p.name as project_name,
               COUNT(t.id) as ticket_count
        FROM sprints s
        LEFT JOIN projects p ON p.id = s.project_id
        LEFT JOIN tickets t ON t.sprint_id = s.id
        {where}
        GROUP BY s.id
        ORDER BY s.created_at DESC
        """,
        params,
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_sprint(
    body: SprintCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    valid_statuses = {"planning", "active", "completed", "cancelled"}
    if body.status and body.status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid_statuses}")

    cursor = await db.execute("SELECT id FROM projects WHERE id = ?", (body.project_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        cursor = await db.execute(
            """
            INSERT INTO sprints (name, goal, project_id, status, start_date, end_date, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id, name, goal, project_id, status, start_date, end_date,
                      metadata, created_at, updated_at
            """,
            (
                body.name,
                body.goal,
                body.project_id,
                body.status or "planning",
                body.start_date,
                body.end_date,
                body.metadata or "{}",
            ),
        )
        row = await cursor.fetchone()
        await log_activity(
            db,
            event_type="sprint.created",
            entity_type="sprint",
            entity_id=row["id"],
            agent_id=None,
            project_id=body.project_id,
            old_value=None,
            new_value=body.name,
            summary=f"Sprint '{body.name}' created for project #{body.project_id}",
        )
        await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return row_to_dict(row)


@router.get("/{sprint_id}")
async def get_sprint(sprint_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT s.id, s.name, s.goal, s.project_id, s.status,
               s.start_date, s.end_date, s.metadata, s.created_at, s.updated_at,
               p.name as project_name,
               COUNT(t.id) as ticket_count
        FROM sprints s
        LEFT JOIN projects p ON p.id = s.project_id
        LEFT JOIN tickets t ON t.sprint_id = s.id
        WHERE s.id = ?
        GROUP BY s.id
        """,
        (sprint_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return row_to_dict(row)


@router.put("/{sprint_id}")
async def update_sprint(
    sprint_id: int,
    body: SprintUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute("SELECT id FROM sprints WHERE id = ?", (sprint_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Sprint not found")

    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.goal is not None:
        updates["goal"] = body.goal
    if body.start_date is not None:
        updates["start_date"] = body.start_date
    if body.end_date is not None:
        updates["end_date"] = body.end_date
    if body.metadata is not None:
        updates["metadata"] = body.metadata

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    set_parts = [f"{k} = ?" for k in updates] + ["updated_at = datetime('now')"]
    set_clause = ", ".join(set_parts)
    values = list(updates.values()) + [sprint_id]

    await db.execute(f"UPDATE sprints SET {set_clause} WHERE id = ?", values)
    await db.commit()

    cursor = await db.execute(
        "SELECT id, name, goal, project_id, status, start_date, end_date, "
        "metadata, created_at, updated_at FROM sprints WHERE id = ?",
        (sprint_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint(
    sprint_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id, status FROM sprints WHERE id = ?", (sprint_id,))
    sprint = await cursor.fetchone()
    if sprint is None:
        raise HTTPException(status_code=404, detail="Sprint not found")

    if sprint["status"] == "active":
        raise HTTPException(status_code=422, detail="Cannot delete an active sprint")

    await db.execute("DELETE FROM sprints WHERE id = ?", (sprint_id,))
    await db.commit()


@router.post("/{sprint_id}/activate")
async def activate_sprint(
    sprint_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        "SELECT id, status, project_id, name FROM sprints WHERE id = ?", (sprint_id,)
    )
    sprint = await cursor.fetchone()
    if sprint is None:
        raise HTTPException(status_code=404, detail="Sprint not found")

    if sprint["status"] != "planning":
        raise HTTPException(
            status_code=422,
            detail=f"Sprint must be in 'planning' to activate (currently '{sprint['status']}')",
        )

    # Only one active sprint per project
    active_cursor = await db.execute(
        "SELECT id FROM sprints WHERE project_id = ? AND status = 'active'",
        (sprint["project_id"],),
    )
    if await active_cursor.fetchone() is not None:
        raise HTTPException(
            status_code=422,
            detail="Another sprint is already active for this project",
        )

    await db.execute(
        "UPDATE sprints SET status = 'active', updated_at = datetime('now') WHERE id = ?",
        (sprint_id,),
    )
    await log_activity(
        db,
        event_type="sprint.activated",
        entity_type="sprint",
        entity_id=sprint_id,
        agent_id=None,
        project_id=sprint["project_id"],
        old_value="planning",
        new_value="active",
        summary=f"Sprint '{sprint['name']}' activated",
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT id, name, goal, project_id, status, start_date, end_date, "
        "metadata, created_at, updated_at FROM sprints WHERE id = ?",
        (sprint_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.post("/{sprint_id}/complete")
async def complete_sprint(
    sprint_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    cursor = await db.execute(
        "SELECT id, status, project_id, name FROM sprints WHERE id = ?", (sprint_id,)
    )
    sprint = await cursor.fetchone()
    if sprint is None:
        raise HTTPException(status_code=404, detail="Sprint not found")

    if sprint["status"] != "active":
        raise HTTPException(
            status_code=422,
            detail=f"Sprint must be 'active' to complete (currently '{sprint['status']}')",
        )

    await db.execute(
        "UPDATE sprints SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
        (sprint_id,),
    )
    await log_activity(
        db,
        event_type="sprint.completed",
        entity_type="sprint",
        entity_id=sprint_id,
        agent_id=None,
        project_id=sprint["project_id"],
        old_value="active",
        new_value="completed",
        summary=f"Sprint '{sprint['name']}' completed",
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT id, name, goal, project_id, status, start_date, end_date, "
        "metadata, created_at, updated_at FROM sprints WHERE id = ?",
        (sprint_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.get("/{sprint_id}/board")
async def sprint_board(sprint_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id, name FROM sprints WHERE id = ?", (sprint_id,))
    sprint = await cursor.fetchone()
    if sprint is None:
        raise HTTPException(status_code=404, detail="Sprint not found")

    cursor = await db.execute(
        """
        SELECT t.id, t.title, t.status, t.priority, t.assignee_id,
               t.project_id, t.tags, t.created_at, t.updated_at,
               a.display_name as assignee_name
        FROM tickets t
        LEFT JOIN agents a ON a.id = t.assignee_id
        WHERE t.sprint_id = ?
        ORDER BY
            CASE t.priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
            t.created_at ASC
        """,
        (sprint_id,),
    )
    rows = await cursor.fetchall()

    # Group by status
    board: dict[str, list] = {
        "todo": [],
        "in_progress": [],
        "blocked": [],
        "review": [],
        "done": [],
        "cancelled": [],
    }
    for row in rows:
        d = row_to_dict(row)
        board_status = d.get("status", "todo")
        if board_status in board:
            board[board_status].append(d)
        else:
            board.setdefault(board_status, []).append(d)

    return {
        "sprint_id": sprint_id,
        "sprint_name": sprint["name"],
        "board": board,
        "total": len(rows),
    }
