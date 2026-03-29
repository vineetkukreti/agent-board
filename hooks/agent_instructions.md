# Agent Board Integration

You are tracked by **Agent Board** (http://localhost:8001).

When you begin work, a ticket has already been auto-created for your task by
the Claude Code hook system. You do not need to create a ticket manually.

## Your Responsibilities

### 1. Report progress on significant milestones

Use the `agent_board_comment` MCP tool after completing a meaningful chunk of
work — not after every small step. Good milestones to report:

- You have finished investigation / planning
- A key file or feature is implemented
- You hit an unexpected issue that changes the approach
- You are waiting on a dependency or another agent

```
agent_board_comment(
    ticket_id=<your ticket id>,
    body="Completed schema migration. Moving on to API layer."
)
```

### 2. Report blockers immediately

If you are blocked by another agent's output, an external dependency, or a
missing credential, use `agent_board_block_ticket` right away. Do not spin.

```
agent_board_block_ticket(
    ticket_id=<your ticket id>,
    reason="Waiting for rahul to finish the /questions endpoint before I can wire the frontend."
)
```

### 3. Request reviews when your work is ready

When you have produced something that needs sign-off (a design, a diff, an
architecture decision), use `agent_board_request_review`.

```
agent_board_request_review(
    ticket_id=<your ticket id>,
    reviewer="dhruv",
    note="PR ready for code review — please check the pagination logic in tickets.py."
)
```

### 4. Provide a clear completion summary

Your final message to the orchestrating agent should include:

- What you built / changed (list of files, endpoints, components)
- Any caveats, known gaps, or follow-up tickets that should be created
- Anything that is now unblocked as a result of your work

The hook system will read this summary and attach it as a comment before
closing your ticket.

---

## Available MCP Tools

| Tool | When to Use |
|------|-------------|
| `agent_board_comment` | Report progress, share findings, leave notes |
| `agent_board_block_ticket` | You are blocked and need another agent to act |
| `agent_board_unblock_ticket` | A blocker you reported has been resolved |
| `agent_board_request_review` | Your deliverable needs review by a named agent |
| `agent_board_get_ticket` | Look up details on any ticket (status, comments) |
| `agent_board_list_tickets` | See all open tickets for a project |

---

## Ticket Lifecycle (for reference)

```
todo → in_progress → review → done
                  ↘ blocked → in_progress
```

Your ticket starts in `in_progress` automatically when you are spawned.
You do not need to call any lifecycle endpoint directly — the hook handles it.

---

## Inter-Agent Communication Protocol

When you need output from another agent:

1. Check if a ticket already exists for that work via `agent_board_list_tickets`.
2. If it exists and is in_progress — add a comment on your own ticket noting
   the dependency, and block yourself.
3. If no ticket exists — ask the orchestrator to spawn the required agent.

When you are passing work to a downstream agent:

- Include the ticket ID of your work in your handoff message so the next agent
  can link their comments back.
- Mark your ticket done only after confirming the handoff was received.

---

## What Not to Do

- Do not poll Agent Board in a tight loop — one check per milestone is enough.
- Do not create duplicate tickets for work that is already tracked.
- Do not mark yourself done prematurely — the hook marks your ticket done after
  you return your final result to the orchestrator.
