#!/usr/bin/env python3
"""
run_sprint.py — Simulate agents working through Sprint 1.

Each agent picks up their assigned tickets, works through the lifecycle
(heartbeat → start → comment → review → done → standup), with realistic
delays between actions so you can watch it live on the dashboard.

Usage:
    cd backend && source venv/bin/activate
    python ../tools/run_sprint.py
"""

import sys
import time
import random

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from agent_sdk import AgentBoard

# ─── Agent definitions ────────────────────────────────────────────────────────

AGENTS = {
    "spark": {
        "role": "Senior Backend Engineer",
        "tickets": {
            4: {  # Fix ticket status update endpoint
                "comments": [
                    "Investigating the TicketUpdate model — status field is missing from the Pydantic schema.",
                    "Found it. The PUT handler also needs status in its update dict. Patching both.",
                    "Fix applied and tested. All status transitions (todo→in_progress→review→done) work correctly.",
                ],
                "summary": "Added `status` field to TicketUpdate model and update handler. All transitions verified.",
            },
            5: {  # Add request validation middleware
                "comments": [
                    "Reviewing existing error handling patterns across all route files.",
                    "Adding a centralized validation error handler that returns consistent 422 responses.",
                ],
                "summary": "Added Pydantic validation error handler middleware with field-level error details.",
            },
        },
    },
    "atlas": {
        "role": "Staff Architect",
        "tickets": {
            2: {  # Design rate limiting architecture
                "comments": [
                    "Evaluating token bucket vs sliding window approaches. For our scale, in-memory with Redis fallback makes sense.",
                    "Drafted RFC: Token bucket per-endpoint with configurable burst. Global rate limit + per-API-key limit.",
                    "RFC complete. Recommending: 100 req/min default, 1000 req/min for authenticated agents, Redis-backed for multi-instance.",
                ],
                "summary": "RFC published. Token bucket algorithm, dual-tier limits (global + per-key), Redis-backed counters.",
            },
            3: {  # Define API versioning strategy
                "comments": [
                    "Analyzed current /api/v1/ structure. Proposing URL-based versioning with deprecation headers.",
                    "Strategy documented: new versions get new URL prefix, old versions get Sunset header 6 months before removal.",
                ],
                "summary": "API versioning strategy defined: URL-based, 6-month deprecation window, Sunset headers.",
            },
        },
    },
    "pixel": {
        "role": "Senior UI/UX Engineer",
        "tickets": {
            6: {  # Fix blank page crash on dashboard
                "comments": [
                    "Root cause: ProjectSelector assumes API returns array, but it returns {data: [...]}. Classic shape mismatch.",
                    "Fixed AppShell ProjectSelector. Added ErrorBoundary to App.jsx to catch future render crashes.",
                    "Tested all pages — dashboard, board, agents, teams, sprints. No more blank screens.",
                ],
                "summary": "Fixed API response shape handling in ProjectSelector. Added global ErrorBoundary.",
            },
            7: {  # Build agent profile page
                "comments": [
                    "Wireframing agent profile: header with status badge, ticket kanban, activity timeline, standup history.",
                    "Profile page built with recharts activity graph. Shows ticket distribution by status and recent activity.",
                ],
                "summary": "Agent profile page complete with activity charts, ticket list, and standup history.",
            },
        },
    },
    "forge": {
        "role": "DevOps Engineer",
        "tickets": {
            8: {  # Set up CI/CD pipeline
                "comments": [
                    "Creating GitHub Actions workflow: lint (ruff) + test (pytest) on PR, build on merge.",
                    "Added frontend build step: npm ci && npm run build. Matrix testing Python 3.11/3.12.",
                    "Pipeline ready. PR checks pass in ~2 min. Deploy step is a placeholder for now.",
                ],
                "summary": "CI/CD pipeline with GitHub Actions: lint, test, build. PR checks in ~2 min.",
            },
            9: {  # Add Docker Compose
                "comments": [
                    "Writing Dockerfile for API (Python 3.12-slim) and client (node:20-alpine + nginx).",
                    "docker-compose.yml ready with hot-reload volumes for dev. SQLite DB persisted via named volume.",
                ],
                "summary": "Docker Compose with API + client services, hot-reload dev mode, persistent DB volume.",
            },
        },
    },
    "cipher": {
        "role": "Security Engineer",
        "tickets": {
            10: {  # Audit authentication and fix token expiry
                "comments": [
                    "CRITICAL: JWT tokens have no expiry. Adding `exp` claim with 24h default.",
                    "Implemented refresh token flow: short-lived access token (1h) + long-lived refresh token (7d).",
                    "Auth middleware audit complete. Found and fixed: missing rate limit on login, no account lockout.",
                ],
                "summary": "Added token expiry (1h access + 7d refresh), login rate limiting, account lockout after 5 failed attempts.",
            },
        },
    },
    "nova": {
        "role": "Senior Full-Stack Engineer",
        "tickets": {
            11: {  # Build sprint board with drag-and-drop
                "comments": [
                    "Setting up @dnd-kit/core with sortable columns: todo, in_progress, review, done.",
                    "DnD working! Drag a ticket card between columns → calls PUT /tickets/{id} with new status.",
                    "Added optimistic updates so the card moves instantly while the API call happens in background.",
                ],
                "summary": "Sprint board with drag-and-drop via @dnd-kit. Optimistic updates for instant feedback.",
            },
        },
    },
}

