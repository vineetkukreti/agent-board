"""
Agent Board — Dashboard route.

GET / — single endpoint returning a full system snapshot:
  - agent counts by status
  - ticket counts by status and priority
  - active blockers count + details
  - recent activity (last 20 events)
  - team workload summary
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

import aiosqlite
from app.database import get_db

router = APIRouter()


def row_to_dict(row) -> dict:
    return dict(row) if row is not None else {}


@router.get("/")
async def dashboard(db: aiosqlite.Connection = Depends(get_db)):
    # --- Agent counts by status ---
    cursor = await db.execute(
        "SELECT status, COUNT(*) as cnt FROM agents GROUP BY status"
    )
    agent_rows = await cursor.fetchall()
    agents_by_status = {r["status"]: r["cnt"] for r in agent_rows}

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM agents")
    total_agents = (await cursor.fetchone())["cnt"]

    # --- Ticket counts by status ---
    cursor = await db.execute(
        "SELECT status, COUNT(*) as cnt FROM tickets GROUP BY status"
    )
    ticket_status_rows = await cursor.fetchall()
    tickets_by_status = {r["status"]: r["cnt"] for r in ticket_status_rows}

    # --- Ticket counts by priority ---
    cursor = await db.execute(
        "SELECT priority, COUNT(*) as cnt FROM tickets GROUP BY priority"
    )
    ticket_prio_rows = await cursor.fetchall()
    tickets_by_priority = {r["priority"]: r["cnt"] for r in ticket_prio_rows}

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM tickets")
    total_tickets = (await cursor.fetchone())["cnt"]

    # --- Active blockers ---
    cursor = await db.execute(
        """
        SELECT b.id, b.ticket_id, b.reason, b.created_at,
               t.title as ticket_title,
               t.project_id,
               p.name as project_name,
               a.display_name as assignee_name
        FROM blockers b
        JOIN tickets t ON t.id = b.ticket_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN agents a ON a.id = t.assignee_id
        WHERE b.status = 'active'
        ORDER BY b.created_at DESC
        LIMIT 10
        """
    )
    blocker_rows = await cursor.fetchall()
    active_blockers = [row_to_dict(r) for r in blocker_rows]

    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM blockers WHERE status = 'active'"
    )
    total_active_blockers = (await cursor.fetchone())["cnt"]

    # --- Recent activity (last 20) ---
    cursor = await db.execute(
        """
        SELECT al.id, al.event_type, al.entity_type, al.entity_id,
               al.agent_id, al.project_id, al.old_value, al.new_value,
               al.summary, al.created_at,
               a.display_name as agent_name,
               p.name as project_name
        FROM activity_log al
        LEFT JOIN agents a ON a.id = al.agent_id
        LEFT JOIN projects p ON p.id = al.project_id
        ORDER BY al.created_at DESC
        LIMIT 20
        """
    )
    activity_rows = await cursor.fetchall()
    recent_activity = [row_to_dict(r) for r in activity_rows]

    # --- Team workload summary ---
    cursor = await db.execute(
        """
        SELECT t.id as team_id, t.name as team_name, t.color,
               COUNT(DISTINCT a.id) as member_count,
               COUNT(DISTINCT CASE WHEN tk.status = 'in_progress' THEN tk.id END) as in_progress,
               COUNT(DISTINCT CASE WHEN tk.status = 'blocked' THEN tk.id END) as blocked,
               COUNT(DISTINCT CASE WHEN tk.status = 'review' THEN tk.id END) as review,
               COUNT(DISTINCT CASE WHEN tk.status NOT IN ('done', 'cancelled') THEN tk.id END) as open
        FROM teams t
        LEFT JOIN agents a ON a.team_id = t.id
        LEFT JOIN tickets tk ON tk.assignee_id = a.id
        GROUP BY t.id
        ORDER BY open DESC
        """
    )
    workload_rows = await cursor.fetchall()
    team_workload = [row_to_dict(r) for r in workload_rows]

    # --- Projects summary ---
    cursor = await db.execute(
        """
        SELECT p.id, p.name, p.status,
               COUNT(DISTINCT t.id) as open_tickets
        FROM projects p
        LEFT JOIN tickets t ON t.project_id = p.id
            AND t.status NOT IN ('done', 'cancelled')
        GROUP BY p.id
        ORDER BY open_tickets DESC
        """
    )
    project_rows = await cursor.fetchall()
    projects = [row_to_dict(r) for r in project_rows]

    return {
        "agents": {
            "total": total_agents,
            "by_status": agents_by_status,
        },
        "tickets": {
            "total": total_tickets,
            "by_status": tickets_by_status,
            "by_priority": tickets_by_priority,
        },
        "blockers": {
            "total_active": total_active_blockers,
            "items": active_blockers,
        },
        "recent_activity": recent_activity,
        "team_workload": team_workload,
        "projects": projects,
    }
