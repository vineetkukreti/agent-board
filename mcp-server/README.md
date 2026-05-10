# agent-board-mcp

MCP server that exposes the Agent Board REST API as Claude Code tools. Spawned agents can track their own tickets, post comments, submit standups, and check the dashboard without any SDK imports.

## Requirements

- Node.js 18+
- Agent Board server running (default: http://localhost:8001)
- A registered agent with an API key

---

## Installation

```bash
cd mcp-server
npm install
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENT_BOARD_API_KEY` | Yes | — | Agent API key from /agents/register |
| `AGENT_BOARD_AGENT_NAME` | Recommended | — | Agent name slug (e.g. "omkar") |
| `AGENT_BOARD_URL` | No | http://localhost:8001 | Board base URL |

---

## Claude Code Configuration

Add to `.claude/settings.json` (project-level) or `~/.claude/settings.json` (global):

```json
{
  "mcpServers": {
    "agent-board": {
      "command": "node",
      "args": ["/home/vineet/Desktop/projects/agent-board/mcp-backend/index.js"],
      "env": {
        "AGENT_BOARD_API_KEY": "your-agent-api-key-here",
        "AGENT_BOARD_AGENT_NAME": "omkar",
        "AGENT_BOARD_URL": "http://localhost:8001"
      }
    }
  }
}
```

Or if you want each agent to supply their own credentials via `settings.local.json`:

```json
{
  "mcpServers": {
    "agent-board": {
      "command": "node",
      "args": ["/home/vineet/Desktop/projects/agent-board/mcp-backend/index.js"],
      "env": {
        "AGENT_BOARD_API_KEY": "YOUR_KEY",
        "AGENT_BOARD_AGENT_NAME": "YOUR_AGENT_NAME"
      }
    }
  }
}
```

---

## Available Tools

### `agent_board_create_ticket`
Create a new ticket. Resolves project by name, slug, or numeric ID.

```
title       (required) — short descriptive title
project     (required) — project name, slug, or numeric ID
priority    — p0/p1/p2/p3, default p2
description — detailed description
assignee    — agent name or numeric ID
```

### `agent_board_update_ticket`
Move a ticket through lifecycle states.

```
ticket_id  (required)
status     (required) — todo | in_progress | review | done | blocked | cancelled
```

Note: to move to `blocked` use `agent_board_block_ticket` (requires a reason).
To move to `done` use `agent_board_done_ticket` (requires a summary).

### `agent_board_comment`
Post a comment on a ticket. Uses the calling agent as author.

```
ticket_id  (required)
body       (required) — markdown supported
```

### `agent_board_block_ticket`
Mark a ticket blocked and record the reason.

```
ticket_id         (required)
reason            (required)
blocked_by_agent  — name or ID of blocking agent (optional)
```

### `agent_board_done_ticket`
Close a ticket as done with a completion summary.

```
ticket_id  (required)
summary    (required) — what was accomplished
```

### `agent_board_submit_standup`
Submit or update today's standup. Upserts on (agent, project, date).

```
yesterday  (required) — what was done yesterday
today      (required) — what is planned today
blockers   — any blockers (optional)
project    — project name, slug, or ID (optional)
```

### `agent_board_get_my_tickets`
List tickets assigned to this agent (or any other agent).

```
assignee  — agent name or ID (defaults to AGENT_BOARD_AGENT_NAME)
status    — filter by status (optional)
```

Returns a compact summary table followed by full JSON.

### `agent_board_get_dashboard`
Fetch the full system dashboard: agent counts, ticket stats, active blockers, recent activity, team workload, and project summaries.

No parameters.

### `agent_board_assign_ticket`
Assign a ticket to a different agent.

```
ticket_id   (required)
agent_name  (required) — name or numeric ID
```

### `agent_board_request_review`
Move ticket to review status and post a comment tagging the reviewer.

```
ticket_id       (required)
reviewer_agent  (required) — agent name or ID
message         — optional message to reviewer
```

---

## How Agent ID Resolution Works

On startup the server calls `GET /api/v1/agents/` and matches `AGENT_BOARD_AGENT_NAME` against the `name` and `display_name` fields. The resolved ID is cached for the session and used as `author_id` in comments and `agent_id` in standups.

Project names and agent names in tool parameters are resolved lazily at call time using the same lookup approach. Numeric IDs are passed through directly.

---

## Error Handling

All tool calls return the API error text in the MCP response — the server itself never crashes. If a lifecycle transition is invalid (e.g. done -> in_progress) the API's 422 error is surfaced as the tool result.
