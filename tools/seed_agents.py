#!/usr/bin/env python3
"""
seed_agents.py — Auto-registration script for Agent Board.

Reads all agent .md files from both the project-level and global agent
directories, parses YAML frontmatter, ensures required teams and agent_types
exist, then registers each agent via POST /api/v1/agents/register.

Generated API keys are saved to tools/agent_keys.json. Already-registered
agents are skipped (safe to re-run).

Usage:
    python tools/seed_agents.py --board-url http://localhost:8001
    python tools/seed_agents.py --board-url http://localhost:8001 --admin-user admin --admin-pass secret
    python tools/seed_agents.py --board-url http://localhost:8001 --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ---------------------------------------------------------------------------
# Agent → team mapping (from CLAUDE.md org chart)
# ---------------------------------------------------------------------------

AGENT_TEAMS: dict[str, str] = {
    "arjun": "executive", "vikram": "executive", "manish": "executive",
    "dhruv": "executive",
    "sneha": "frontend", "sakshi": "frontend", "ravi": "frontend",
    "isha": "frontend", "zara": "frontend",
    "rahul": "backend", "priya": "backend", "gaurav": "backend",
    "manoj": "backend", "kavya": "backend",
    "nikhil": "quality", "harsh": "quality", "abhishek": "quality",
    "ananya": "data", "karthik": "data", "suresh": "data",
    "pooja": "data", "tanvi": "data",
    "sanjay": "ai-ml", "deepa": "ai-ml", "arun": "ai-ml", "tara": "ai-ml",
    "vivek": "ai-ml", "shreya": "ai-ml", "meera": "ai-ml",
    "rohan": "product", "nisha": "product", "maya": "product", "pranav": "product",
    "amit": "product", "neha": "product", "varun": "product", "simran": "product",
    "dev": "infra", "sita": "infra", "kunal": "infra", "farhan": "infra",
    "omkar": "infra", "jatin": "infra", "reema": "infra",
    "rajesh": "security", "divya": "security", "abhay": "security",
    "aditya": "docs", "lakshmi": "docs", "kritika": "docs",
    "chintu": "ai-ml", "prompt-optimizer": "ai-ml",
}

# ---------------------------------------------------------------------------
# Agent → agent_type slug mapping (from CLAUDE.md roles + seed.sql slugs)
# ---------------------------------------------------------------------------

AGENT_TYPES: dict[str, str] = {
    "arjun": "principal-engineer",
    "vikram": "staff-architect",
    "manish": "engineering-manager",
    "sneha": "senior-ui-ux-engineer",
    "sakshi": "frontend-engineer",
    "ravi": "mobile-engineer",
    "isha": "frontend-engineer",
    "zara": "frontend-engineer",
    "rahul": "senior-backend-engineer",
    "priya": "senior-full-stack-engineer",
    "gaurav": "systems-programmer",
    "manoj": "api-design-specialist",
    "kavya": "junior-engineer",
    "nikhil": "qa-lead",
    "harsh": "performance-engineer",
    "abhishek": "qa-lead",
    "ananya": "data-engineer",
    "karthik": "data-scientist",
    "suresh": "dba",
    "pooja": "data-engineer",
    "tanvi": "data-engineer",
    "sanjay": "ai-research-lead",
    "deepa": "ml-engineer",
    "arun": "ml-engineer",
    "tara": "prompt-engineer",
    "vivek": "ml-engineer",
    "shreya": "nlp-engineer",
    "meera": "ml-engineer",
    "rohan": "product-manager",
    "nisha": "product-manager",
    "maya": "ux-researcher",
    "pranav": "product-manager",
    "amit": "product-manager",
    "neha": "product-manager",
    "varun": "product-manager",
    "simran": "product-manager",
    "dev": "devops-engineer",
    "sita": "sre",
    "kunal": "devops-engineer",
    "farhan": "devops-engineer",
    "omkar": "devops-engineer",
    "jatin": "devops-engineer",
    "reema": "devops-engineer",
    "rajesh": "security-engineer",
    "divya": "security-engineer",
    "abhay": "security-engineer",
    "aditya": "technical-writer",
    "lakshmi": "technical-writer",
    "kritika": "technical-writer",
    "dhruv": "tech-lead",
    "chintu": "ml-engineer",
    "prompt-optimizer": "prompt-engineer",
}

# ---------------------------------------------------------------------------
# Team metadata (slug → display info) — mirrors seed.sql
# ---------------------------------------------------------------------------

TEAM_DEFINITIONS: dict[str, dict] = {
    "executive":  {"name": "Executive",               "description": "Architecture and leadership",           "color": "#1F2937"},
    "frontend":   {"name": "Frontend Engineering",    "description": "UI/UX and client-side development",     "color": "#3B82F6"},
    "backend":    {"name": "Backend Engineering",     "description": "APIs, services, and data layer",        "color": "#10B981"},
    "quality":    {"name": "Quality & Performance",   "description": "Testing and performance optimization",  "color": "#F59E0B"},
    "data":       {"name": "Data Team",               "description": "ETL, analytics, and data quality",      "color": "#8B5CF6"},
    "ai-ml":      {"name": "AI/ML Team",              "description": "Machine learning and AI research",      "color": "#EC4899"},
    "product":    {"name": "Product & Design",        "description": "Product management and UX research",    "color": "#06B6D4"},
    "infra":      {"name": "Infrastructure & Platform","description": "DevOps, SRE, and cloud",               "color": "#F97316"},
    "security":   {"name": "Security & Compliance",   "description": "Security engineering and privacy",      "color": "#EF4444"},
    "docs":       {"name": "Documentation & Community","description": "Technical writing and advocacy",       "color": "#6B7280"},
}

# Agent type metadata (slug → display info) — mirrors seed.sql
AGENT_TYPE_DEFINITIONS: dict[str, dict] = {
    "principal-engineer":      {"name": "Principal Engineer",      "category": "engineering"},
    "staff-architect":         {"name": "Staff Architect",         "category": "engineering"},
    "engineering-manager":     {"name": "Engineering Manager",     "category": "engineering"},
    "senior-ui-ux-engineer":   {"name": "Senior UI/UX Engineer",   "category": "frontend"},
    "frontend-engineer":       {"name": "Frontend Engineer",       "category": "frontend"},
    "mobile-engineer":         {"name": "Mobile Engineer",         "category": "frontend"},
    "senior-backend-engineer": {"name": "Senior Backend Engineer", "category": "backend"},
    "senior-full-stack-engineer": {"name": "Senior Full-Stack Engineer", "category": "backend"},
    "systems-programmer":      {"name": "Systems Programmer",      "category": "backend"},
    "api-design-specialist":   {"name": "API Design Specialist",   "category": "backend"},
    "junior-engineer":         {"name": "Junior Engineer",         "category": "engineering"},
    "qa-lead":                 {"name": "QA Lead",                 "category": "quality"},
    "performance-engineer":    {"name": "Performance Engineer",    "category": "quality"},
    "data-engineer":           {"name": "Data Engineer",           "category": "data"},
    "data-scientist":          {"name": "Data Scientist",          "category": "data"},
    "dba":                     {"name": "DBA",                     "category": "data"},
    "ai-research-lead":        {"name": "AI Research Lead",        "category": "ai-ml"},
    "ml-engineer":             {"name": "ML Engineer",             "category": "ai-ml"},
    "prompt-engineer":         {"name": "Prompt Engineer",         "category": "ai-ml"},
    "nlp-engineer":            {"name": "NLP Engineer",            "category": "ai-ml"},
    "product-manager":         {"name": "Product Manager",         "category": "product"},
    "ux-researcher":           {"name": "UX Researcher",           "category": "product"},
    "devops-engineer":         {"name": "DevOps Engineer",         "category": "infra"},
    "sre":                     {"name": "SRE",                     "category": "infra"},
    "security-engineer":       {"name": "Security Engineer",       "category": "security"},
    "technical-writer":        {"name": "Technical Writer",        "category": "docs"},
    "tech-lead":               {"name": "Tech Lead",               "category": "engineering"},
}

# Agent directories to scan
PROJECT_AGENTS_DIR = Path("/home/vineet/Desktop/projects/dsa-tracker/.claude/agents")
GLOBAL_AGENTS_DIR  = Path("/home/vineet/.claude/agents")

# Where to save the generated keys (relative to this script's directory)
KEYS_FILE = Path(__file__).parent / "agent_keys.json"


# ---------------------------------------------------------------------------
# HTTP helpers (urllib only — zero external deps)
# ---------------------------------------------------------------------------


def _request(
    method: str,
    url: str,
    payload: dict | None = None,
    token: str | None = None,
) -> tuple[int, dict]:
    """Make an HTTP request and return (status_code, response_body_dict)."""
    data = json.dumps(payload).encode() if payload is not None else None
    headers: dict[str, str] = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode())
            return resp.status, body
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode())
        except Exception:
            body = {"detail": str(exc)}
        return exc.code, body


def _get(url: str, token: str | None = None) -> tuple[int, dict]:
    return _request("GET", url, token=token)


def _post(url: str, payload: dict, token: str) -> tuple[int, dict]:
    return _request("POST", url, payload=payload, token=token)


# ---------------------------------------------------------------------------
# YAML frontmatter parser (no PyYAML dependency)
# ---------------------------------------------------------------------------


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """
    Parse YAML frontmatter from a markdown string.

    Returns (frontmatter_dict, body_text). Handles the simple key: value
    and key:\\n  - item list format used in agent files. Does not handle
    nested mappings beyond one level deep.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text

    end = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end = i
            break

    if end is None:
        return {}, text

    fm_lines = lines[1:end]
    body = "\n".join(lines[end + 1:])

    data: dict = {}
    current_key: str | None = None
    current_list: list | None = None

    for line in fm_lines:
        # List item under the current key
        if line.startswith("  - ") or line.startswith("- "):
            item = line.lstrip().lstrip("- ").strip()
            if current_list is not None:
                current_list.append(item)
            continue

        # Key: value (or key: with no value — start of a list)
        if ":" in line:
            # Flush previous list
            if current_key is not None and current_list is not None:
                data[current_key] = current_list

            raw_key, _, raw_value = line.partition(":")
            key = raw_key.strip()
            value = raw_value.strip().strip('"').strip("'")

            if value == "":
                # Start collecting a list
                current_key = key
                current_list = []
            else:
                current_key = None
                current_list = None
                data[key] = value

    # Flush trailing list
    if current_key is not None and current_list is not None:
        data[current_key] = current_list

    return data, body


