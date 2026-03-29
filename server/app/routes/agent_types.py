"""
Agent Board — Agent Type routes.

Full CRUD for the agent_types table.

GET    /         — list all agent types
POST   /         — create agent type
GET    /{id}     — single agent type
PUT    /{id}     — update agent type
DELETE /{id}     — delete agent type (fails if agents reference it)
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


class AgentTypeCreate(BaseModel):
    name: str
    slug: str
    category: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[str] = "{}"


class AgentTypeUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    metadata: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/")
async def list_agent_types(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, name, slug, category, description, metadata, created_at "
        "FROM agent_types ORDER BY category, name"
    )
    rows = await cursor.fetchall()
    return {"data": [row_to_dict(r) for r in rows]}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_agent_type(
    body: AgentTypeCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    try:
        cursor = await db.execute(
            """
            INSERT INTO agent_types (name, slug, category, description, metadata)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id, name, slug, category, description, metadata, created_at
            """,
            (body.name, body.slug, body.category, body.description, body.metadata or "{}"),
        )
        row = await cursor.fetchone()
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return row_to_dict(row)


@router.get("/{type_id}")
async def get_agent_type(type_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, name, slug, category, description, metadata, created_at "
        "FROM agent_types WHERE id = ?",
        (type_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Agent type not found")
    return row_to_dict(row)


@router.put("/{type_id}")
async def update_agent_type(
    type_id: int,
    body: AgentTypeUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id FROM agent_types WHERE id = ?", (type_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Agent type not found")

    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.slug is not None:
        updates["slug"] = body.slug
    if body.category is not None:
        updates["category"] = body.category
    if body.description is not None:
        updates["description"] = body.description
    if body.metadata is not None:
        updates["metadata"] = body.metadata

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [type_id]

    try:
        await db.execute(
            f"UPDATE agent_types SET {set_clause} WHERE id = ?", values
        )
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    cursor = await db.execute(
        "SELECT id, name, slug, category, description, metadata, created_at "
        "FROM agent_types WHERE id = ?",
        (type_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent_type(
    type_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id FROM agent_types WHERE id = ?", (type_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Agent type not found")

    # Check for dependent agents
    ref_cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM agents WHERE agent_type_id = ?", (type_id,)
    )
    ref_row = await ref_cursor.fetchone()
    if ref_row and ref_row["cnt"] > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete: {ref_row['cnt']} agent(s) reference this type",
        )

    await db.execute("DELETE FROM agent_types WHERE id = ?", (type_id,))
    await db.commit()
