"""
Agent Board — Team routes.

Full CRUD + member list + workload view.

GET    /                  — list all teams
POST   /                  — create team
GET    /{id}              — single team
PUT    /{id}              — update team
DELETE /{id}              — delete team
GET    /{id}/members      — agents belonging to this team
GET    /{id}/workload     — agent ticket counts for agents in this team
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

import aiosqlite
from app.database import get_db
from app.middleware.auth import get_current_admin

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class TeamCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    color: Optional[str] = None
    metadata: Optional[str] = "{}"


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    metadata: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/")
async def list_teams(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT t.id, t.name, t.slug, t.description, t.color, t.metadata,
               t.created_at, t.updated_at,
               COUNT(a.id) as member_count
        FROM teams t
        LEFT JOIN agents a ON a.team_id = t.id
        GROUP BY t.id
        ORDER BY t.name
        """
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_team(
    body: TeamCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    try:
        cursor = await db.execute(
            """
            INSERT INTO teams (name, slug, description, color, metadata)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id, name, slug, description, color, metadata, created_at, updated_at
            """,
            (body.name, body.slug, body.description, body.color, body.metadata or "{}"),
        )
        row = await cursor.fetchone()
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return row_to_dict(row)


@router.get("/{team_id}")
async def get_team(team_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT t.id, t.name, t.slug, t.description, t.color, t.metadata,
               t.created_at, t.updated_at,
               COUNT(a.id) as member_count
        FROM teams t
        LEFT JOIN agents a ON a.team_id = t.id
        WHERE t.id = ?
        GROUP BY t.id
        """,
        (team_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return row_to_dict(row)


@router.put("/{team_id}")
async def update_team(
    team_id: int,
    body: TeamUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id FROM teams WHERE id = ?", (team_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Team not found")

    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.slug is not None:
        updates["slug"] = body.slug
    if body.description is not None:
        updates["description"] = body.description
    if body.color is not None:
        updates["color"] = body.color
    if body.metadata is not None:
        updates["metadata"] = body.metadata

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    set_parts = [f"{k} = ?" for k in updates] + ["updated_at = datetime('now')"]
    set_clause = ", ".join(set_parts)
    values = list(updates.values()) + [team_id]

    try:
        await db.execute(f"UPDATE teams SET {set_clause} WHERE id = ?", values)
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    cursor = await db.execute(
        "SELECT id, name, slug, description, color, metadata, created_at, updated_at "
        "FROM teams WHERE id = ?",
        (team_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id FROM teams WHERE id = ?", (team_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Team not found")

    await db.execute("DELETE FROM teams WHERE id = ?", (team_id,))
    await db.commit()


@router.get("/{team_id}/members")
async def team_members(team_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM teams WHERE id = ?", (team_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Team not found")

    cursor = await db.execute(
        """
        SELECT a.id, a.name, a.display_name, a.agent_type_id, a.model,
               a.status, a.is_human, a.avatar_url, a.last_seen_at,
               at.name as agent_type_name
        FROM agents a
        LEFT JOIN agent_types at ON at.id = a.agent_type_id
        WHERE a.team_id = ?
        ORDER BY a.display_name
        """,
        (team_id,),
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}


@router.get("/{team_id}/workload")
async def team_workload(team_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM teams WHERE id = ?", (team_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Team not found")

    cursor = await db.execute(
        """
        SELECT a.id, a.name, a.display_name, a.status as agent_status,
               COUNT(t.id) as total_tickets,
               SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo,
               SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
               SUM(CASE WHEN t.status = 'review' THEN 1 ELSE 0 END) as review,
               SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
               SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
        FROM agents a
        LEFT JOIN tickets t ON t.assignee_id = a.id AND t.status NOT IN ('done', 'cancelled')
        WHERE a.team_id = ?
        GROUP BY a.id
        ORDER BY total_tickets DESC
        """,
        (team_id,),
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}
