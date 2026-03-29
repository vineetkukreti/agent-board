"""
Agent Board — Standup routes.

POST /          — agent submits standup for today
GET  /          — list standup entries (filter by date, agent_id, project_id)
GET  /summary   — standups grouped by team for a given date
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

import aiosqlite
from app.database import get_db
from app.middleware.auth import require_auth
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


class StandupCreate(BaseModel):
    agent_id: int
    project_id: Optional[int] = None
    date: Optional[str] = None          # ISO date string; defaults to today
    yesterday: Optional[str] = None
    today: Optional[str] = None
    blockers: Optional[str] = None
    metadata: Optional[str] = "{}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/", status_code=status.HTTP_201_CREATED)
async def submit_standup(
    body: StandupCreate,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    entry_date = body.date or date.today().isoformat()

    # Verify agent exists
    cursor = await db.execute("SELECT id FROM agents WHERE id = ?", (body.agent_id,))
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    try:
        cursor = await db.execute(
            """
            INSERT INTO standup_entries
                (agent_id, project_id, date, yesterday, today, blockers, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(agent_id, project_id, date) DO UPDATE SET
                yesterday = excluded.yesterday,
                today     = excluded.today,
                blockers  = excluded.blockers,
                metadata  = excluded.metadata
            RETURNING id, agent_id, project_id, date, yesterday, today,
                      blockers, metadata, created_at
            """,
            (
                body.agent_id,
                body.project_id,
                entry_date,
                body.yesterday,
                body.today,
                body.blockers,
                body.metadata or "{}",
            ),
        )
        row = await cursor.fetchone()
        await log_activity(
            db,
            event_type="standup.submitted",
            entity_type="standup_entry",
            entity_id=row["id"],
            agent_id=body.agent_id,
            project_id=body.project_id,
            old_value=None,
            new_value=entry_date,
            summary=f"Agent #{body.agent_id} submitted standup for {entry_date}",
        )
        await db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return row_to_dict(row)


@router.get("/summary")
async def standup_summary(
    standup_date: Optional[str] = Query(None, alias="date"),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Return all standup entries for a given date, grouped by team."""
    target_date = standup_date or date.today().isoformat()

    cursor = await db.execute(
        """
        SELECT se.id, se.agent_id, se.project_id, se.date,
               se.yesterday, se.today, se.blockers, se.created_at,
               a.display_name as agent_name, a.team_id,
               t.name as team_name,
               p.name as project_name
        FROM standup_entries se
        JOIN agents a ON a.id = se.agent_id
        LEFT JOIN teams t ON t.id = a.team_id
        LEFT JOIN projects p ON p.id = se.project_id
        WHERE se.date = ?
        ORDER BY t.name, a.display_name
        """,
        (target_date,),
    )
    rows = await cursor.fetchall()

    # Group by team
    grouped: dict[str, dict] = {}
    for row in rows:
        d = row_to_dict(row)
        team_name = d.get("team_name") or "Unassigned"
        team_id = d.get("team_id")
        if team_name not in grouped:
            grouped[team_name] = {"team_id": team_id, "team_name": team_name, "entries": []}
        grouped[team_name]["entries"].append(d)

    return {
        "date": target_date,
        "teams": list(grouped.values()),
        "total_entries": len(rows),
    }


@router.get("/")
async def list_standups(
    standup_date: Optional[str] = Query(None, alias="date"),
    agent_id: Optional[int] = None,
    project_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
):
    conditions = []
    params: list = []

    if standup_date:
        conditions.append("se.date = ?")
        params.append(standup_date)
    if agent_id is not None:
        conditions.append("se.agent_id = ?")
        params.append(agent_id)
    if project_id is not None:
        conditions.append("se.project_id = ?")
        params.append(project_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_cursor = await db.execute(
        f"SELECT COUNT(*) as cnt FROM standup_entries se {where}", params
    )
    total = (await count_cursor.fetchone())["cnt"]

    offset = (page - 1) * per_page
    cursor = await db.execute(
        f"""
        SELECT se.id, se.agent_id, se.project_id, se.date,
               se.yesterday, se.today, se.blockers, se.metadata, se.created_at,
               a.display_name as agent_name,
               t.name as team_name,
               p.name as project_name
        FROM standup_entries se
        JOIN agents a ON a.id = se.agent_id
        LEFT JOIN teams t ON t.id = a.team_id
        LEFT JOIN projects p ON p.id = se.project_id
        {where}
        ORDER BY se.date DESC, a.display_name
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
