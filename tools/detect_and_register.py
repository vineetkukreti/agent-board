#!/usr/bin/env python3
"""
detect_and_register.py — Detect running Claude Code agents and auto-register them.

Scans running `claude` processes, finds their active sessions, reads subagent
metadata to identify which named agents are alive, then registers them on
Agent Board and optionally creates tickets from their current tasks.

Usage:
    python tools/detect_and_register.py
    python tools/detect_and_register.py --board-url http://localhost:8001
    python tools/detect_and_register.py --stale-minutes 30
    python tools/detect_and_register.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

# Reuse everything from the existing seed script
from seed_agents import (
    AGENT_TEAMS,
    AGENT_TYPES,
    AGENT_TYPE_DEFINITIONS,
    TEAM_DEFINITIONS,
    PROJECT_AGENTS_DIR,
    GLOBAL_AGENTS_DIR,
    _get,
    _post,
    admin_login,
    discover_agents,
    ensure_agent_types,
    ensure_teams,
    list_existing_agents,
    register_agent,
    KEYS_FILE,
    parse_frontmatter,
)

# Claude Code stores project sessions here
CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"


# ---------------------------------------------------------------------------
# Process detection
# ---------------------------------------------------------------------------


def find_claude_processes() -> list[dict]:
    """
    Find running `claude` processes via /proc.
    Returns list of {pid, cwd, sse_port}.
    """
    procs = []
    proc = Path("/proc")
    if not proc.exists():
        print("  [warn] /proc not available — process detection only works on Linux")
        return procs

    for entry in proc.iterdir():
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        try:
            cmdline = (entry / "cmdline").read_bytes().split(b"\x00")
            exe_name = cmdline[0].decode(errors="replace").split("/")[-1]
            if exe_name != "claude":
                continue

            cwd = str((entry / "cwd").resolve())

            # Try to read SSE port from environment
            sse_port = None
            try:
                env_data = (entry / "environ").read_bytes().split(b"\x00")
                for var in env_data:
                    if var.startswith(b"CLAUDE_CODE_SSE_PORT="):
                        sse_port = var.split(b"=", 1)[1].decode()
                        break
            except PermissionError:
                pass

            procs.append({"pid": pid, "cwd": cwd, "sse_port": sse_port})
        except (PermissionError, FileNotFoundError, ProcessLookupError):
            continue

    return procs


# ---------------------------------------------------------------------------
# Session & subagent discovery
# ---------------------------------------------------------------------------


def cwd_to_project_key(cwd: str) -> str:
    """Convert a CWD path to Claude's project directory name format."""
    # Claude uses the full path with / replaced by - (leading slash becomes leading -)
    return cwd.replace("/", "-")


def find_active_sessions(project_key: str, stale_minutes: int = 60) -> list[Path]:
    """
    Find session JSONL files modified within `stale_minutes` for a project.
    Returns list of session directory paths that have subagents.
    """
    project_dir = CLAUDE_PROJECTS_DIR / project_key
    if not project_dir.exists():
        return []

    cutoff = time.time() - (stale_minutes * 60)
    sessions = []

    for jsonl in project_dir.glob("*.jsonl"):
        if jsonl.stat().st_mtime < cutoff:
            continue
        # Check if there's a matching session directory with subagents
        session_dir = project_dir / jsonl.stem / "subagents"
        if session_dir.exists():
            sessions.append(session_dir)

    return sessions


def detect_running_agents(
    project_cwds: set[str], stale_minutes: int = 60
) -> list[dict]:
    """
    Scan active Claude sessions for named subagents.

    Returns list of {agent_name, task_description, agent_type, session_id, project_cwd}.
    Only returns agents whose agentType matches a known agent name (not generic
    types like "general-purpose" or "Explore").
    """
    # Known generic types that are NOT named agents
    generic_types = {"general-purpose", "Explore", "Plan"}

    found: dict[str, dict] = {}  # agent_name -> best info (dedup)

    for cwd in project_cwds:
        project_key = cwd_to_project_key(cwd)
        sessions = find_active_sessions(project_key, stale_minutes)

        for subagents_dir in sessions:
            session_id = subagents_dir.parent.name

            for meta_file in subagents_dir.glob("*.meta.json"):
                try:
                    meta = json.loads(meta_file.read_text())
                except (json.JSONDecodeError, OSError):
                    continue

                agent_type = meta.get("agentType", "")
                description = meta.get("description", "")

                # Skip generic agent types
                if agent_type in generic_types or not agent_type:
                    continue

                agent_name = agent_type.lower()

                # Check the corresponding JSONL to see if it was recently active
                jsonl_name = meta_file.name.replace(".meta.json", ".jsonl")
                jsonl_path = subagents_dir / jsonl_name
                last_active = None
                if jsonl_path.exists():
                    last_active = jsonl_path.stat().st_mtime

                # Keep the most recently active entry per agent
                if agent_name in found:
                    if last_active and last_active > found[agent_name].get("_mtime", 0):
                        pass  # overwrite below
                    else:
                        continue

                found[agent_name] = {
                    "agent_name": agent_name,
                    "task_description": description,
                    "agent_type": agent_type,
                    "session_id": session_id,
                    "project_cwd": cwd,
                    "_mtime": last_active or 0,
                }

    # Clean up internal fields and return sorted
    results = []
    for info in sorted(found.values(), key=lambda x: x["agent_name"]):
        info.pop("_mtime", None)
        results.append(info)

    return results


