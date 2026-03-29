#!/usr/bin/env python3
"""
example_usage.py — How an agent uses the Agent Board SDK during its work.

This file demonstrates the full Agent Board SDK workflow: creating a ticket,
progressing it through states, adding comments, handling blockers, submitting
a standup, and querying assigned work.

To run this example (Agent Board must be running at localhost:8001 and
rahul must already be registered via seed_agents.py):

    cd /home/vineet/Desktop/projects/agent-board
    python tools/example_usage.py
"""

from agent_sdk import AgentBoard

# ---------------------------------------------------------------------------
# Initialize the SDK
# ---------------------------------------------------------------------------
# AgentBoard loads rahul's API key from tools/agent_keys.json automatically.
# You can also pass api_key="..." explicitly, or set AGENT_BOARD_API_KEY.

board = AgentBoard(agent_name="rahul")
print(f"Connected: {board}\n")

# ---------------------------------------------------------------------------
# 1. Heartbeat — mark agent as active
# ---------------------------------------------------------------------------
result = board.heartbeat()
if result:
    print(f"Heartbeat OK (agent_id={result.get('agent_id')})")

# ---------------------------------------------------------------------------
# 2. Create a ticket
# ---------------------------------------------------------------------------
ticket = board.create_ticket(
    title="Optimize dashboard query",
    project="agent-board",
    priority="p1",
    description=(
        "The /api/v1/dashboard endpoint takes ~500ms on boards with >200 agents. "
        "Target: under 100ms. Likely cause: missing composite index on activity_log."
    ),
)

if not ticket:
    print("Failed to create ticket — is Agent Board running and rahul registered?")
    raise SystemExit(1)

ticket_id: int = ticket["id"]
print(f"Created ticket #{ticket_id}: '{ticket['title']}' [{ticket['priority']}]")

# ---------------------------------------------------------------------------
# 3. Start work
# ---------------------------------------------------------------------------
board.start_ticket(ticket_id)
print(f"Ticket #{ticket_id} is now in_progress")

board.comment(
    ticket_id,
    "Starting investigation. Will look at query plans for the dashboard JOIN chain.",
)

# ---------------------------------------------------------------------------
# 4. Hit a blocker
# ---------------------------------------------------------------------------
blocked = board.block_ticket(
    ticket_id,
    reason="Need production query stats from Suresh (DBA) before optimizing indexes.",
    blocked_by_agent="suresh",
)
if blocked:
    print(f"Ticket #{ticket_id} blocked: waiting on suresh for query stats")

# ... (suresh provides the stats) ...

# ---------------------------------------------------------------------------
# 5. Unblock and continue
# ---------------------------------------------------------------------------
board.unblock_ticket(ticket_id)
board.comment(
    ticket_id,
    "Suresh shared EXPLAIN QUERY PLAN output. "
    "Root cause confirmed: missing composite index on (project_id, created_at) in activity_log.",
)
print(f"Ticket #{ticket_id} unblocked, back in_progress")

# ---------------------------------------------------------------------------
# 6. Submit for review
# ---------------------------------------------------------------------------
board.comment(
    ticket_id,
    "Index added via migration. Benchmark results:\n"
    "  Before: 487ms avg (10 runs)\n"
    "  After:  38ms avg (10 runs)\n"
    "Query plan now uses the composite index. Ready for review.",
)
board.review_ticket(ticket_id)
print(f"Ticket #{ticket_id} is now in review")

# ---------------------------------------------------------------------------
# 7. Mark as done
# ---------------------------------------------------------------------------
board.done_ticket(
    ticket_id,
    summary=(
        "Added composite index idx_activity_project_created on activity_log(project_id, created_at). "
        "Dashboard endpoint latency reduced from ~487ms to ~38ms (87% improvement)."
    ),
)
print(f"Ticket #{ticket_id} done")

# ---------------------------------------------------------------------------
# 8. Daily standup
# ---------------------------------------------------------------------------
standup = board.submit_standup(
    yesterday=(
        "Investigated and fixed the dashboard query bottleneck. "
        "Added composite index — latency down from 487ms to 38ms."
    ),
    today=(
        "Working on the sprint burndown endpoint. "
        "Reviewing Manoj's PR for the new /api/v1/agents/bulk endpoint."
    ),
    blockers="None",
    project="agent-board",
)
if standup:
    print(f"Standup submitted for {standup.get('date')} (id={standup.get('id')})")

# ---------------------------------------------------------------------------
# 9. Check assigned tickets
# ---------------------------------------------------------------------------
my_tickets = board.get_my_tickets()
print(f"\nRahul has {len(my_tickets)} total assigned tickets:")
for t in my_tickets[:5]:
    print(f"  #{t['id']} [{t['status']:12}] [{t['priority']}] {t['title']}")
if len(my_tickets) > 5:
    print(f"  ... and {len(my_tickets) - 5} more")

print("\nDone.")
