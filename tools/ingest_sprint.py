#!/usr/bin/env python3
"""
ingest_sprint.py — Parse a SPRINT_*.md file and create sprint + tickets on Agent Board.

Parses the markdown table format used by Manish/agents to plan sprints,
creates the sprint on the board, registers missing agents, and creates
all tickets with proper assignments.

Usage:
    python tools/ingest_sprint.py /path/to/SPRINT_1.md
    python tools/ingest_sprint.py /path/to/SPRINT_1.md --dry-run
    python tools/ingest_sprint.py /path/to/SPRINT_1.md --activate
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "http://localhost:8001/api/v1"
# Permanent hook API key
API_KEY = "MM43kZ6ho5cjbSNprP9vjkj8vxgbCpFciWi-og7w0X4"

PRIORITY_MAP = {"p0": "p0", "p1": "p1", "p2": "p2", "p3": "p3"}
SIZE_TO_PRIORITY = {"tiny": "p3", "s": "p2", "m": "p1", "l": "p0", "xl": "p0"}


def api(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    """Make an API call. Returns (status_code, response_dict)."""
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {"detail": str(e)}
        return e.code, body
    except Exception as e:
        return -1, {"error": str(e)}


def parse_sprint_md(filepath: str) -> dict:
    """Parse a SPRINT_*.md file into structured data. Handles multiple formats."""
    text = Path(filepath).read_text()

    result = {
        "name": "",
        "goal": "",
        "start_date": "",
        "end_date": "",
        "tickets": [],
    }

    # ── Extract sprint name from H1 ──
    m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    if m:
        result["name"] = m.group(1).strip()

    # ── Extract dates — multiple formats ──
    # Format 1: | Start Date | 2026-03-31 |
    for m in re.finditer(r"\|\s*Start Date\s*\|\s*(\d{4}-\d{2}-\d{2})", text):
        result["start_date"] = m.group(1)
    for m in re.finditer(r"\|\s*End Date\s*\|\s*(\d{4}-\d{2}-\d{2})", text):
        result["end_date"] = m.group(1)

    # Format 2: **Sprint:** 3 days (Mar 30 – Apr 1)  or  (2026-03-30 – 2026-04-01)
    if not result["start_date"]:
        m = re.search(r"\*\*Sprint:\*\*.*?\((.+?)\)", text)
        if m:
            date_range = m.group(1)
            dates = re.findall(r"(\w+\s+\d+)", date_range)
            iso_dates = re.findall(r"(\d{4}-\d{2}-\d{2})", date_range)
            if iso_dates:
                result["start_date"] = iso_dates[0]
                if len(iso_dates) > 1:
                    result["end_date"] = iso_dates[1]
            elif len(dates) >= 2:
                # Convert "Mar 30" style to ISO
                import datetime
                year = "2026"
                ym = re.search(r"(\d{4})", text[:200])
                if ym:
                    year = ym.group(1)
                for i, d in enumerate(dates[:2]):
                    try:
                        dt = datetime.datetime.strptime(f"{d} {year}", "%b %d %Y")
                        if i == 0:
                            result["start_date"] = dt.strftime("%Y-%m-%d")
                        else:
                            result["end_date"] = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        pass

    # Format 3: inline dates like **Date:** 2026-03-30
    if not result["start_date"]:
        m = re.search(r"\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})", text)
        if m:
            result["start_date"] = m.group(1)

    # ── Extract goal — multiple formats ──
    # Format 1: ## North Star followed by **"quote"**
    m = re.search(r'##\s+North Star\s*\n+\*\*"(.+?)"\*\*', text)
    if m:
        result["goal"] = m.group(1).strip()

    # Format 2: ### Problem Statement paragraph
    if not result["goal"]:
        m = re.search(r"###\s+Problem Statement\s*\n+(.+?)(?:\n\n|\n###)", text, re.DOTALL)
        if m:
            result["goal"] = m.group(1).strip()[:300]

    # Format 3: | North Star | value |
    if not result["goal"]:
        m = re.search(r"\|\s*North Star\s*\|\s*(.+?)\s*\|", text)
        if m:
            result["goal"] = m.group(1).strip().strip('"')

    # ── Parse tickets — Format 1: | ID | Title | Description | Squad | Size | Deps | Status |
    current_priority = "p2"
    for line in text.splitlines():
        if re.match(r"###\s+P0", line, re.IGNORECASE):
            current_priority = "p0"
        elif re.match(r"###\s+P1", line, re.IGNORECASE):
            current_priority = "p1"
        elif re.match(r"###\s+P2", line, re.IGNORECASE):
            current_priority = "p2"

        m = re.match(
            r"\|\s*(\w+-\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(\w+)\s*\|",
            line,
        )
        if m:
            ticket_id = m.group(1).strip()
            title = m.group(2).strip()
            description = m.group(3).strip()
            squad = m.group(4).strip()
            size = m.group(5).strip().lower()
            deps = m.group(6).strip()

            lead = ""
            executors = []
            lead_m = re.search(r"Lead:\s*(\w+)", squad)
            if lead_m:
                lead = lead_m.group(1).lower()
            exec_m = re.search(r"Exec(?:utor)?[s]?:\s*(.+?)(?:\||$)", squad)
            if exec_m:
                names = re.findall(r"(\w+)", exec_m.group(1))
                executors = [n.lower() for n in names if n.lower() not in ("and", "parallel", "each", "split", "by", "page")]

            assignee = executors[0] if executors else lead

            result["tickets"].append({
                "external_id": ticket_id,
                "title": f"[{ticket_id}] {title}",
                "description": f"{description}\n\nSquad: {squad}\nSize: {size}\nDependencies: {deps}",
                "priority": current_priority,
                "assignee_name": assignee,
                "lead": lead,
                "executors": executors,
                "status": "todo",
            })

    # ── Parse tickets — Format 2: | Time | Agent | Task | What |
    if not result["tickets"]:
        task_counter = 0
        current_day = ""
        for line in text.splitlines():
            # Detect day headers like "### Day 1 — Monday"
            day_m = re.match(r"###\s+(Day\s+\d+.*)", line)
            if day_m:
                current_day = day_m.group(1).strip()

            # Parse: | AM | Rahul | T1 | Extract compute_retrievability |
            m = re.match(r"\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(T\d+|—)\s*\|\s*(.+?)\s*\|", line)
            if m:
                time_slot = m.group(1).strip()
                agent_name = m.group(2).strip().lower()
                task_id = m.group(3).strip()
                what = m.group(4).strip()

                # Skip header rows and review-only rows
                if time_slot.lower() in ("time", "---") or task_id == "—" or agent_name in ("agent", "---"):
                    continue

                task_counter += 1
                result["tickets"].append({
                    "external_id": task_id,
                    "title": f"[{task_id}] {what[:80]}",
                    "description": f"{what}\n\nDay: {current_day}\nTime: {time_slot}\nAgent: {agent_name}",
                    "priority": "p1",
                    "assignee_name": agent_name,
                    "lead": agent_name,
                    "executors": [agent_name],
                    "status": "todo",
                })

    return result


def resolve_or_create_agent(name: str, existing: dict[str, int]) -> int | None:
    """Find or create an agent, return agent_id."""
    if name in existing:
        return existing[name]

    # Try to find in the API
    sc, body = api("GET", f"/agents/?per_page=200")
    if sc == 200:
        for a in body.get("data", []):
            existing[a["name"]] = a["id"]
            if a["name"] == name:
                return a["id"]

    # Create new agent
    sc, body = api("POST", "/tracking/auto-register", {
        "agent_name": name,
        "task_description": "Auto-registered from sprint plan",
        "cwd": "",
        "session_id": f"sprint-register-{name}",
    })
    if sc == 201:
        agent_id = body.get("agent_id")
        if agent_id:
            existing[name] = agent_id
            # End the dummy session
            api("POST", f"/tracking/sessions/sprint-register-{name}/end", {"status": "completed"})
            return agent_id

    return None


def resolve_project(cwd: str) -> int | None:
    """Find or create project from cwd path."""
    slug = cwd.rstrip("/").split("/")[-1].lower()
    sc, body = api("GET", "/projects/")
    if sc == 200:
        for p in body.get("data", []):
            if p.get("slug", "").lower() == slug or p.get("name", "").lower() == slug:
                return p["id"]

    # Create project
    name = slug.replace("-", " ").replace("_", " ").title()
    sc, body = api("POST", "/projects/", {"name": name, "slug": slug, "description": f"Auto-created from sprint ingest"})
    if sc == 201:
        return body.get("id")
    return None


def main():
    parser = argparse.ArgumentParser(description="Ingest a SPRINT_*.md file into Agent Board")
    parser.add_argument("file", help="Path to the SPRINT markdown file")
    parser.add_argument("--project", default="", help="Project directory path (for project detection)")
    parser.add_argument("--activate", action="store_true", help="Activate the sprint after creation")
    parser.add_argument("--dry-run", action="store_true", help="Parse and print, don't create anything")
    args = parser.parse_args()

    filepath = args.file
    if not Path(filepath).exists():
        print(f"File not found: {filepath}")
        sys.exit(1)

    print(f"Parsing {filepath}...")
    sprint_data = parse_sprint_md(filepath)

    print(f"\n{'='*60}")
    print(f"  Sprint: {sprint_data['name']}")
    print(f"  Goal:   {sprint_data['goal'][:80]}")
    print(f"  Dates:  {sprint_data['start_date']} → {sprint_data['end_date']}")
    print(f"  Tickets: {len(sprint_data['tickets'])}")
    print(f"{'='*60}\n")

    # Count by priority
    by_p = {}
    for t in sprint_data["tickets"]:
        by_p[t["priority"]] = by_p.get(t["priority"], 0) + 1
    for p in sorted(by_p):
        print(f"  {p.upper()}: {by_p[p]} tickets")

    # List agents
    agents_needed = set()
    for t in sprint_data["tickets"]:
        if t["assignee_name"]:
            agents_needed.add(t["assignee_name"])
    print(f"\n  Agents needed: {len(agents_needed)} — {', '.join(sorted(agents_needed))}")

    if args.dry_run:
        print("\n--- DRY RUN — tickets ---")
        for t in sprint_data["tickets"]:
            print(f"  [{t['priority']}] {t['external_id']:10s} {t['title'][:50]:50s} → {t['assignee_name']}")
        return

    # Resolve project
    project_path = args.project or str(Path(filepath).parent)
    project_id = resolve_project(project_path)
    if not project_id:
        print("ERROR: Could not resolve project")
        sys.exit(1)
    print(f"\n  Project ID: {project_id}")

    # Create sprint
    sc, body = api("POST", "/sprints/", {
        "name": sprint_data["name"],
        "goal": sprint_data["goal"],
        "project_id": project_id,
        "start_date": sprint_data["start_date"],
        "end_date": sprint_data["end_date"],
    })
    if sc != 201:
        print(f"ERROR creating sprint: {body}")
        sys.exit(1)
    sprint_id = body["id"]
    print(f"  Sprint ID: {sprint_id}")

    if args.activate:
        api("POST", f"/sprints/{sprint_id}/activate")
        print("  Sprint activated!")

    # Resolve agents
    print("\n  Registering agents...")
    agent_cache: dict[str, int] = {}
    for name in sorted(agents_needed):
        aid = resolve_or_create_agent(name, agent_cache)
        if aid:
            print(f"    {name}: id={aid}")
        else:
            print(f"    {name}: FAILED")

    # Create tickets
    print(f"\n  Creating {len(sprint_data['tickets'])} tickets...")
    created = 0
    failed = 0
    for t in sprint_data["tickets"]:
        assignee_id = agent_cache.get(t["assignee_name"])
        payload = {
            "title": t["title"],
            "description": t["description"],
            "priority": t["priority"],
            "status": "todo",
            "project_id": project_id,
            "sprint_id": sprint_id,
        }
        if assignee_id:
            payload["assignee_id"] = assignee_id

        sc, body = api("POST", "/tickets/", payload)
        if sc == 201:
            created += 1
            print(f"    #{body['id']:3d} [{t['priority']}] {t['title'][:50]} → {t['assignee_name']}")
        else:
            failed += 1
            print(f"    FAIL: {t['title'][:40]} — {body}")

    print(f"\n{'='*60}")
    print(f"  DONE: {created} tickets created, {failed} failed")
    print(f"  Sprint '{sprint_data['name']}' ready on the board!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