# ---------------------------------------------------------------------------
# Agent file discovery
# ---------------------------------------------------------------------------


def discover_agents(dirs: list[Path]) -> list[dict]:
    """
    Scan directories for .md files and parse their frontmatter.

    Returns a list of dicts with keys: name, display_name, description,
    model, tools, source_file.
    """
    agents: list[dict] = []
    seen_names: set[str] = set()

    for directory in dirs:
        if not directory.exists():
            print(f"  [warn] Directory not found, skipping: {directory}")
            continue

        for md_file in sorted(directory.glob("*.md")):
            # Skip non-agent files like ARCHITECTURE_RECOMMENDATIONS_ENGINE.md
            text = md_file.read_text(encoding="utf-8")
            fm, _ = parse_frontmatter(text)

            if not fm or "name" not in fm:
                continue

            name = fm["name"].strip()
            if name in seen_names:
                print(f"  [skip] Duplicate agent name '{name}' in {md_file.name}")
                continue
            seen_names.add(name)

            # Build a clean display name from the name (capitalize each word)
            display_name = " ".join(part.capitalize() for part in name.replace("-", " ").split())

            agents.append({
                "name": name,
                "display_name": display_name,
                "description": fm.get("description", ""),
                "model": fm.get("model", "sonnet"),
                "tools": fm.get("tools", []),
                "source_file": str(md_file),
            })

    return agents