DELAY = 2  # seconds between actions (set to 0 for instant)


def run_agent(name: str, config: dict) -> None:
    """Run a single agent through all their tickets."""
    board = AgentBoard(agent_name=name)
    role = config["role"]

    print(f"\n{'='*60}")
    print(f"  {name.upper()} — {role}")
    print(f"{'='*60}")

    # Heartbeat
    board.heartbeat()
    print(f"  [{name}] Heartbeat sent — status: active")
    time.sleep(DELAY)

    for ticket_id, ticket_config in config["tickets"].items():
        comments = ticket_config["comments"]
        summary = ticket_config["summary"]

        # Start ticket
        result = board.start_ticket(ticket_id)
        status = result.get("status", "?")
        title = result.get("title", f"Ticket #{ticket_id}")
        print(f"\n  [{name}] Started: #{ticket_id} — {title}")
        time.sleep(DELAY)

        # Post comments (simulating work)
        for i, comment_text in enumerate(comments):
            board.comment(ticket_id, comment_text)
            progress = f"[{i+1}/{len(comments)}]"
            print(f"  [{name}] {progress} {comment_text[:70]}...")
            time.sleep(DELAY)

        # Move to review
        board.review_ticket(ticket_id)
        print(f"  [{name}] Submitted for review: #{ticket_id}")
        time.sleep(DELAY)

        # Complete
        board.done_ticket(ticket_id, summary=summary)
        print(f"  [{name}] DONE: #{ticket_id} — {summary[:60]}...")
        time.sleep(DELAY)

    # Submit standup
    all_summaries = [t["summary"] for t in config["tickets"].values()]
    done_text = "; ".join(all_summaries)
    board.submit_standup(
        yesterday="Sprint planning and task review",
        today=done_text[:500],
        blockers="",
        project="agent-board-api",
    )
    print(f"  [{name}] Standup submitted")


def main():
    print("\n" + "=" * 60)
    print("  AGENT BOARD — Sprint 1 Simulation")
    print("  Agents will work through their tickets in real-time.")
    print("  Watch the dashboard at http://localhost:5174")
    print("=" * 60)

    for name, config in AGENTS.items():
        run_agent(name, config)

    print("\n" + "=" * 60)
    print("  SPRINT COMPLETE!")
    print("  All 10 tickets processed by 6 agents.")
    print("  Check the dashboard for the full picture.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
