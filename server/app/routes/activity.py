"""
Agent Board — Activity feed route.

GET / — paginated activity log with filters:
  - project_id
  - agent_id
  - event_type (exact match)
  - since (ISO datetime string, e.g. "2025-01-01T00:00:00")
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

import aiosqlite
from app.database import get_db

router = APIRouter()


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


@router.get("/")
async def list_activity(
    project_id: Optional[int] = None,
    agent_id: Optional[int] = None,
    event_type: Optional[str] = None,
    since: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: aiosqlite.Connection = Depends(get_db),
):
    conditions = []
    params: list = []

    if project_id is not None:
        conditions.append("al.project_id = ?")
        params.append(project_id)
    if agent_id is not None:
        conditions.append("al.agent_id = ?")
        params.append(agent_id)
    if event_type:
        conditions.append("al.event_type = ?")
        params.append(event_type)
    if since:
        conditions.append("al.created_at >= ?")
        params.append(since)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_cursor = await db.execute(
        f"SELECT COUNT(*) as cnt FROM activity_log al {where}", params
    )
    total = (await count_cursor.fetchone())["cnt"]

    offset = (page - 1) * per_page
    cursor = await db.execute(
        f"""
        SELECT al.id, al.event_type, al.entity_type, al.entity_id,
               al.agent_id, al.project_id, al.old_value, al.new_value,
               al.summary, al.created_at,
               a.display_name as agent_name,
               a.name as agent_slug,
               p.name as project_name
        FROM activity_log al
        LEFT JOIN agents a ON a.id = al.agent_id
        LEFT JOIN projects p ON p.id = al.project_id
        {where}
        ORDER BY al.created_at DESC
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