# ---------------------------------------------------------------------------
# Board API helpers
# ---------------------------------------------------------------------------


def admin_login(base_url: str, username: str, password: str) -> str:
    """Log in to Agent Board and return the session token."""
    status_code, body = _post(
        f"{base_url}/api/v1/auth/login",
        {"username": username, "password": password},
        token="",  # no auth required for login
    )
    if status_code != 200:
        detail = body.get("detail", body)
        raise SystemExit(f"Login failed ({status_code}): {detail}")
    token = body.get("token", "")
    if not token:
        raise SystemExit("Login succeeded but no token returned.")
    return token


def ensure_teams(base_url: str, token: str, team_slugs: set[str], dry_run: bool) -> dict[str, int]:
    """Ensure all required teams exist. Returns slug -> id mapping."""
    if dry_run:
        existing: dict[str, int] = {}
    else:
        status_code, body = _get(f"{base_url}/api/v1/teams/")
        if status_code != 200:
            raise SystemExit(f"Failed to list teams ({status_code}): {body.get('detail', body)}")
        existing = {t["slug"]: t["id"] for t in body.get("data", [])}

    for slug in sorted(team_slugs):
        if slug in existing:
            print(f"  [team] '{slug}' already exists (id={existing[slug]})")
            continue

        defn = TEAM_DEFINITIONS.get(slug)
        if defn is None:
            print(f"  [warn] No definition for team slug '{slug}', using slug as name")
            defn = {"name": slug.replace("-", " ").title(), "description": "", "color": "#6B7280"}

        payload = {"name": defn["name"], "slug": slug, "description": defn.get("description", ""), "color": defn.get("color", "#6B7280")}

        if dry_run:
            print(f"  [dry-run] Would create team: {payload['name']} ({slug})")
            existing[slug] = -1
            continue

        sc, resp = _post(f"{base_url}/api/v1/teams/", payload, token)
        if sc == 201:
            existing[slug] = resp["id"]
            print(f"  [team] Created '{defn['name']}' (id={resp['id']})")
        elif sc == 409:
            # Race condition — fetch again
            sc2, body2 = _get(f"{base_url}/api/v1/teams/")
            existing = {t["slug"]: t["id"] for t in body2.get("data", [])}
            if slug in existing:
                print(f"  [team] '{slug}' already existed (id={existing[slug]})")
            else:
                print(f"  [warn] Could not create or find team '{slug}': {resp.get('detail', resp)}")
        else:
            print(f"  [warn] Failed to create team '{slug}' ({sc}): {resp.get('detail', resp)}")

    return existing


