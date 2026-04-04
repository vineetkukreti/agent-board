#!/usr/bin/env python3
"""
agent_cli.py — Command-line interface for Agent Board.

Subcommands:
    start <ticket_id>                    Start a ticket
    done <ticket_id> [--summary TEXT]    Complete a ticket
    create --title TEXT --project TEXT    Create a ticket
    heartbeat                            Send heartbeat
    standup --done TEXT --doing TEXT      Submit standup
    my-tickets                           List assigned tickets
    sprint <sprint_id>                   Show sprint status

Uses AgentBoard SDK from agent_sdk.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Import SDK from same directory
sys.path.insert(0, str(Path(__file__).parent))
from agent_sdk import AgentBoard, _http  # noqa: E402


# ---------------------------------------------------------------------------
# ANSI colors
# ---------------------------------------------------------------------------

class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    RED     = "\033[31m"
    GREEN   = "\033[32m"
    YELLOW  = "\033[33m"
    BLUE    = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN    = "\033[36m"
    WHITE   = "\033[37m"


def _no_color():
    """Disable colors (for piped output or --json mode)."""
    for attr in ("RESET", "BOLD", "DIM", "RED", "GREEN", "YELLOW",
                 "BLUE", "MAGENTA", "CYAN", "WHITE"):
        setattr(C, attr, "")


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def _json_out(data):
    print(json.dumps(data, indent=2, default=str))


def _error(msg: str):
    print(f"{C.RED}{C.BOLD}Error:{C.RESET} {msg}", file=sys.stderr)
    sys.exit(1)


def _success(msg: str):
    print(f"{C.GREEN}{C.BOLD}OK{C.RESET} {msg}")


def _header(msg: str):
    print(f"\n{C.BOLD}{C.CYAN}{msg}{C.RESET}")
    print(f"{C.DIM}{'─' * 50}{C.RESET}")


STATUS_COLORS = {
    "todo": C.WHITE,
    "in_progress": C.BLUE,
    "review": C.MAGENTA,
    "done": C.GREEN,
    "blocked": C.RED,
    "cancelled": C.DIM,
}

PRIORITY_COLORS = {
    "p0": C.RED + C.BOLD,
    "p1": C.YELLOW,
    "p2": C.WHITE,
    "p3": C.DIM,
}


def _ticket_line(t: dict) -> str:
    sid = f"{C.DIM}#{t.get('id', '?')}{C.RESET}"
    sc = STATUS_COLORS.get(t.get("status", ""), "")
    status = f"{sc}{t.get('status', 'unknown')}{C.RESET}"
    pc = PRIORITY_COLORS.get(t.get("priority", ""), "")
    priority = f"{pc}{t.get('priority', '??')}{C.RESET}"
    title = t.get("title", "(untitled)")
    return f"  {sid}  [{priority}] [{status}]  {title}"


# ---------------------------------------------------------------------------
# API key resolution
# ---------------------------------------------------------------------------

def _resolve_api_key(args) -> str | None:
    """Resolve API key: --api-key > env > agent_keys.json."""
    if getattr(args, "api_key", None):
        return args.api_key
    env_key = os.environ.get("AGENT_BOARD_API_KEY")
    if env_key:
        return env_key
    # Try agent_keys.json
    agent_name = getattr(args, "agent", None)
    if agent_name:
        keys_file = Path(__file__).parent / "agent_keys.json"
        if keys_file.exists():
            try:
                with keys_file.open() as f:
                    keys = json.load(f)
                return keys.get(agent_name)
            except Exception:
                pass
    return None


def _make_board(args) -> AgentBoard:
    """Build an AgentBoard instance from CLI args."""
    api_key = _resolve_api_key(args)
    return AgentBoard(
        url=args.url,
        api_key=api_key,
        agent_name=getattr(args, "agent", None),
    )


# ---------------------------------------------------------------------------
# Subcommand handlers
# ---------------------------------------------------------------------------

def cmd_start(args):
    board = _make_board(args)
    result = board.start_ticket(args.ticket_id)
    if not result:
        _error(f"Failed to start ticket #{args.ticket_id}")
    if args.json:
        _json_out(result)
    else:
        _success(f"Ticket #{args.ticket_id} is now {C.BLUE}in_progress{C.RESET}")


def cmd_done(args):
    board = _make_board(args)
    result = board.done_ticket(args.ticket_id, summary=args.summary or "")
    if not result:
        _error(f"Failed to complete ticket #{args.ticket_id}")
    if args.json:
        _json_out(result)
    else:
        _success(f"Ticket #{args.ticket_id} marked {C.GREEN}done{C.RESET}")
        if args.summary:
            print(f"  {C.DIM}Summary: {args.summary}{C.RESET}")


def cmd_create(args):
    board = _make_board(args)
    result = board.create_ticket(
        title=args.title,
        project=args.project,
        priority=args.priority,
        description=args.description or "",
    )
    if not result:
        _error("Failed to create ticket")
    if args.json:
        _json_out(result)
    else:
        ticket_id = result.get("id", "?")
        _success(f"Created ticket #{ticket_id}: {args.title}")
        print(f"  {C.DIM}Project: {args.project}  Priority: {args.priority}{C.RESET}")


def cmd_heartbeat(args):
    board = _make_board(args)
    result = board.heartbeat()
    if not result:
        _error("Heartbeat failed")
    if args.json:
        _json_out(result)
    else:
        _success(f"Heartbeat sent for agent {C.CYAN}{args.agent or 'unknown'}{C.RESET}")


def cmd_standup(args):
    board = _make_board(args)
    result = board.submit_standup(
        yesterday=args.done,
        today=args.doing,
        blockers=args.blockers or "",
    )
    if not result:
        _error("Failed to submit standup")
    if args.json:
        _json_out(result)
    else:
        _success("Standup submitted")
        print(f"  {C.GREEN}Done:{C.RESET}     {args.done}")
        print(f"  {C.BLUE}Doing:{C.RESET}    {args.doing}")
        if args.blockers:
            print(f"  {C.RED}Blockers:{C.RESET} {args.blockers}")


def cmd_my_tickets(args):
    board = _make_board(args)
    tickets = board.get_my_tickets()
    if args.json:
        _json_out(tickets)
        return
    if not tickets:
        print(f"{C.DIM}No tickets assigned.{C.RESET}")
        return
    _header(f"Tickets for {args.agent or 'agent'} ({len(tickets)} total)")
    # Group by status
    by_status: dict[str, list] = {}
    for t in tickets:
        by_status.setdefault(t.get("status", "unknown"), []).append(t)
    for s in ("in_progress", "todo", "review", "blocked", "done", "cancelled"):
        group = by_status.get(s, [])
        if group:
            sc = STATUS_COLORS.get(s, "")
            print(f"\n  {sc}{C.BOLD}{s.upper()}{C.RESET} ({len(group)})")
            for t in group:
                print(_ticket_line(t))


def cmd_sprint(args):
    api_key = _resolve_api_key(args)
    base = args.url.rstrip("/")

    sc, body = _http("GET", f"{base}/api/v1/sprints/{args.sprint_id}", api_key=api_key)
    if sc != 200:
        _error(f"Failed to fetch sprint #{args.sprint_id}: {body}")
    if args.json:
        _json_out(body)
        return
    sprint = body
    _header(f"Sprint: {sprint.get('name', '?')}")
    print(f"  {C.BOLD}Status:{C.RESET}  {sprint.get('status', '?')}")
    print(f"  {C.BOLD}Goal:{C.RESET}    {sprint.get('goal', '-')}")
    print(f"  {C.BOLD}Dates:{C.RESET}   {sprint.get('start_date', '?')} -> {sprint.get('end_date', '?')}")
    print(f"  {C.BOLD}Project:{C.RESET} {sprint.get('project_name', '?')}")

    sc2, tbody = _http("GET", f"{base}/api/v1/tickets/", api_key=api_key,
                        params={"sprint_id": args.sprint_id, "per_page": 200})
    if sc2 == 200:
        tickets = tbody.get("data", [])
        total = len(tickets)
        done = sum(1 for t in tickets if t.get("status") == "done")
        in_prog = sum(1 for t in tickets if t.get("status") == "in_progress")
        blocked = sum(1 for t in tickets if t.get("status") == "blocked")
        todo = sum(1 for t in tickets if t.get("status") == "todo")
        review = sum(1 for t in tickets if t.get("status") == "review")
        print(f"\n  {C.BOLD}Tickets:{C.RESET} {total} total")
        if total > 0:
            pct = round(done / total * 100)
            bar_len = 30
            filled = round(pct / 100 * bar_len)
            bar = f"{C.GREEN}{'█' * filled}{C.DIM}{'░' * (bar_len - filled)}{C.RESET}"
            print(f"  {bar} {pct}%")
            print(f"  {C.GREEN}✓ {done} done{C.RESET}  {C.BLUE}● {in_prog} wip{C.RESET}  "
                  f"{C.MAGENTA}◎ {review} review{C.RESET}  {C.WHITE}○ {todo} todo{C.RESET}  "
                  f"{C.RED}✗ {blocked} blocked{C.RESET}")

        # Team allocation
        agents = {}
        for t in tickets:
            name = t.get("assignee_name") or "Unassigned"
            if name not in agents:
                agents[name] = {"total": 0, "done": 0}
            agents[name]["total"] += 1
            if t.get("status") == "done":
                agents[name]["done"] += 1

        if agents:
            print(f"\n  {C.BOLD}Team:{C.RESET}")
            for name, stats in sorted(agents.items(), key=lambda x: -x[1]["total"]):
                pct = round(stats["done"] / stats["total"] * 100) if stats["total"] else 0
                print(f"    {C.CYAN}{name:15s}{C.RESET} {stats['done']}/{stats['total']} done ({pct}%)")

        print(f"\n  {C.BOLD}Tickets:{C.RESET}")
        for t in tickets:
            print(_ticket_line(t))


def cmd_sprint_list(args):
    """List all sprints."""
    api_key = _resolve_api_key(args)
    base = args.url.rstrip("/")
    params = {}
    if getattr(args, "project", None):
        # Resolve project name to ID
        sc, pdata = _http("GET", f"{base}/api/v1/projects/", api_key=api_key)
        if sc == 200:
            for p in pdata.get("data", pdata if isinstance(pdata, list) else []):
                if p.get("slug") == args.project or p.get("name", "").lower() == args.project.lower():
                    params["project_id"] = p["id"]
                    break

    sc, body = _http("GET", f"{base}/api/v1/sprints/", api_key=api_key, params=params)
    if sc != 200:
        _error(f"Failed to fetch sprints: {body}")
    if args.json:
        _json_out(body)
        return

    sprints = body.get("data", [])
    if not sprints:
        print(f"{C.DIM}No sprints found.{C.RESET}")
        return

    _header(f"Sprints ({len(sprints)} total)")
    for s in sprints:
        status = s.get("status", "?")
        sc_color = {
            "active": C.GREEN, "planning": C.YELLOW,
            "completed": C.BLUE, "cancelled": C.DIM,
        }.get(status, "")
        tickets = s.get("ticket_count", 0)
        print(f"  {C.DIM}#{s['id']:<4}{C.RESET} {sc_color}{status:10s}{C.RESET} "
              f"{s.get('name', '?'):40s} {C.DIM}{tickets} tickets{C.RESET}")


def cmd_sprint_create(args):
    """Create a new sprint."""
    api_key = _resolve_api_key(args)
    base = args.url.rstrip("/")

    # Resolve project
    sc, pdata = _http("GET", f"{base}/api/v1/projects/", api_key=api_key)
    project_id = None
    if sc == 200:
        for p in pdata.get("data", pdata if isinstance(pdata, list) else []):
            if p.get("slug") == args.project or p.get("name", "").lower() == args.project.lower():
                project_id = p["id"]
                break
    if not project_id:
        _error(f"Project '{args.project}' not found")

    payload = {
        "name": args.name,
        "project_id": project_id,
        "goal": args.goal or "",
        "start_date": args.start or "",
        "end_date": args.end or "",
    }
    sc, body = _http("POST", f"{base}/api/v1/sprints/", payload=payload, api_key=api_key)
    if sc not in (200, 201):
        _error(f"Failed to create sprint: {body}")
    if args.json:
        _json_out(body)
        return

    sid = body.get("id", "?")
    _success(f"Sprint #{sid} created: {args.name}")

    if args.activate:
        sc2, _ = _http("POST", f"{base}/api/v1/sprints/{sid}/activate", payload={}, api_key=api_key)
        if sc2 == 200:
            print(f"  {C.GREEN}Sprint activated!{C.RESET}")
        else:
            print(f"  {C.YELLOW}Could not activate (another sprint may be active){C.RESET}")


def cmd_sprint_ingest(args):
    """Ingest a SPRINT_*.md file into the board."""
    filepath = args.file
    if not Path(filepath).exists():
        _error(f"File not found: {filepath}")

    # Import the ingester
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "ingest", str(Path(__file__).parent / "ingest_sprint.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    except Exception as e:
        _error(f"Could not load ingest_sprint: {e}")

    sprint_data = mod.parse_sprint_md(filepath)

    if args.json:
        _json_out(sprint_data)
        return

    _header(f"Sprint: {sprint_data.get('name', '?')}")
    print(f"  {C.BOLD}Goal:{C.RESET}    {sprint_data.get('goal', '-')[:80]}")
    print(f"  {C.BOLD}Dates:{C.RESET}   {sprint_data.get('start_date', '?')} -> {sprint_data.get('end_date', '?')}")
    print(f"  {C.BOLD}Tickets:{C.RESET} {len(sprint_data.get('tickets', []))}")

    by_p = {}
    for t in sprint_data.get("tickets", []):
        by_p[t["priority"]] = by_p.get(t["priority"], 0) + 1
    for p in sorted(by_p):
        pc = PRIORITY_COLORS.get(p, "")
        print(f"    {pc}{p.upper()}: {by_p[p]} tickets{C.RESET}")

    agents = set(t.get("assignee_name", "") for t in sprint_data.get("tickets", []) if t.get("assignee_name"))
    print(f"  {C.BOLD}Agents:{C.RESET}  {len(agents)} — {', '.join(sorted(agents))}")

    if getattr(args, "dry_run", False):
        print(f"\n  {C.YELLOW}DRY RUN — nothing created{C.RESET}")
        return

    # Run the full ingest
    print(f"\n  {C.CYAN}Ingesting...{C.RESET}")
    project_dir = getattr(args, "project_dir", None) or str(Path(filepath).parent)
    try:
        # Use subprocess to run the ingester properly
        import subprocess
        cmd = [sys.executable, str(Path(__file__).parent / "ingest_sprint.py"), filepath,
               "--project", project_dir]
        if getattr(args, "activate", False):
            cmd.append("--activate")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        print(result.stdout)
        if result.returncode != 0 and result.stderr:
            print(f"  {C.RED}{result.stderr}{C.RESET}")
    except Exception as e:
        _error(f"Ingest failed: {e}")


def cmd_sprint_scan(args):
    """Scan current directory for SPRINT_*.md files and show what would be ingested."""
    scan_dir = args.dir or os.getcwd()
    sprint_files = sorted(Path(scan_dir).glob("SPRINT_*.md"))

    if not sprint_files:
        print(f"{C.DIM}No SPRINT_*.md files found in {scan_dir}{C.RESET}")
        return

    if args.json:
        _json_out([str(f) for f in sprint_files])
        return

    _header(f"Sprint files in {scan_dir}")
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "ingest", str(Path(__file__).parent / "ingest_sprint.py")
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    except Exception:
        mod = None

    for f in sprint_files:
        mtime = os.path.getmtime(f)
        from datetime import datetime
        modified = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
        print(f"\n  {C.CYAN}{f.name}{C.RESET}  {C.DIM}(modified {modified}){C.RESET}")
        if mod:
            try:
                data = mod.parse_sprint_md(str(f))
                print(f"    Name:    {data.get('name', '?')}")
                print(f"    Dates:   {data.get('start_date', '?')} -> {data.get('end_date', '?')}")
                print(f"    Tickets: {len(data.get('tickets', []))}")
                print(f"    Goal:    {data.get('goal', '-')[:60]}")
            except Exception as e:
                print(f"    {C.RED}Parse error: {e}{C.RESET}")


def cmd_project_scan(args):
    """Scan a project directory and show what would be registered."""
    scan_dir = args.dir or os.getcwd()

    if args.json:
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "scanner", str(Path(__file__).parent / "project_scanner.py")
            )
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            result = mod.scan_project(scan_dir)
            _json_out(result)
        except Exception as e:
            _error(f"Scan failed: {e}")
        return

    _header(f"Scanning: {scan_dir}")

    # Name detection
    for manifest in ["package.json", "pyproject.toml", "Cargo.toml"]:
        mpath = Path(scan_dir) / manifest
        if mpath.exists():
            print(f"  {C.GREEN}Found:{C.RESET} {manifest}")
            if manifest == "package.json":
                try:
                    pkg = json.loads(mpath.read_text())
                    print(f"    Name: {pkg.get('name', '?')}")
                    print(f"    Description: {pkg.get('description', '-')[:60]}")
                except Exception:
                    pass

    # Tech stack
    extensions = {}
    for f in Path(scan_dir).rglob("*"):
        if f.is_file() and not any(p in str(f) for p in ["node_modules", ".git", "venv", "__pycache__"]):
            ext = f.suffix
            if ext:
                extensions[ext] = extensions.get(ext, 0) + 1
    top_ext = sorted(extensions.items(), key=lambda x: -x[1])[:8]
    if top_ext:
        lang_map = {".py": "Python", ".js": "JavaScript", ".ts": "TypeScript", ".go": "Go",
                    ".rs": "Rust", ".java": "Java", ".rb": "Ruby", ".jsx": "React", ".tsx": "React/TS"}
        print(f"\n  {C.BOLD}Tech stack:{C.RESET}")
        for ext, count in top_ext:
            lang = lang_map.get(ext, ext)
            print(f"    {C.CYAN}{lang:15s}{C.RESET} {count} files")

    # README
    readme = Path(scan_dir) / "README.md"
    if readme.exists():
        text = readme.read_text(errors="replace")[:500]
        lines = [l.strip() for l in text.splitlines() if l.strip() and not l.startswith("#")]
        if lines:
            print(f"\n  {C.BOLD}README:{C.RESET} {lines[0][:80]}")

    # CLAUDE.md
    claude_md = Path(scan_dir) / "CLAUDE.md"
    if claude_md.exists():
        print(f"\n  {C.GREEN}Found:{C.RESET} CLAUDE.md")

    # Sprint files
    sprints = list(Path(scan_dir).glob("SPRINT_*.md"))
    if sprints:
        print(f"\n  {C.BOLD}Sprint files:{C.RESET}")
        for s in sprints:
            print(f"    {C.CYAN}{s.name}{C.RESET}")

    # Git
    try:
        import subprocess
        branch = subprocess.run(["git", "branch", "--show-current"], cwd=scan_dir,
                                capture_output=True, text=True, timeout=2).stdout.strip()
        if branch:
            print(f"\n  {C.BOLD}Git:{C.RESET} branch={branch}")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="agent_cli",
        description="Agent Board CLI — manage tickets, standups, and sprints from the terminal.",
    )
    parser.add_argument("--url", default="http://localhost:8001", help="Agent Board API URL")
    parser.add_argument("--api-key", default=None, help="API key (overrides env and keys file)")
    parser.add_argument("--agent", default=None, help="Agent name for key lookup and identification")
    parser.add_argument("--json", action="store_true", help="Output as JSON (machine-readable)")

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # start
    p_start = sub.add_parser("start", help="Start a ticket")
    p_start.add_argument("ticket_id", type=int, help="Ticket ID to start")

    # done
    p_done = sub.add_parser("done", help="Complete a ticket")
    p_done.add_argument("ticket_id", type=int, help="Ticket ID to complete")
    p_done.add_argument("--summary", default=None, help="Closing summary")

    # create
    p_create = sub.add_parser("create", help="Create a new ticket")
    p_create.add_argument("--title", required=True, help="Ticket title")
    p_create.add_argument("--project", required=True, help="Project slug or name")
    p_create.add_argument("--priority", default="p2", choices=["p0", "p1", "p2", "p3"], help="Priority")
    p_create.add_argument("--description", default=None, help="Ticket description")

    # heartbeat
    sub.add_parser("heartbeat", help="Send agent heartbeat")

    # standup
    p_standup = sub.add_parser("standup", help="Submit daily standup")
    p_standup.add_argument("--done", required=True, help="What was done")
    p_standup.add_argument("--doing", required=True, help="What is being done next")
    p_standup.add_argument("--blockers", default=None, help="Any blockers")

    # my-tickets
    sub.add_parser("my-tickets", help="List your assigned tickets")

    # sprint show
    p_sprint = sub.add_parser("sprint", help="Show sprint details")
    p_sprint.add_argument("sprint_id", type=int, help="Sprint ID")

    # sprint-list
    p_slist = sub.add_parser("sprint-list", help="List all sprints")
    p_slist.add_argument("--project", default=None, help="Filter by project slug")

    # sprint-create
    p_screate = sub.add_parser("sprint-create", help="Create a new sprint")
    p_screate.add_argument("--name", required=True, help="Sprint name")
    p_screate.add_argument("--project", required=True, help="Project slug")
    p_screate.add_argument("--goal", default=None, help="Sprint goal")
    p_screate.add_argument("--start", default=None, help="Start date (YYYY-MM-DD)")
    p_screate.add_argument("--end", default=None, help="End date (YYYY-MM-DD)")
    p_screate.add_argument("--activate", action="store_true", help="Activate immediately")

    # sprint-ingest
    p_singest = sub.add_parser("sprint-ingest", help="Ingest a SPRINT_*.md file")
    p_singest.add_argument("file", help="Path to SPRINT_*.md file")
    p_singest.add_argument("--project-dir", default=None, help="Project directory (defaults to file's parent)")
    p_singest.add_argument("--activate", action="store_true", help="Activate after creation")
    p_singest.add_argument("--dry-run", action="store_true", help="Parse only, don't create")

    # sprint-scan
    p_sscan = sub.add_parser("sprint-scan", help="Scan directory for SPRINT_*.md files")
    p_sscan.add_argument("--dir", default=None, help="Directory to scan (defaults to cwd)")

    # project-scan
    p_pscan = sub.add_parser("project-scan", help="Scan a project directory")
    p_pscan.add_argument("--dir", default=None, help="Directory to scan (defaults to cwd)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Disable colors for JSON mode or piped output
    if args.json or not sys.stdout.isatty():
        _no_color()

    dispatch = {
        "start": cmd_start,
        "done": cmd_done,
        "create": cmd_create,
        "heartbeat": cmd_heartbeat,
        "standup": cmd_standup,
        "my-tickets": cmd_my_tickets,
        "sprint": cmd_sprint,
        "sprint-list": cmd_sprint_list,
        "sprint-create": cmd_sprint_create,
        "sprint-ingest": cmd_sprint_ingest,
        "sprint-scan": cmd_sprint_scan,
        "project-scan": cmd_project_scan,
    }

    handler = dispatch.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
