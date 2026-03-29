"""
Agent Board — Agent routes.

POST /register          — create agent, return id + api_key (shown once)
GET  /                  — list agents with filters and pagination
GET  /{id}              — single agent with ticket counts
PUT  /{id}              — update agent profile
POST /{id}/heartbeat    — update last_seen_at and set status to 'active'
POST /{id}/rotate-key   — generate new API key, invalidate old
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

import aiosqlite
from app.database import get_db
from app.middleware.auth import (
    generate_api_key,
    get_current_admin,
    get_current_agent,
    hash_api_key,
    require_auth,
)
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


class AgentCreate(BaseModel):
    name: str
    display_name: str
    agent_type_id: Optional[int] = None
    team_id: Optional[int] = None
    model: Optional[str] = None
    is_human: bool = False
    avatar_url: Optional[str] = None
    metadata: Optional[str] = "{}"


class AgentUpdate(BaseModel):
    display_name: Optional[str] = None
    agent_type_id: Optional[int] = None
    team_id: Optional[int] = None
    model: Optional[str] = None
    status: Optional[str] = None
    avatar_url: Optional[str] = None
    metadata: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_agent(
    body: AgentCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)

    try:
        cursor = await db.execute(
            """
            INSERT INTO agents
                (name, display_name, agent_type_id, team_id, model,
                 is_human, avatar_url, api_key_hash, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, name, display_name, agent_type_id, team_id,
                      model, status, is_human, avatar_url, metadata,
                      last_seen_at, created_at, updated_at
            """,
            (
                body.name,
                body.display_name,
                body.agent_type_id,
                body.team_id,
                body.model,
                int(body.is_human),
                body.avatar_url,
                key_hash,
                body.metadata or "{}",
            ),
        )
        row = await cursor.fetchone()
        await log_activity(
            db,
            event_type="agent.created",
            entity_type="agent",
            entity_id=row["id"],
            agent_id=None,
            project_id=None,
            old_value=None,
            new_value=body.name,
            summary=f"Agent '{body.display_name}' registered",
        )
        await db.commit()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return {
        "api_key": raw_key,
        "agent": row_to_dict(row),
    }


@router.get("/")
async def list_agents(
    agent_status: Optional[str] = Query(None, alias="status"),
    team_id: Optional[int] = None,
    agent_type_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
):
    conditions = []
    params: list = []

    if agent_status:
        conditions.append("a.status = ?")
        params.append(agent_status)
    if team_id is not None:
        conditions.append("a.team_id = ?")
        params.append(team_id)
    if agent_type_id is not None:
        conditions.append("a.agent_type_id = ?")
        params.append(agent_type_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_cursor = await db.execute(
        f"SELECT COUNT(*) as cnt FROM agents a {where}", params
    )
    total = (await count_cursor.fetchone())["cnt"]

    offset = (page - 1) * per_page
    cursor = await db.execute(
        f"""
        SELECT a.id, a.name, a.display_name, a.agent_type_id, a.team_id,
               a.model, a.status, a.is_human, a.avatar_url, a.metadata,
               a.last_seen_at, a.created_at, a.updated_at,
               at.name as agent_type_name, t.name as team_name
        FROM agents a
        LEFT JOIN agent_types at ON at.id = a.agent_type_id
        LEFT JOIN teams t ON t.id = a.team_id
        {where}
        ORDER BY a.created_at DESC
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


@router.get("/{agent_id}")
async def get_agent(agent_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """
        SELECT a.id, a.name, a.display_name, a.agent_type_id, a.team_id,
               a.model, a.status, a.is_human, a.avatar_url, a.metadata,
               a.last_seen_at, a.created_at, a.updated_at,
               at.name as agent_type_name, t.name as team_name
        FROM agents a
        LEFT JOIN agent_types at ON at.id = a.agent_type_id
        LEFT JOIN teams t ON t.id = a.team_id
        WHERE a.id = ?
        """,
        (agent_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Ticket counts by status
    tc_cursor = await db.execute(
        """
        SELECT status, COUNT(*) as cnt
        FROM tickets
        WHERE assignee_id = ?
        GROUP BY status
        """,
        (agent_id,),
    )
    tc_rows = await tc_cursor.fetchall()
    ticket_counts = {r["status"]: r["cnt"] for r in tc_rows}

    agent = row_to_dict(row)
    agent["ticket_counts"] = ticket_counts
    return agent


@router.put("/{agent_id}")
async def update_agent(
    agent_id: int,
    body: AgentUpdate,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(require_auth),
):
    cursor = await db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    updates = {}
    if body.display_name is not None:
        updates["display_name"] = body.display_name
    if body.agent_type_id is not None:
        updates["agent_type_id"] = body.agent_type_id
    if body.team_id is not None:
        updates["team_id"] = body.team_id
    if body.model is not None:
        updates["model"] = body.model
    if body.status is not None:
        valid = {"active", "idle", "blocked", "offline"}
        if body.status not in valid:
            raise HTTPException(status_code=422, detail=f"status must be one of {valid}")
        updates["status"] = body.status
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url
    if body.metadata is not None:
        updates["metadata"] = body.metadata

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    updates["updated_at"] = "datetime('now')"
    set_clause = ", ".join(
        f"{k} = datetime('now')" if v == "datetime('now')" else f"{k} = ?"
        for k, v in updates.items()
    )
    values = [v for v in updates.values() if v != "datetime('now')"]
    values.append(agent_id)

    await db.execute(
        f"UPDATE agents SET {set_clause} WHERE id = ?",
        values,
    )
    await log_activity(
        db,
        event_type="agent.updated",
        entity_type="agent",
        entity_id=agent_id,
        agent_id=agent_id,
        project_id=None,
        old_value=None,
        new_value=str(updates),
        summary=f"Agent #{agent_id} updated",
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT id, name, display_name, agent_type_id, team_id, model, status, "
        "is_human, avatar_url, metadata, last_seen_at, created_at, updated_at "
        "FROM agents WHERE id = ?",
        (agent_id,),
    )
    return row_to_dict(await cursor.fetchone())


@router.post("/{agent_id}/heartbeat")
async def heartbeat(
    agent_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(require_auth),
):
    cursor = await db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    await db.execute(
        "UPDATE agents SET last_seen_at = datetime('now'), status = 'active', "
        "updated_at = datetime('now') WHERE id = ?",
        (agent_id,),
    )
    await db.commit()
    return {"ok": True, "agent_id": agent_id}


@router.post("/{agent_id}/rotate-key")
async def rotate_key(
    agent_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current: dict = Depends(get_current_admin),
):
    cursor = await db.execute("SELECT id FROM agents WHERE id = ?", (agent_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)

    await db.execute(
        "UPDATE agents SET api_key_hash = ?, updated_at = datetime('now') WHERE id = ?",
        (key_hash, agent_id),
    )
    await log_activity(
        db,
        event_type="agent.key_rotated",
        entity_type="agent",
        entity_id=agent_id,
        agent_id=agent_id,
        project_id=None,
        old_value=None,
        new_value=None,
        summary=f"API key rotated for agent #{agent_id}",
    )
    await db.commit()

    return {"api_key": raw_key, "agent_id": agent_id}