def ensure_agent_types(base_url: str, token: str, type_slugs: set[str], dry_run: bool) -> dict[str, int]:
    """Ensure all required agent_types exist. Returns slug -> id mapping."""
    if dry_run:
        existing: dict[str, int] = {}
    else:
        status_code, body = _get(f"{base_url}/api/v1/agent-types/")
        if status_code != 200:
            raise SystemExit(f"Failed to list agent types ({status_code}): {body.get('detail', body)}")
        existing = {t["slug"]: t["id"] for t in body.get("data", [])}

    for slug in sorted(type_slugs):
        if slug in existing:
            print(f"  [type] '{slug}' already exists (id={existing[slug]})")
            continue

        defn = AGENT_TYPE_DEFINITIONS.get(slug)
        if defn is None:
            print(f"  [warn] No definition for agent_type slug '{slug}', using slug as name")
            defn = {"name": slug.replace("-", " ").title(), "category": "engineering"}

        payload = {
            "name": defn["name"],
            "slug": slug,
            "category": defn.get("category", "engineering"),
            "description": defn.get("description", ""),
        }

        if dry_run:
            print(f"  [dry-run] Would create agent_type: {payload['name']} ({slug})")
            existing[slug] = -1
            continue

        sc, resp = _post(f"{base_url}/api/v1/agent-types/", payload, token)
        if sc == 201:
            existing[slug] = resp["id"]
            print(f"  [type] Created '{defn['name']}' (id={resp['id']})")
        elif sc == 409:
            sc2, body2 = _get(f"{base_url}/api/v1/agent-types/")
            existing = {t["slug"]: t["id"] for t in body2.get("data", [])}
            if slug in existing:
                print(f"  [type] '{slug}' already existed (id={existing[slug]})")
            else:
                print(f"  [warn] Could not create or find agent_type '{slug}': {resp.get('detail', resp)}")
        else:
            print(f"  [warn] Failed to create agent_type '{slug}' ({sc}): {resp.get('detail', resp)}")

    return existing


def list_existing_agents(base_url: str) -> set[str]:
    """Return the set of agent names already registered on the board."""
    existing: set[str] = set()
    page = 1
    while True:
        sc, body = _get(f"{base_url}/api/v1/agents/?page={page}&per_page=200")
        if sc != 200:
            print(f"  [warn] Could not list existing agents ({sc})")
            break
        data = body.get("data", [])
        for agent in data:
            existing.add(agent["name"])
        pagination = body.get("pagination", {})
        if page >= pagination.get("pages", 1):
            break
        page += 1
    return existing


