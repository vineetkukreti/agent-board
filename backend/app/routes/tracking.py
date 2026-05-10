"""
Tracking API — auto-registration, session management, tool usage, and metrics.

Endpoints:
    POST /tracking/auto-register       — One-call: find/create agent+project+ticket+session
    POST /tracking/sessions/{id}/end   — End a session with token counts
    GET  /tracking/sessions            — List sessions
    POST /tracking/tool-usage          — Log tool usage events (single or batch)
    GET  /tracking/tickets/{id}/metrics — Aggregated metrics for a ticket
    GET  /tracking/agents/{id}/metrics  — Aggregated metrics for an agent
    GET  /tracking/overview            — Token usage and cost overview
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import sqlite3

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import require_auth
from app.realtime import broadcast

router = APIRouter()

# Load pricing config
PRICING_FILE = Path(__file__).parent.parent.parent / "config" / "pricing.json"
PRICING = {}
if PRICING_FILE.exists():
    PRICING = json.loads(PRICING_FILE.read_text())


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _calc_cost(model: str, input_t: int, output_t: int, cache_read: int = 0, cache_write: int = 0) -> float:
    """Calculate USD cost from token counts."""
    models = PRICING.get("models", {})
    # Try exact match, then partial match
    rates = models.get(model)
    if not rates:
        for key, val in models.items():
            if key in (model or ""):
                rates = val
                break
    if not rates:
        rates = models.get(PRICING.get("default_model", "claude-sonnet-4-6"), {})
    if not rates:
        return 0.0

    cost = (
        (input_t / 1_000_000) * rates.get("input_per_1m", 0)
        + (output_t / 1_000_000) * rates.get("output_per_1m", 0)
        + (cache_read / 1_000_000) * rates.get("cache_read_per_1m", 0)
        + (cache_write / 1_000_000) * rates.get("cache_write_per_1m", 0)
    )
    return round(cost, 6)


def _cwd_to_project_slug(cwd: str) -> str:
    """Extract a project slug from a working directory path.
    Handles subdirs like backend/, frontend/, src/ by going up to the project root."""
    SUBDIR_NAMES = {"server", "client", "src", "app", "backend", "frontend", "api", "web", "packages", "libs"}
    parts = cwd.rstrip("/").split("/")
    slug = parts[-1].lower() if parts else "unknown"
    # If the last part looks like a common subdir, use the parent
    if slug in SUBDIR_NAMES and len(parts) >= 2:
        slug = parts[-2].lower()
    return slug


def _cwd_to_project_name(cwd: str) -> str:
    """Extract a project name from a working directory path."""
    slug = _cwd_to_project_slug(cwd)
    return slug.replace("-", " ").replace("_", " ").title()


def _detect_tech_stack(cwd: str) -> list[str]:
    """Quick tech stack detection from file presence in a directory. Lightweight and fast."""
    import os

    tech = []
    indicators = {
        "package.json": "JavaScript/Node.js",
        "tsconfig.json": "TypeScript",
        "pyproject.toml": "Python",
        "requirements.txt": "Python",
        "setup.py": "Python",
        "Cargo.toml": "Rust",
        "go.mod": "Go",
        "Gemfile": "Ruby",
        "pom.xml": "Java",
        "build.gradle": "Java/Gradle",
        "Dockerfile": "Docker",
        "docker-compose.yml": "Docker Compose",
        "docker-compose.yaml": "Docker Compose",
        "next.config.js": "Next.js",
        "next.config.ts": "Next.js",
        "next.config.mjs": "Next.js",
        "vite.config.js": "Vite",
        "vite.config.ts": "Vite",
        "angular.json": "Angular",
        "tailwind.config.js": "TailwindCSS",
        "tailwind.config.ts": "TailwindCSS",
    }
    try:
        for filename, tech_name in indicators.items():
            if os.path.exists(os.path.join(cwd, filename)):
                if tech_name not in tech:
                    tech.append(tech_name)
    except OSError:
        pass
    return tech


def _row_to_dict(row: aiosqlite.Row) -> dict:
    return dict(row) if row else {}


# ─── Models ────────────────────────────────────────────────────────────────────


class AutoRegisterRequest(BaseModel):
    agent_name: str
    task_title: str = ""
    task_description: str = ""
    cwd: str = ""
    session_id: str = ""
    model: Optional[str] = None


class EndSessionRequest(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    summary: str = ""
    status: str = "completed"


class ToolUsageEvent(BaseModel):
    session_id: Optional[str] = None
    tool_name: str
    file_path: Optional[str] = None
    command: Optional[str] = None
    lines_added: int = 0
    lines_removed: int = 0
    duration_ms: Optional[int] = None
    is_error: bool = False
    error_message: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0


class ToolUsageBatch(BaseModel):
    events: list[ToolUsageEvent]


# ─── Smart Sprint Resolution ───────────────────────────────────────────────────


async def _resolve_sprint_id(
    db: aiosqlite.Connection,
    project_id: int | None,
    task_description: str,
    cwd: str,
    now: str,
) -> int | None:
    """
    Multi-strategy sprint resolution. Tries in order:
    1. Parse sprint reference from task description (e.g., "Sprint 2, Task T3")
    2. Active sprint for the project
    3. Most recent planning sprint (just created, not yet activated)
    4. Auto-create a default sprint if none exists
    """
    if not project_id:
        return None

    # Strategy 1: Parse task description for sprint reference
    if task_description:
        sprint_match = re.search(r'(?:sprint|SPRINT)[_\s-]*(\d+)', task_description)
        if sprint_match:
            sprint_num = sprint_match.group(1)
            cursor = await db.execute(
                "SELECT id FROM sprints WHERE project_id = ? AND (name LIKE ? OR name LIKE ?)",
                (project_id, f"%Sprint {sprint_num}%", f"%sprint{sprint_num}%"),
            )
            row = await cursor.fetchone()
            if row:
                return row["id"]

    # Strategy 2: Active sprint for the project
    cursor = await db.execute(
        "SELECT id FROM sprints WHERE project_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        (project_id,),
    )
    row = await cursor.fetchone()
    if row:
        return row["id"]

    # Strategy 3: Most recent planning sprint (just created, not yet activated)
    cursor = await db.execute(
        "SELECT id FROM sprints WHERE project_id = ? AND status = 'planning' ORDER BY created_at DESC LIMIT 1",
        (project_id,),
    )
    row = await cursor.fetchone()
    if row:
        return row["id"]

    # Strategy 4: Scan filesystem for SPRINT_*.md and ingest inline
    # Check cwd AND parent dirs (agents often run from subdirs like backend/ or frontend/)
    if cwd:
        from pathlib import Path as FsPath
        search_dirs = [FsPath(cwd)]
        # Walk up to 3 parents to find sprint files (e.g., backend/ -> project root)
        p = FsPath(cwd).parent
        for _ in range(3):
            if p == p.parent:
                break
            search_dirs.append(p)
            p = p.parent

        sprint_files = []
        for d in search_dirs:
            sprint_files.extend(d.glob("SPRINT_*.md"))
        sprint_files = sorted(set(sprint_files), key=lambda f: f.stat().st_mtime, reverse=True)
        if sprint_files:
            try:
                # Import the parser
                import importlib.util
                spec = importlib.util.spec_from_file_location(
                    "ingest", str(FsPath(__file__).parent.parent.parent.parent / "tools" / "ingest_sprint.py")
                )
                if spec and spec.loader:
                    mod = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(mod)
                    sprint_data = mod.parse_sprint_md(str(sprint_files[0]))
                    if sprint_data.get("name"):
                        cursor = await db.execute(
                            "INSERT INTO sprints (name, goal, project_id, status, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)",
                            (sprint_data["name"], sprint_data.get("goal", ""), project_id,
                             sprint_data.get("start_date", ""), sprint_data.get("end_date", ""), now, now),
                        )
                        return cursor.lastrowid
            except Exception:
                pass

    # Strategy 5: Auto-create a default sprint
    cursor = await db.execute(
        "SELECT name FROM projects WHERE id = ?", (project_id,)
    )
    proj_row = await cursor.fetchone()
    project_name = proj_row["name"] if proj_row else "Unknown"
    today = now[:10]

    cursor = await db.execute(
        "INSERT INTO sprints (name, goal, project_id, status, start_date, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?)",
        (f"Auto Sprint — {project_name}", "Auto-created for incoming agent tickets", project_id, today, now, now),
    )
    return cursor.lastrowid


# ─── Auto-Register ─────────────────────────────────────────────────────────────


@router.post("/auto-register", status_code=status.HTTP_201_CREATED)
async def auto_register(
    body: AutoRegisterRequest,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """
    Atomic one-call: find-or-create agent, project, ticket, and session.
    Used by hooks to register everything in a single API call.
    """
    now = _now()

    # 1. Find or create agent
    cursor = await db.execute("SELECT id FROM agents WHERE name = ?", (body.agent_name,))
    row = await cursor.fetchone()
    if row:
        agent_id = row["id"]
    else:
        display_name = body.agent_name.replace("-", " ").title()
        cursor = await db.execute(
            "INSERT INTO agents (name, display_name, model, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)",
            (body.agent_name, display_name, body.model or "claude-sonnet-4-6", now, now),
        )
        agent_id = cursor.lastrowid

    # Send heartbeat
    await db.execute(
        "UPDATE agents SET status = 'active', last_seen_at = ? WHERE id = ?",
        (now, agent_id),
    )

    # 2. Find or create project from cwd
    project_id = None
    if body.cwd:
        slug = _cwd_to_project_slug(body.cwd)
        cursor = await db.execute("SELECT id FROM projects WHERE slug = ?", (slug,))
        row = await cursor.fetchone()
        if row:
            project_id = row["id"]
        else:
            name = _cwd_to_project_name(body.cwd)
            # Detect tech stack from file extensions in the cwd
            tech_stack = _detect_tech_stack(body.cwd)
            project_metadata = json.dumps({
                "cwd": body.cwd,
                "tech_stack": tech_stack,
                "auto_registered": True,
            })
            description = f"Auto-detected from {body.cwd}"
            if tech_stack:
                description += f"\nTech stack: {', '.join(tech_stack)}"
            cursor = await db.execute(
                "INSERT INTO projects (name, slug, description, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (name, slug, description, project_metadata, now, now),
            )
            project_id = cursor.lastrowid

    # 2b. Smart sprint resolution — chain of strategies
    sprint_id = await _resolve_sprint_id(db, project_id, body.task_description, body.cwd, now)

    # 3. Create ticket from task description
    ticket_id = None
    if body.task_description or body.task_title:
        # Use task_title (short 3-5 word summary from Agent description field) if available
        if body.task_title:
            title = body.task_title.strip()[:120]
        else:
            # Fallback: extract from task_description
            raw = body.task_description.strip().split('\n')[0].strip()
            raw = re.sub(r'^(you are \w+[.,]?\s*|your (task|job) is to\s*)', '', raw, flags=re.IGNORECASE).strip()
            title = raw[:80] + ('...' if len(raw) > 80 else '')

        # Build a rich description
        project_name = _cwd_to_project_name(body.cwd) if body.cwd else "Unknown"
        desc_parts = [f"**Agent**: {body.agent_name}", f"**Project**: {project_name}"]
        if body.cwd:
            desc_parts.append(f"**Working Directory**: `{body.cwd}`")
        if body.task_description:
            # Show first 300 chars of the prompt as context
            prompt_preview = body.task_description[:300]
            if len(body.task_description) > 300:
                prompt_preview += "..."
            desc_parts.append(f"\n**Task Details**:\n{prompt_preview}")
        description = "\n".join(desc_parts)

        cursor = await db.execute(
            """INSERT INTO tickets (title, description, status, priority, project_id, assignee_id, sprint_id, created_at, updated_at)
               VALUES (?, ?, 'in_progress', 'p2', ?, ?, ?, ?, ?)""",
            (title, description, project_id, agent_id, sprint_id, now, now),
        )
        ticket_id = cursor.lastrowid

    # 4. Create session
    session_id = body.session_id or f"{body.agent_name}-{int(datetime.now(timezone.utc).timestamp())}"
    try:
        cursor = await db.execute(
            """INSERT INTO agent_sessions (session_id, agent_id, ticket_id, project_id, cwd, task_description, status, started_at)
               VALUES (?, ?, ?, ?, ?, ?, 'active', ?)""",
            (session_id, agent_id, ticket_id, project_id, body.cwd, body.task_description, now),
        )
        db_session_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        # Session already exists (UNIQUE constraint) — update it
        await db.execute(
            "UPDATE agent_sessions SET agent_id=?, ticket_id=?, status='active' WHERE session_id=?",
            (agent_id, ticket_id, session_id),
        )
        cursor = await db.execute("SELECT id FROM agent_sessions WHERE session_id=?", (session_id,))
        row = await cursor.fetchone()
        db_session_id = row["id"] if row else None

    await db.commit()

    await broadcast("session.started", {
        "agent_id": agent_id,
        "agent_name": body.agent_name,
        "project_id": project_id,
        "ticket_id": ticket_id,
        "session_id": session_id,
    })

    return {
        "agent_id": agent_id,
        "project_id": project_id,
        "ticket_id": ticket_id,
        "session_id": session_id,
        "db_session_id": db_session_id,
    }


# ─── Sessions ──────────────────────────────────────────────────────────────────


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    body: EndSessionRequest,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """End a session, record token counts, update ticket metrics."""
    now = _now()

    cursor = await db.execute(
        "SELECT id, agent_id, ticket_id, started_at FROM agent_sessions WHERE session_id = ?",
        (session_id,),
    )
    session = await cursor.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get agent model for cost calc
    model = "claude-sonnet-4-6"
    if session["agent_id"]:
        c = await db.execute("SELECT model FROM agents WHERE id = ?", (session["agent_id"],))
        r = await c.fetchone()
        if r and r["model"]:
            model = r["model"]

    cost = _calc_cost(model, body.input_tokens, body.output_tokens, body.cache_read_tokens, body.cache_write_tokens)

    # Update session
    await db.execute(
        """UPDATE agent_sessions
           SET status=?, input_tokens=?, output_tokens=?, cache_read_tokens=?, cache_write_tokens=?,
               total_cost_usd=?, summary=?, ended_at=?
           WHERE session_id=?""",
        (body.status, body.input_tokens, body.output_tokens, body.cache_read_tokens,
         body.cache_write_tokens, cost, body.summary, now, session_id),
    )

    # Update ticket metrics
    ticket_id = session["ticket_id"]
    if ticket_id:
        duration = 0
        if session["started_at"]:
            try:
                start = datetime.strptime(session["started_at"], "%Y-%m-%d %H:%M:%S")
                end = datetime.strptime(now, "%Y-%m-%d %H:%M:%S")
                duration = int((end - start).total_seconds())
            except Exception:
                pass

        await db.execute(
            """INSERT INTO ticket_metrics (ticket_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                   total_cost_usd, duration_seconds, session_count, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
               ON CONFLICT(ticket_id) DO UPDATE SET
                   input_tokens = input_tokens + excluded.input_tokens,
                   output_tokens = output_tokens + excluded.output_tokens,
                   cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
                   cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens,
                   total_cost_usd = total_cost_usd + excluded.total_cost_usd,
                   duration_seconds = duration_seconds + excluded.duration_seconds,
                   session_count = session_count + 1,
                   updated_at = excluded.updated_at""",
            (ticket_id, body.input_tokens, body.output_tokens, body.cache_read_tokens,
             body.cache_write_tokens, cost, duration, now),
        )

        # Close ticket if session completed
        if body.status == "completed":
            await db.execute(
                "UPDATE tickets SET status='done', close_summary=?, closed_at=?, updated_at=? WHERE id=? AND status != 'done'",
                (body.summary or "Completed by agent", now, now, ticket_id),
            )

            # Auto-complete sprint if all tickets are done
            cursor = await db.execute("SELECT sprint_id FROM tickets WHERE id = ?", (ticket_id,))
            t_row = await cursor.fetchone()
            if t_row and t_row["sprint_id"]:
                s_id = t_row["sprint_id"]
                cursor = await db.execute(
                    "SELECT COUNT(*) as remaining FROM tickets WHERE sprint_id = ? AND status NOT IN ('done', 'cancelled')",
                    (s_id,),
                )
                r = await cursor.fetchone()
                if r and r["remaining"] == 0:
                    await db.execute(
                        "UPDATE sprints SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'active'",
                        (now, s_id),
                    )

    await db.commit()

    await broadcast("session.ended", {
        "session_id": session_id,
        "agent_id": session["agent_id"],
        "ticket_id": ticket_id,
        "status": body.status,
        "cost_usd": cost,
    })

    return {"ok": True, "cost_usd": cost, "session_id": session_id}


@router.get("/sessions")
async def list_sessions(
    agent_id: Optional[int] = None,
    project_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """List sessions with optional filters."""
    query = """
        SELECT s.*, a.name as agent_name, a.display_name as agent_display_name,
               p.name as project_name, t.title as ticket_title
        FROM agent_sessions s
        LEFT JOIN agents a ON a.id = s.agent_id
        LEFT JOIN projects p ON p.id = s.project_id
        LEFT JOIN tickets t ON t.id = s.ticket_id
        WHERE 1=1
    """
    params = []
    if agent_id:
        query += " AND s.agent_id = ?"
        params.append(agent_id)
    if project_id:
        query += " AND s.project_id = ?"
        params.append(project_id)
    if status_filter:
        query += " AND s.status = ?"
        params.append(status_filter)
    query += " ORDER BY s.started_at DESC LIMIT ?"
    params.append(limit)

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return {"data": [_row_to_dict(r) for r in rows]}


# ─── Tool Usage ────────────────────────────────────────────────────────────────


@router.post("/tool-usage", status_code=status.HTTP_201_CREATED)
async def log_tool_usage(
    body: ToolUsageBatch,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """Log one or more tool usage events."""
    now = _now()
    count = 0

    for event in body.events:
        # Resolve session to get agent_id and ticket_id
        agent_id = None
        ticket_id = None
        db_session_id = None

        if event.session_id:
            cursor = await db.execute(
                "SELECT id, agent_id, ticket_id FROM agent_sessions WHERE session_id = ?",
                (event.session_id,),
            )
            row = await cursor.fetchone()
            if row:
                db_session_id = row["id"]
                agent_id = row["agent_id"]
                ticket_id = row["ticket_id"]

        await db.execute(
            """INSERT INTO tool_usage_log
               (session_id, ticket_id, agent_id, tool_name, file_path, command,
                lines_added, lines_removed, duration_ms, is_error, error_message,
                input_tokens, output_tokens, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (db_session_id, ticket_id, agent_id, event.tool_name, event.file_path,
             event.command, event.lines_added, event.lines_removed, event.duration_ms,
             1 if event.is_error else 0, event.error_message,
             event.input_tokens, event.output_tokens, now),
        )
        count += 1

        # Update ticket metrics incrementally
        if ticket_id:
            tools_json = json.dumps({event.tool_name: 1})
            files_json = json.dumps([event.file_path] if event.file_path else [])
            await db.execute(
                """INSERT INTO ticket_metrics (ticket_id, lines_added, lines_removed, error_count, tools_used, files_modified, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(ticket_id) DO UPDATE SET
                       lines_added = lines_added + excluded.lines_added,
                       lines_removed = lines_removed + excluded.lines_removed,
                       error_count = error_count + excluded.error_count,
                       updated_at = excluded.updated_at""",
                (ticket_id, event.lines_added, event.lines_removed,
                 1 if event.is_error else 0, tools_json, files_json, now),
            )

    await db.commit()
    return {"logged": count}


# ─── Metrics ───────────────────────────────────────────────────────────────────


@router.get("/tickets/{ticket_id}/metrics")
async def get_ticket_metrics(
    ticket_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """Get aggregated metrics for a ticket."""
    cursor = await db.execute("SELECT * FROM ticket_metrics WHERE ticket_id = ?", (ticket_id,))
    row = await cursor.fetchone()
    if not row:
        return {"ticket_id": ticket_id, "input_tokens": 0, "output_tokens": 0, "total_cost_usd": 0}

    metrics = _row_to_dict(row)

    # Get tool usage breakdown
    cursor = await db.execute(
        "SELECT tool_name, COUNT(*) as count FROM tool_usage_log WHERE ticket_id = ? GROUP BY tool_name ORDER BY count DESC",
        (ticket_id,),
    )
    tools = {r["tool_name"]: r["count"] for r in await cursor.fetchall()}
    metrics["tools_breakdown"] = tools

    # Get files touched
    cursor = await db.execute(
        "SELECT DISTINCT file_path FROM tool_usage_log WHERE ticket_id = ? AND file_path IS NOT NULL",
        (ticket_id,),
    )
    metrics["files_list"] = [r["file_path"] for r in await cursor.fetchall()]

    # Get sessions for this ticket
    cursor = await db.execute(
        "SELECT session_id, status, input_tokens, output_tokens, total_cost_usd, started_at, ended_at FROM agent_sessions WHERE ticket_id = ?",
        (ticket_id,),
    )
    metrics["sessions"] = [_row_to_dict(r) for r in await cursor.fetchall()]

    return metrics


@router.get("/agents/{agent_id}/metrics")
async def get_agent_metrics(
    agent_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """Get aggregated metrics across all tickets for an agent."""
    cursor = await db.execute(
        """SELECT
               COUNT(DISTINCT s.ticket_id) as tickets_worked,
               COUNT(DISTINCT s.id) as total_sessions,
               COALESCE(SUM(s.input_tokens), 0) as input_tokens,
               COALESCE(SUM(s.output_tokens), 0) as output_tokens,
               COALESCE(SUM(s.cache_read_tokens), 0) as cache_read_tokens,
               COALESCE(SUM(s.total_cost_usd), 0) as total_cost_usd
           FROM agent_sessions s WHERE s.agent_id = ?""",
        (agent_id,),
    )
    row = await cursor.fetchone()
    metrics = _row_to_dict(row) if row else {}
    metrics["agent_id"] = agent_id

    # Tool usage breakdown
    cursor = await db.execute(
        "SELECT tool_name, COUNT(*) as count FROM tool_usage_log WHERE agent_id = ? GROUP BY tool_name ORDER BY count DESC",
        (agent_id,),
    )
    metrics["tools_breakdown"] = {r["tool_name"]: r["count"] for r in await cursor.fetchall()}

    # Recent sessions
    cursor = await db.execute(
        """SELECT session_id, ticket_id, status, input_tokens, output_tokens, total_cost_usd, started_at, ended_at, task_description
           FROM agent_sessions WHERE agent_id = ? ORDER BY started_at DESC LIMIT 20""",
        (agent_id,),
    )
    metrics["recent_sessions"] = [_row_to_dict(r) for r in await cursor.fetchall()]

    return metrics


@router.get("/overview")
async def tracking_overview(
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """Token usage, cost, and session overview."""
    # Total tokens and cost
    cursor = await db.execute(
        """SELECT
               COUNT(*) as total_sessions,
               SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active_sessions,
               COALESCE(SUM(input_tokens), 0) as total_input_tokens,
               COALESCE(SUM(output_tokens), 0) as total_output_tokens,
               COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens,
               COALESCE(SUM(total_cost_usd), 0) as total_cost_usd
           FROM agent_sessions"""
    )
    totals = _row_to_dict(await cursor.fetchone())

    # Today's stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cursor = await db.execute(
        """SELECT
               COUNT(*) as sessions_today,
               COALESCE(SUM(input_tokens), 0) as input_tokens_today,
               COALESCE(SUM(output_tokens), 0) as output_tokens_today,
               COALESCE(SUM(total_cost_usd), 0) as cost_today
           FROM agent_sessions WHERE started_at >= ?""",
        (today,),
    )
    today_stats = _row_to_dict(await cursor.fetchone())

    # Top agents by cost
    cursor = await db.execute(
        """SELECT a.name, a.display_name, SUM(s.total_cost_usd) as cost, SUM(s.input_tokens + s.output_tokens) as tokens
           FROM agent_sessions s JOIN agents a ON a.id = s.agent_id
           GROUP BY s.agent_id ORDER BY cost DESC LIMIT 10"""
    )
    top_agents = [_row_to_dict(r) for r in await cursor.fetchall()]

    # Top projects by cost
    cursor = await db.execute(
        """SELECT p.name, SUM(s.total_cost_usd) as cost, SUM(s.input_tokens + s.output_tokens) as tokens
           FROM agent_sessions s JOIN projects p ON p.id = s.project_id
           GROUP BY s.project_id ORDER BY cost DESC LIMIT 10"""
    )
    top_projects = [_row_to_dict(r) for r in await cursor.fetchall()]

    return {
        **totals,
        "today": today_stats,
        "top_agents": top_agents,
        "top_projects": top_projects,
    }


# ─── Changes & Trace ─────────────────────────────────────────────────────────


@router.get("/tickets/{ticket_id}/changes")
async def get_ticket_changes(
    ticket_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """Get file-level change summary for a ticket."""
    cursor = await db.execute(
        """SELECT tool_name, file_path, lines_added, lines_removed, created_at
           FROM tool_usage_log
           WHERE ticket_id = ? AND tool_name IN ('Edit', 'Write') AND file_path IS NOT NULL
           ORDER BY created_at""",
        (ticket_id,),
    )
    rows = await cursor.fetchall()

    files: dict = {}
    total_added = 0
    total_removed = 0
    for r in rows:
        fp = r["file_path"]
        if fp not in files:
            files[fp] = {"path": fp, "lines_added": 0, "lines_removed": 0, "changes": []}
        files[fp]["lines_added"] += r["lines_added"]
        files[fp]["lines_removed"] += r["lines_removed"]
        files[fp]["changes"].append({
            "tool": r["tool_name"],
            "lines_added": r["lines_added"],
            "lines_removed": r["lines_removed"],
            "timestamp": r["created_at"],
        })
        total_added += r["lines_added"]
        total_removed += r["lines_removed"]

    return {"files": list(files.values()), "total_added": total_added, "total_removed": total_removed}


@router.get("/tickets/{ticket_id}/trace")
async def get_ticket_trace(
    ticket_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    _current=Depends(require_auth),
):
    """Get full session trace (all tool calls) for a ticket."""
    cursor = await db.execute(
        """SELECT tool_name, file_path, command, lines_added, lines_removed,
                  duration_ms, is_error, error_message, created_at
           FROM tool_usage_log WHERE ticket_id = ? ORDER BY created_at""",
        (ticket_id,),
    )
    rows = await cursor.fetchall()
    steps = []
    total_errors = 0
    total_duration = 0
    for r in rows:
        step = _row_to_dict(r)
        steps.append(step)
        if r["is_error"]:
            total_errors += 1
        total_duration += r["duration_ms"] or 0

    return {
        "steps": steps,
        "total_steps": len(steps),
        "total_errors": total_errors,
        "total_duration_ms": total_duration,
    }
