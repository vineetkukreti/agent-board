#!/usr/bin/env python3
"""
agent_watcher.py — Auto-detect and register agents every 30 seconds.

Runs as a background daemon. Scans for running Claude Code agents,
registers new ones on Agent Board, and sends heartbeats for existing ones.

Usage:
    python tools/agent_watcher.py                  # foreground
    python tools/agent_watcher.py --daemon          # background (writes to /tmp/agent-watcher.log)
    python tools/agent_watcher.py --interval 10     # custom interval
    python tools/agent_watcher.py --stop            # kill running daemon
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

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
)
from detect_and_register import (
    find_claude_processes,
    detect_running_agents,
    send_heartbeat,
    cwd_to_project_key,
    CLAUDE_PROJECTS_DIR,
)
from project_scanner import scan_project
from ingest_sprint import parse_sprint_md, api as sprint_api

PID_FILE = Path("/tmp/agent-watcher.pid")
LOG_FILE = Path("/tmp/agent-watcher.log")

# Track which projects have been enriched (avoid re-enriching every cycle)
_enriched_projects: set[str] = set()
# Track which sprint files have been ingested
_ingested_sprints: set[str] = set()


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)


def _find_or_create_project(base_url: str, token: str, slug: str, name: str, description: str, metadata: dict) -> int | None:
    """Find a project by slug, or create it. Returns project_id."""
    sc, body = _get(f"{base_url}/api/v1/projects/")
    if sc == 200:
        for p in body.get("data", []):
            if p.get("slug", "").lower() == slug.lower():
                return p["id"]

    # Create project
    payload = {
        "name": name,
        "slug": slug,
        "description": description,
        "metadata": json.dumps(metadata),
    }
    sc, body = _post(f"{base_url}/api/v1/projects/", payload, token)
    if sc == 201:
        return body.get("id")
    return None


def _update_project_metadata(base_url: str, token: str, project_id: int, description: str, metadata: dict) -> bool:
    """Update a project's description and metadata via PUT."""
    import urllib.request
    import urllib.error

    url = f"{base_url}/api/v1/projects/{project_id}"
    payload = {"description": description, "metadata": json.dumps(metadata)}
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def _resolve_agent_id(base_url: str, name: str) -> int | None:
    """Find an agent ID by name."""
    sc, body = _get(f"{base_url}/api/v1/agents/?per_page=200")
    if sc == 200:
        for a in body.get("data", []):
            if a["name"] == name:
                return a["id"]
    return None


def _submit_standup(base_url: str, token: str, agent_id: int, project_id: int | None,
                    yesterday: str, today: str, blockers: str = "") -> bool:
    """Submit a standup entry via the API."""
    from datetime import date as _date
    payload = {
        "agent_id": agent_id,
        "project_id": project_id,
        "date": _date.today().isoformat(),
        "yesterday": yesterday,
        "today": today,
        "blockers": blockers,
    }
    sc, _ = _post(f"{base_url}/api/v1/standups/", payload, token)
    return sc == 201