def register_agent(
    base_url: str,
    token: str,
    agent: dict,
    team_ids: dict[str, int],
    type_ids: dict[str, int],
    dry_run: bool,
) -> str | None:
    """
    Register a single agent. Returns the raw API key on success, or None.
    """
    name = agent["name"]
    team_slug = AGENT_TEAMS.get(name)
    type_slug = AGENT_TYPES.get(name)

    team_id = team_ids.get(team_slug) if team_slug else None
    type_id = type_ids.get(type_slug) if type_slug else None

    payload: dict = {
        "name": name,
        "display_name": agent["display_name"],
        "model": agent["model"],
        "is_human": False,
    }
    if team_id and team_id != -1:
        payload["team_id"] = team_id
    if type_id and type_id != -1:
        payload["agent_type_id"] = type_id
    if agent.get("description"):
        payload["metadata"] = json.dumps({"description": agent["description"]})

    if dry_run:
        team_label = f"{team_slug}(id={team_id})" if team_id else "no team"
        type_label = f"{type_slug}(id={type_id})" if type_id else "no type"
        print(f"  [dry-run] Would register: {name} | team={team_label} | type={type_label}")
        return None

    sc, resp = _post(f"{base_url}/api/v1/agents/register", payload, token)
    if sc == 201:
        api_key = resp.get("api_key", "")
        agent_id = resp.get("agent", {}).get("id", "?")
        print(f"  [ok] Registered '{name}' (id={agent_id})")
        return api_key
    else:
        detail = resp.get("detail", resp)
        print(f"  [fail] Could not register '{name}' ({sc}): {detail}")
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Agent Board with all Vineet Corp agents from markdown files.",
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
        help="Admin username (default: admin, or BOARD_ADMIN_USER env var)",
    )
    parser.add_argument(
        "--admin-pass",
        default=os.environ.get("BOARD_ADMIN_PASS", "admin"),
        help="Admin password (default: admin, or BOARD_ADMIN_PASS env var)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without making any changes",
    )
    args = parser.parse_args()

    base_url = args.board_url.rstrip("/")
    dry_run: bool = args.dry_run

    if dry_run:
        print("DRY RUN — no changes will be made.\n")

    # Step 1: Discover agents
    print("Scanning agent directories...")
    agents = discover_agents([PROJECT_AGENTS_DIR, GLOBAL_AGENTS_DIR])
    print(f"  Found {len(agents)} agents total.\n")

    if not agents:
        print("No agents found. Check the agent directories.")
        sys.exit(1)

    # Step 2: Admin login
    print(f"Logging in to {base_url} as '{args.admin_user}'...")
    if dry_run:
        token = "dry-run-token"
        print("  [dry-run] Skipping actual login.\n")
    else:
        token = admin_login(base_url, args.admin_user, args.admin_pass)
        print("  Login successful.\n")

    # Step 3: Determine which teams and agent_types are needed
    needed_team_slugs: set[str] = set()
    needed_type_slugs: set[str] = set()

    for agent in agents:
        name = agent["name"]
        if name in AGENT_TEAMS:
            needed_team_slugs.add(AGENT_TEAMS[name])
        if name in AGENT_TYPES:
            needed_type_slugs.add(AGENT_TYPES[name])

    # Step 4: Ensure teams exist
    print(f"Ensuring {len(needed_team_slugs)} teams exist...")
    team_ids = ensure_teams(base_url, token, needed_team_slugs, dry_run)
    print()

    # Step 5: Ensure agent_types exist
    print(f"Ensuring {len(needed_type_slugs)} agent types exist...")
    type_ids = ensure_agent_types(base_url, token, needed_type_slugs, dry_run)
    print()

    # Step 6: Find already-registered agents
    if not dry_run:
        print("Checking for already-registered agents...")
        already_registered = list_existing_agents(base_url)
        print(f"  {len(already_registered)} agents already on the board.\n")
    else:
        already_registered: set[str] = set()

    # Step 7: Register agents, save keys
    # Load existing keys file so we don't lose previously saved keys
    if KEYS_FILE.exists():
        with KEYS_FILE.open() as f:
            keys: dict[str, str] = json.load(f)
    else:
        keys = {}

    skipped = 0
    registered = 0
    failed = 0

    print("Registering agents...")
    for agent in agents:
        name = agent["name"]
        if name in already_registered:
            print(f"  [skip] '{name}' already registered")
            skipped += 1
            continue

        api_key = register_agent(base_url, token, agent, team_ids, type_ids, dry_run)

        if api_key:
            keys[name] = api_key
            registered += 1
        elif not dry_run:
            failed += 1

    # Step 8: Save keys file
    if not dry_run and keys:
        KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with KEYS_FILE.open("w") as f:
            json.dump(keys, f, indent=2)
        print(f"\nAPI keys saved to: {KEYS_FILE}")

    # Summary
    print(f"""
Done.
  Registered : {registered}
  Skipped    : {skipped}
  Failed     : {failed}
  Keys file  : {KEYS_FILE if not dry_run else 'N/A (dry-run)'}
""")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
