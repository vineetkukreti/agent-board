# Agent Board

A self-hosted, API-first Scrum/Jira-like platform for managing AI agent fleets across projects.

## Architecture

- **Client**: React 19 + Vite + TailwindCSS 4 (in `frontend/`, port 5174)
- **Server**: Python FastAPI + SQLite via aiosqlite (in `backend/`, port 8001)
- **State management**: Zustand (frontend), React Query for server state
- **Database**: SQLite (`backend/data/agent-board.db`)

## Development

```bash
# Server (requires venv)
cd backend && source venv/bin/activate && python run.py

# Client
cd frontend && npm run dev
```

## API

All endpoints under `/api/v1/`. Key routes:
- `/api/v1/auth/` — Admin login/setup
- `/api/v1/agents/` — Agent CRUD + registration + heartbeat
- `/api/v1/tickets/` — Full ticket lifecycle
- `/api/v1/dashboard/` — CEO dashboard aggregation
- `/api/v1/standups/` — Daily standup entries
- `/api/v1/activity/` — Activity feed

## Key directories

- `frontend/src/` — React frontend source
- `backend/app/` — FastAPI application code
- `backend/app/routes/` — API route handlers
- `backend/app/services/` — Business logic
- `backend/app/models/` — Pydantic schemas
- `backend/app/middleware/` — Auth middleware
- `backend/src/db/` — Schema and seed SQL

<!-- AGENT-BOARD-TRACKING-START -->
## Agent Board — Work Tracking Rules

All work in this project is tracked on Agent Board (http://localhost:8001).
The board auto-detects agents via Claude Code hooks — you don't need to do anything special.
But following these rules ensures better tracking and visibility.

### Sprint Files
When planning a sprint, write the plan to a file named `SPRINT_*.md` (e.g., `SPRINT_1.md`, `SPRINT_PERFORMANCE.md`).
The board auto-ingests these files when written. Use this format:

```markdown
# Sprint Name

## Sprint Meta
| Field | Value |
|-------|-------|
| Start Date | 2026-04-01 |
| End Date | 2026-04-14 |

## North Star
**"The goal of this sprint"**

## Sprint Backlog
### P0 -- Critical
| ID | Title | Description | Squad | Size | Dependencies | Status |
|----|-------|-------------|-------|------|--------------|--------|
| TASK-001 | Fix the bug | Description here | Lead: Agent. Executor: Agent2 | M | None | TODO |
```

### Agent Naming
When spawning sub-agents, use their registered name as the `subagent_type`:
- Good: `Agent(subagent_type="rahul", prompt="...")`
- Bad: `Agent(subagent_type="general-purpose", prompt="...")`

This ensures the board correctly identifies which agent is doing the work.

### Task Descriptions
Include the sprint and task reference in prompts when delegating:
- Good: `"Sprint 2, Task T3. Build the API endpoint for..."`
- Bad: `"Build the API endpoint for..."`

This lets the board auto-link tickets to the correct sprint.

### Standups
Agents should report progress. The board auto-generates standups from git commits,
but explicit standups via the SDK are more accurate:
```python
from agent_sdk import AgentBoard
board = AgentBoard(agent_name="your-name")
board.submit_standup(yesterday="Fixed 3 bugs", today="Working on auth", blockers="")
```

### CLI Commands (for manual tracking)
```bash
cd /home/vineet/Desktop/projects/agent-board
python3 tools/agent_cli.py sprint-list                     # List sprints
python3 tools/agent_cli.py sprint 6                        # Sprint details
python3 tools/agent_cli.py sprint-ingest SPRINT_1.md       # Ingest sprint file
python3 tools/agent_cli.py create --title "Fix bug" --project "project-name" --priority p1
python3 tools/agent_cli.py my-tickets --agent your-name
```

### Dashboard
View the board at http://localhost:5174 (login: admin/admin)

<!-- AGENT-BOARD-TRACKING-END -->