def enrich_project(base_url: str, token: str, project_cwd: str) -> dict:
    """
    Auto-enrich a project on the board with scanned metadata.

    1. Scans the project directory for metadata
    2. Creates or updates the project on the board
    3. Ingests any new SPRINT_*.md files
    4. Generates standups from recent git activity

    Returns stats about what was done.
    """
    stats = {"enriched": False, "sprints_ingested": 0, "standups_submitted": 0}

    # Skip if already enriched this session
    if project_cwd in _enriched_projects:
        return stats

    project_path = Path(project_cwd)
    if not project_path.is_dir():
        return stats

    # Run the project scanner
    try:
        scan = scan_project(project_cwd)
    except Exception as e:
        log(f"  Scanner error for {project_cwd}: {e}")
        return stats

    slug = scan["slug"]
    name = scan["name"].replace("-", " ").replace("_", " ").title()
    tech_stack = scan["tech_stack"]
    git_info = scan["git"]

    # Build description
    description = scan["description"] or f"Auto-detected from {project_cwd}"
    if tech_stack:
        description = f"{description}\n\nTech stack: {', '.join(tech_stack)}"

    # Build metadata
    metadata = {
        "cwd": project_cwd,
        "tech_stack": tech_stack,
        "git_repo": git_info.get("repo_url", ""),
        "git_branch": git_info.get("branch", ""),
        "last_commit": git_info.get("last_commit", ""),
        "auto_enriched": True,
    }

    # Find or create project
    project_id = _find_or_create_project(base_url, token, slug, name, description, metadata)
    if not project_id:
        log(f"  Could not find/create project for {slug}")
        return stats

    # Update with enriched data
    _update_project_metadata(base_url, token, project_id, description, metadata)
    stats["enriched"] = True
    log(f"  Enriched project: {name} (id={project_id}, stack={', '.join(tech_stack)})")

    # Ingest sprint files
    for sprint_file in scan["sprint_files"]:
        if sprint_file in _ingested_sprints:
            continue
        try:
            sprint_data = parse_sprint_md(sprint_file)
            if sprint_data["tickets"]:
                # Use the ingest_sprint API helper to create the sprint
                sc, body = sprint_api("POST", "/sprints/", {
                    "name": sprint_data["name"] or Path(sprint_file).stem,
                    "goal": sprint_data["goal"],
                    "project_id": project_id,
                    "start_date": sprint_data["start_date"],
                    "end_date": sprint_data["end_date"],
                })
                if sc == 201:
                    sprint_id = body["id"]
                    stats["sprints_ingested"] += 1
                    log(f"  Ingested sprint: {sprint_data['name']} ({len(sprint_data['tickets'])} tickets)")

                    # Create tickets for the sprint
                    for t in sprint_data["tickets"]:
                        assignee_id = None
                        if t.get("assignee_name"):
                            assignee_id = _resolve_agent_id(base_url, t["assignee_name"])

                        ticket_payload = {
                            "title": t["title"],
                            "description": t["description"],
                            "priority": t["priority"],
                            "status": "todo",
                            "project_id": project_id,
                            "sprint_id": sprint_id,
                        }
                        if assignee_id:
                            ticket_payload["assignee_id"] = assignee_id

                        sprint_api("POST", "/tickets/", ticket_payload)
                elif sc == 409:
                    pass  # Sprint already exists, skip
                else:
                    log(f"  Sprint creation failed ({sc}): {body}")

            _ingested_sprints.add(sprint_file)
        except Exception as e:
            log(f"  Sprint ingest error ({sprint_file}): {e}")

    # Generate standups from git activity
    for standup in scan["standups"]:
        author = standup["author"]
        # Try to match author to an agent name (lowercase, strip spaces)
        agent_name = author.lower().replace(" ", "-").split("@")[0]
        agent_id = _resolve_agent_id(base_url, agent_name)
        if not agent_id:
            # Try just first name
            first_name = author.lower().split()[0] if " " in author.lower() else author.lower()
            agent_id = _resolve_agent_id(base_url, first_name)

        if agent_id:
            success = _submit_standup(
                base_url, token, agent_id, project_id,
                yesterday=standup["done"],
                today=standup["doing"],
            )
            if success:
                stats["standups_submitted"] += 1
                log(f"  Auto-standup for {agent_name}: {standup['commits_count']} commits")

    _enriched_projects.add(project_cwd)
    return stats


def scan_and_register(base_url: str, token: str, stale_minutes: int) -> dict:
    """One scan cycle. Returns stats."""
    stats = {"detected": 0, "registered": 0, "heartbeats": 0, "errors": 0,
             "enriched": 0, "sprints_ingested": 0, "standups_submitted": 0}

    # Find running claude processes
    procs = find_claude_processes()
    project_cwds = {p["cwd"] for p in procs}

    # Also scan all known sessions (catches agents that started recently)
    if CLAUDE_PROJECTS_DIR.exists():
        for d in CLAUDE_PROJECTS_DIR.iterdir():
            if d.is_dir() and d.name != "memory":
                cwd = "/" + d.name.lstrip("-").replace("-", "/")
                project_cwds.add(cwd)

    if not project_cwds:
        return stats

    # Enrich new projects
    for cwd in project_cwds:
        if cwd not in _enriched_projects:
            try:
                enrich_stats = enrich_project(base_url, token, cwd)
                if enrich_stats["enriched"]:
                    stats["enriched"] = stats.get("enriched", 0) + 1
                if enrich_stats["sprints_ingested"]:
                    stats["sprints_ingested"] = stats.get("sprints_ingested", 0) + enrich_stats["sprints_ingested"]
                if enrich_stats["standups_submitted"]:
                    stats["standups_submitted"] = stats.get("standups_submitted", 0) + enrich_stats["standups_submitted"]
            except Exception as e:
                log(f"  Enrich error for {cwd}: {e}")

    # Detect named agents from sessions
    running = detect_running_agents(project_cwds, stale_minutes)
    stats["detected"] = len(running)

    if not running:
        return stats

    # Load agent definitions
    all_agents = discover_agents([PROJECT_AGENTS_DIR, GLOBAL_AGENTS_DIR])
    agent_defs = {a["name"]: a for a in all_agents}

    # Get existing agents from board
    already = list_existing_agents(base_url)

    # Load keys
    keys = {}
    if KEYS_FILE.exists():
        try:
            keys = json.loads(KEYS_FILE.read_text())
        except Exception:
            pass

    for ra in running:
        name = ra["agent_name"]

        if name in already:
            # Already registered — just heartbeat
            sc, body = _get(f"{base_url}/api/v1/agents/?per_page=200")
            if sc == 200:
                for agent in body.get("data", []):
                    if agent["name"] == name:
                        if send_heartbeat(base_url, token, agent["id"]):
                            stats["heartbeats"] += 1
                        break
        else:
            # New agent — register it
            agent_def = agent_defs.get(name)
            if agent_def is None:
                agent_def = {
                    "name": name,
                    "display_name": name.replace("-", " ").title(),
                    "description": ra.get("task_description", ""),
                    "model": "sonnet",
                    "tools": [],
                }

            # Ensure teams/types
            needed_teams = {AGENT_TEAMS[name]} if name in AGENT_TEAMS else set()
            needed_types = {AGENT_TYPES[name]} if name in AGENT_TYPES else set()
            team_ids = ensure_teams(base_url, token, needed_teams, False) if needed_teams else {}
            type_ids = ensure_agent_types(base_url, token, needed_types, False) if needed_types else {}

            try:
                api_key = register_agent(base_url, token, agent_def, team_ids, type_ids, False)
                if api_key:
                    keys[name] = api_key
                    stats["registered"] += 1
                    log(f"  NEW AGENT: {name} registered!")

                    # Heartbeat immediately
                    sc, body = _get(f"{base_url}/api/v1/agents/?per_page=200")
                    if sc == 200:
                        for agent in body.get("data", []):
                            if agent["name"] == name:
                                send_heartbeat(base_url, token, agent["id"])
                                stats["heartbeats"] += 1
                                break
            except Exception as e:
                log(f"  ERROR registering {name}: {e}")
                stats["errors"] += 1

    # Save keys if any new ones
    if keys:
        KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
        KEYS_FILE.write_text(json.dumps(keys, indent=2))

    return stats