# ---------------------------------------------------------------------------
# Heartbeat & ticket creation
# ---------------------------------------------------------------------------


def send_heartbeat(base_url: str, token: str, agent_id: int) -> bool:
    """Send a heartbeat for an agent (marks it active)."""
    sc, _ = _post(f"{base_url}/api/v1/agents/{agent_id}/heartbeat", {}, token)
    return sc == 200


def create_task_ticket(
    base_url: str,
    token: str,
    agent_id: int,
    task_description: str,
    project_id: int | None = None,
) -> int | None:
    """Create a ticket from the agent's detected task. Returns ticket ID or None."""
    payload = {
        "title": task_description,
        "description": f"Auto-detected from running Claude Code agent session.",
        "priority": "medium",
        "assignee_id": agent_id,
        "status": "in_progress",
    }
    if project_id:
        payload["project_id"] = project_id

    sc, resp = _post(f"{base_url}/api/v1/tickets/", payload, token)
    if sc == 201:
        return resp.get("id")
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Detect running Claude agents and register them on Agent Board.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--board-url",
        default="http://localhost:8001",
        help="Base URL of the Agent Board API (default: http://localhost:8001)",
    )
    parser.add_argument(
        "--admin-user",
        default=os.environ.get("BOARD_ADMIN_USER", "admin"),
    )
    parser.add_argument(
        "--admin-pass",
        default=os.environ.get("BOARD_ADMIN_PASS", "admin"),
    )
    parser.add_argument(
        "--stale-minutes",
        type=int,
        default=120,
        help="Consider sessions active if modified within this many minutes (default: 120)",
    )
    parser.add_argument(
        "--project",
        help="Scan a specific project path (e.g. /home/vineet/Desktop/projects/dsa-tracker)",
    )
    parser.add_argument(
        "--all-sessions",
        action="store_true",
        help="Scan all Claude project sessions, not just those with a running process",
    )
    parser.add_argument(
        "--create-tickets",
        action="store_true",
        help="Also create tickets from detected task descriptions",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without making changes",
    )
    args = parser.parse_args()

    base_url = args.board_url.rstrip("/")
    dry_run: bool = args.dry_run

    if dry_run:
        print("DRY RUN — no changes will be made.\n")

    # ── Step 1: Find project directories to scan ────────────────────────
    project_cwds: set[str] = set()

    if args.project:
        # Explicit project path
        p = Path(args.project).resolve()
        if p.exists():
            project_cwds.add(str(p))
            print(f"Targeting project: {p}")
        else:
            print(f"Project path not found: {p}")
            sys.exit(1)
    elif args.all_sessions:
        # Scan all known Claude project directories
        print("Scanning all Claude project sessions...")
        if CLAUDE_PROJECTS_DIR.exists():
            for d in CLAUDE_PROJECTS_DIR.iterdir():
                if d.is_dir() and d.name != "memory":
                    # Convert project key back to path
                    cwd = "/" + d.name.lstrip("-").replace("-", "/")
                    project_cwds.add(cwd)
            print(f"  Found {len(project_cwds)} project(s).")
        else:
            print("  No Claude projects directory found.")
            sys.exit(0)
    else:
        # Default: detect from running processes
        print("Scanning for running Claude processes...")
        procs = find_claude_processes()
        if not procs:
            print("  No running claude processes found.")
            print("  Tip: use --project <path> or --all-sessions to scan without running processes.")
            sys.exit(0)
        for p in procs:
            print(f"  PID {p['pid']} → {p['cwd']}")
            project_cwds.add(p["cwd"])
        print(f"  {len(procs)} process(es) across {len(project_cwds)} project(s).")
    print()

    # ── Step 2: Detect named agents from sessions ─────────────────────
    print(f"Scanning active sessions (last {args.stale_minutes} min)...")
    running_agents = detect_running_agents(project_cwds, args.stale_minutes)

    if not running_agents:
        print("  No named agents detected in active sessions.")
        sys.exit(0)

    print(f"  Detected {len(running_agents)} running agent(s):\n")
    for ra in running_agents:
        print(f"    {ra['agent_name']:20s} │ {ra['task_description']}")
    print()

    # ── Step 3: Load agent definitions (.md files) ────────────────────
    print("Loading agent definitions from .md files...")
    all_agents = discover_agents([PROJECT_AGENTS_DIR, GLOBAL_AGENTS_DIR])
    agent_defs = {a["name"]: a for a in all_agents}
    print(f"  {len(agent_defs)} agent definition(s) loaded.\n")

    # ── Step 4: Admin login ───────────────────────────────────────────
    print(f"Logging in to {base_url}...")
    if dry_run:
        token = "dry-run-token"
        print("  [dry-run] Skipping login.\n")
    else:
        token = admin_login(base_url, args.admin_user, args.admin_pass)
        print("  Login successful.\n")

    # ── Step 5: Ensure teams & types exist ────────────────────────────
    running_names = {ra["agent_name"] for ra in running_agents}

    needed_teams = {AGENT_TEAMS[n] for n in running_names if n in AGENT_TEAMS}
    needed_types = {AGENT_TYPES[n] for n in running_names if n in AGENT_TYPES}

    print(f"Ensuring {len(needed_teams)} team(s) and {len(needed_types)} type(s) exist...")
    team_ids = ensure_teams(base_url, token, needed_teams, dry_run)
    type_ids = ensure_agent_types(base_url, token, needed_types, dry_run)
    print()

    # ── Step 6: Register (or find) agents ─────────────────────────────
    if not dry_run:
        already_registered = list_existing_agents(base_url)
    else:
        already_registered: set[str] = set()

    # Load existing keys
    if KEYS_FILE.exists():
        keys = json.loads(KEYS_FILE.read_text())
    else:
        keys = {}

    registered = 0
    skipped = 0
    heartbeats = 0
    tickets_created = 0

    print("Registering detected agents...")
    for ra in running_agents:
        name = ra["agent_name"]
        agent_def = agent_defs.get(name)

        if agent_def is None:
            # Build a minimal definition from what we know
            agent_def = {
                "name": name,
                "display_name": name.replace("-", " ").title(),
                "description": ra["task_description"],
                "model": "sonnet",
                "tools": [],
            }

        if name in already_registered:
            print(f"  [exists] '{name}' — already registered, sending heartbeat")
            skipped += 1

            if not dry_run:
                # Find agent ID to heartbeat
                sc, body = _get(f"{base_url}/api/v1/agents/?per_page=200")
                if sc == 200:
                    for agent in body.get("data", []):
                        if agent["name"] == name:
                            if send_heartbeat(base_url, token, agent["id"]):
                                heartbeats += 1
                                print(f"           → heartbeat sent (id={agent['id']})")

                            if args.create_tickets and ra["task_description"]:
                                tid = create_task_ticket(
                                    base_url, token, agent["id"],
                                    ra["task_description"],
                                )
                                if tid:
                                    tickets_created += 1
                                    print(f"           → ticket #{tid}: {ra['task_description']}")
                            break
            continue

        # Register new agent
        api_key = register_agent(base_url, token, agent_def, team_ids, type_ids, dry_run)
        if api_key:
            keys[name] = api_key
            registered += 1

            # Immediately heartbeat the freshly registered agent
            if not dry_run:
                sc, body = _get(f"{base_url}/api/v1/agents/?per_page=200")
                if sc == 200:
                    for agent in body.get("data", []):
                        if agent["name"] == name:
                            send_heartbeat(base_url, token, agent["id"])
                            heartbeats += 1
                            print(f"           → heartbeat sent (id={agent['id']})")

                            if args.create_tickets and ra["task_description"]:
                                tid = create_task_ticket(
                                    base_url, token, agent["id"],
                                    ra["task_description"],
                                )
                                if tid:
                                    tickets_created += 1
                                    print(f"           → ticket #{tid}: {ra['task_description']}")
                            break

    # Save keys
    if not dry_run and keys:
        KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
        KEYS_FILE.write_text(json.dumps(keys, indent=2))
        print(f"\nAPI keys saved to: {KEYS_FILE}")

    # Summary
    print(f"""
Done.
  Detected   : {len(running_agents)} running agent(s)
  Registered : {registered} new
  Skipped    : {skipped} (already existed)
  Heartbeats : {heartbeats}
  Tickets    : {tickets_created}
""")


if __name__ == "__main__":
    main()
