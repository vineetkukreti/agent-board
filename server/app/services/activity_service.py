"""
Agent Board — Activity logging service.

All mutations in the system should call log_activity so we maintain a
full append-only audit trail in the activity_log table.
"""

from __future__ import annotations

import aiosqlite


async def log_activity(
    db: aiosqlite.Connection,
    event_type: str,
    entity_type: str,
    entity_id: int,
    agent_id: int | None,
    project_id: int | None,
    old_value: str | None,
    new_value: str | None,
    summary: str,
) -> None:
    """Insert one row into activity_log.

    This is intentionally fire-and-forget from the caller's perspective —
    it does NOT commit; callers should commit their own transaction so the
    activity row lands in the same atomic write as the mutation it describes.

    Args:
        db:          Active aiosqlite connection (transaction already open).
        event_type:  Verb describing the action, e.g. "ticket.created",
                     "agent.status_changed", "sprint.activated".
        entity_type: Table / domain noun, e.g. "ticket", "agent", "sprint".
        entity_id:   PK of the affected row in that table.
        agent_id:    Agent that caused the event, or None for system events.
        project_id:  Project context for the event, or None if not applicable.
        old_value:   Previous serialised value (e.g. old status string), or None.
        new_value:   New serialised value, or None.
        summary:     Human-readable one-liner, e.g. "Ticket #42 moved to done".
    """
    await db.execute(
        """
        INSERT INTO activity_log
            (event_type, entity_type, entity_id,
             agent_id, project_id,
             old_value, new_value, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_type,
            entity_type,
            entity_id,
            agent_id,
            project_id,
            old_value,
            new_value,
            summary,
        ),
    )