HOOK_API_KEY = "MM43kZ6ho5cjbSNprP9vjkj8vxgbCpFciWi-og7w0X4"


def run_loop(base_url: str, admin_user: str, admin_pass: str, interval: int, stale_minutes: int) -> None:
    """Main loop — scan every `interval` seconds."""
    log(f"Agent Watcher started (interval={interval}s, board={base_url}, using permanent API key)")
    log(f"Scanning for agents every {interval} seconds...\n")

    token = HOOK_API_KEY

    while True:
        try:
            stats = scan_and_register(base_url, token, stale_minutes)

            if stats["detected"] > 0 or stats["registered"] > 0 or stats["enriched"] > 0:
                parts = [f"{stats['detected']} detected", f"{stats['registered']} new", f"{stats['heartbeats']} heartbeats"]
                if stats["enriched"]:
                    parts.append(f"{stats['enriched']} enriched")
                if stats["sprints_ingested"]:
                    parts.append(f"{stats['sprints_ingested']} sprints")
                if stats["standups_submitted"]:
                    parts.append(f"{stats['standups_submitted']} standups")
                log(f"Scan: {', '.join(parts)}")
            # Silent when nothing found (no spam)

        except KeyboardInterrupt:
            log("Stopped.")
            break
        except Exception as e:
            log(f"Error: {e}")

        time.sleep(interval)


def stop_daemon():
    """Stop a running daemon."""
    if not PID_FILE.exists():
        print("No daemon running (no PID file).")
        return
    pid = int(PID_FILE.read_text().strip())
    try:
        os.kill(pid, signal.SIGTERM)
        print(f"Stopped agent watcher (PID {pid})")
    except ProcessLookupError:
        print(f"Process {pid} not found (already stopped).")
    PID_FILE.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Auto-detect and register agents every N seconds.")
    parser.add_argument("--board-url", default="http://localhost:8001")
    parser.add_argument("--admin-user", default=os.environ.get("BOARD_ADMIN_USER", "admin"))
    parser.add_argument("--admin-pass", default=os.environ.get("BOARD_ADMIN_PASS", "admin"))
    parser.add_argument("--interval", type=int, default=30, help="Scan interval in seconds (default: 30)")
    parser.add_argument("--stale-minutes", type=int, default=30, help="Session staleness threshold (default: 30)")
    parser.add_argument("--daemon", action="store_true", help="Run in background")
    parser.add_argument("--stop", action="store_true", help="Stop running daemon")
    args = parser.parse_args()

    if args.stop:
        stop_daemon()
        return

    if args.daemon:
        # Fork to background
        pid = os.fork()
        if pid > 0:
            PID_FILE.write_text(str(pid))
            print(f"Agent watcher started in background (PID {pid})")
            print(f"  Log: {LOG_FILE}")
            print(f"  Stop: python {__file__} --stop")
            sys.exit(0)
        else:
            # Child — redirect output to log file
            sys.stdout = open(LOG_FILE, "a", buffering=1)
            sys.stderr = sys.stdout
            os.setsid()

    run_loop(args.board_url, args.admin_user, args.admin_pass, args.interval, args.stale_minutes)


if __name__ == "__main__":
    main()
