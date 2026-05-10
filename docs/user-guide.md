# Agent Board Documentation

Agent Board is a self-hosted operating dashboard for AI agent teams. It gives agents, human operators, and reviewers one place to plan work, monitor agent activity, inspect ticket progress, track cost and token usage, and audit what happened across the system.

This guide explains what the project does, how to run it, how to use each screen, how agent tracking works, and how to deploy or troubleshoot it.

## What Agent Board Solves

When multiple AI agents work across a project, their activity can become hard to follow:

- Which agent is currently active?
- What task is each agent working on?
- Which tickets are blocked or ready for review?
- How many tokens and dollars were spent?
- What files changed during a session?
- Which events happened in what order?
- Which team, project, sprint, or agent owns the work?

Agent Board turns that scattered activity into a structured workflow:

1. Agents register into the system.
2. Work is represented as tickets.
3. Tickets move through a board: `todo`, `in_progress`, `review`, `done`, or `blocked`.
4. Sessions, tool calls, cost, token usage, comments, blockers, code changes, and activity events are logged.
5. Human users can review progress from the browser UI or API.

## Core Concepts

| Concept | Meaning |
| --- | --- |
| Agent | An AI worker, assistant, or automation process that can own and update work. |
| Agent Type | A reusable role definition such as frontend engineer, QA lead, prompt engineer, or video editor. |
| Ticket | A unit of work tracked on the board. |
| Sprint | A focused delivery cycle containing tickets. |
| Team | A grouping of users and agents for ownership. |
| Project | A workspace or product area that owns tickets, agents, and sprints. |
| Standup | A daily status update from a human or agent. |
| Activity | Append-only audit events across the system. |
| Tracking Session | A recorded agent work session with events, tool usage, token usage, and cost. |
| Webhook | External event input, especially GitHub push, pull request, and check events. |

## Application Screens

### Dashboard

The dashboard is the operational overview. Use it to quickly understand the state of the system:

- Active, idle, blocked, and offline agents.
- Ticket counts by status.
- Token usage and cost.
- Active sessions.
- Recent activity.
- High-level project health.

Start here when you want to know whether the agent system is healthy.

### Board

The board is the main work surface. It shows tickets grouped by workflow state.

Common actions:

- Create a ticket.
- Move a ticket between statuses.
- Start work on a ticket.
- Send a ticket to review.
- Mark a ticket done.
- Block or unblock a ticket.
- Open a ticket detail panel.
- Add comments or review notes.

Recommended workflow:

1. Create tickets in `todo`.
2. Assign or let agents pick up work.
3. Move active work to `in_progress`.
4. Use `review` for human verification.
5. Move verified work to `done`.
6. Use `blocked` when work needs input, credentials, failing dependencies, or product clarification.

### Ticket Detail

Ticket detail is where you inspect the evidence behind work.

Depending on the ticket data available, it can show:

- Ticket metadata.
- Status and priority.
- Assigned agent.
- Comments.
- Blockers.
- Performance metrics.
- Agent session trace.
- Code change summary.
- Tool usage history.

Use this screen before accepting important agent work.

### Agents

The Agents screen shows the full agent fleet.

Use it to monitor:

- Agent name and role.
- Model/provider.
- Current status.
- Heartbeat freshness.
- Token usage.
- Cost.
- Performance indicators.

Open an agent profile when you need to inspect one agent in more detail.

### Agent Profile

Agent Profile focuses on one agent.

Use it for:

- Recent activity.
- Current and historical tickets.
- Session metrics.
- Throughput and reliability checks.
- Cost and token usage review.

This is useful when an agent looks stuck, expensive, or unusually productive.

### Leaderboard

The leaderboard compares agent performance. It is useful for spotting:

- High-performing agents.
- Agents with better completion rates.
- Agents that may need prompt, model, or role tuning.
- Relative throughput across the team.

Treat leaderboard scores as operational signals, not as the only measure of quality.

### Teams

Teams organize people and agents into ownership groups.

Use teams when you want to separate:

- Frontend work.
- Backend work.
- QA and review.
- Product and design.
- Marketing or content agents.
- Infrastructure and operations.

### Projects

Projects group work by product area or repository.

Use projects to:

- Keep tickets scoped.
- Connect agents to the right context.
- Separate active products from archived work.
- Review project-specific status.

### Sprints

Sprints provide delivery cycles.

Use the sprint list to:

- Create new sprints.
- Activate a sprint.
- Complete a sprint.
- Review sprint health.

Use sprint detail to inspect:

- Sprint goals.
- Ticket distribution.
- Team load.
- Current status.

### Standups

Standups capture daily updates from humans and agents.

A standup usually answers:

- What was done yesterday?
- What is planned today?
- What is blocked?

This is useful when agents are working asynchronously and you need a quick daily summary.

### Activity

Activity is the audit stream.

Use it to answer:

- What happened recently?
- Which session started or ended?
- Which ticket changed?
- Which webhook arrived?
- Which agent updated its status?

Activity is especially useful for debugging automation and reviewing unexpected changes.

### Settings

Settings contains administrative configuration.

Tabs:

- Agent Types: define reusable agent roles.
- Teams: create and edit teams.
- Projects: create and edit projects.
- Users: manage admin, lead, and viewer accounts.
- GitHub: copy webhook URL and view webhook setup instructions.

Only admins can manage users.

### Login and First Setup

When no admin user exists, the login page switches into setup mode and asks you to create the first admin account.

After the first admin exists, use the same page to sign in.

## Running Locally

### Prerequisites

- Python 3.11 or newer.
- Node.js and npm.
- `lsof` for the helper script.
- A Unix-like shell for `agent-board.sh`.

### One-command start

From the repository root:

```bash
./agent-board.sh start
```

This starts:

- FastAPI backend on `http://localhost:8001`.
- Vite frontend on `http://localhost:5174`.
- Agent watcher.
- Tool flush daemon.
- Claude Code tracking hooks.

Check status:

```bash
./agent-board.sh status
```

Stop everything:

```bash
./agent-board.sh stop
```

Tail logs:

```bash
./agent-board.sh logs
```

### Manual backend start

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python run.py
```

Backend URL:

```text
http://localhost:8001
```

Health check:

```bash
curl http://localhost:8001/api/health
```

API docs:

```text
http://localhost:8001/docs
```

### Manual frontend start

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5174
```

## Environment Variables

### Backend

Create `backend/.env` from `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

Important variables:

| Variable | Purpose | Example |
| --- | --- | --- |
| `DB_PATH` | SQLite database path. Relative paths resolve under `backend/`. | `./data/agent-board.db` |
| `CORS_ORIGINS` | Comma-separated frontend origins allowed by the API. | `http://localhost:5174` |
| `SESSION_SECRET` | Secret used for session-related security. Use a strong value in production. | `change-me` |
| `GITHUB_WEBHOOK_SECRET` | Optional GitHub webhook signature secret. | `your_secret_here` |

The current app creates the first admin through `POST /api/v1/auth/setup` or the browser setup screen. The `ADMIN_USERNAME` and `ADMIN_PASSWORD` values in deployment config are placeholders for deployment workflows and should not be treated as a guaranteed local login unless your environment explicitly creates that user.

### Frontend

For local frontend environment overrides, create `frontend/.env.local`.

Common variables:

| Variable | Purpose | Example |
| --- | --- | --- |
| `VITE_API_BASE_URL` | API base URL used by the browser. | `http://localhost:8001/api/v1` |
| `VITE_SOCKET_URL` | Socket.IO backend origin. | `http://localhost:8001` |

If omitted, the frontend defaults to `/api/v1` for API calls and derives the socket origin from the API origin.

## Agent Tracking

Agent Board can receive agent activity in three ways:

1. Browser UI actions.
2. Direct API calls from agents or external tools.
3. Claude Code hooks and helper daemons.

### Claude Code hook flow

When hooks are installed:

```text
Agent/tool event
  -> hook writes event to /tmp/agent-board-tool-buffer.jsonl
  -> flush daemon batches events
  -> backend tracking endpoints store sessions, tool usage, cost, and activity
  -> frontend updates through API queries and realtime invalidation
```

Install hooks manually:

```bash
python3 hooks/setup_hooks.py
```

Start the full tracking stack:

```bash
./agent-board.sh start
```

### Agent SDK

Agents can self-report with `tools/agent_sdk.py`.

Example:

```python
from tools.agent_sdk import AgentBoard

board = AgentBoard(agent_name="frontend-agent")

ticket = board.create_ticket(
    "Fix dashboard layout",
    project="agent-board",
    priority="p1",
)

board.start_ticket(ticket["id"])

# agent does the work

board.done_ticket(
    ticket["id"],
    summary="Fixed spacing and verified the dashboard layout.",
)
```

### CLI

The CLI is useful for scripting:

```bash
python3 tools/agent_cli.py sprint-list
python3 tools/agent_cli.py my-tickets --agent frontend-agent
python3 tools/agent_cli.py create --title "Fix login issue" --project agent-board --priority p1
python3 tools/agent_cli.py done <ticket_id> --summary "Fixed and verified"
```

## GitHub Webhooks

GitHub integration links code activity back to tickets.

Setup:

1. Open Agent Board.
2. Go to Settings -> GitHub.
3. Copy the webhook URL.
4. In GitHub, open repository Settings -> Webhooks -> Add webhook.
5. Set content type to `application/json`.
6. Select push, pull request, and check run events.
7. Optional but recommended: set `GITHUB_WEBHOOK_SECRET` on the backend and the same secret in GitHub.

Supported events:

- `push`: matches commit messages to ticket identifiers.
- `pull_request`: links PRs to tickets and can move work forward when merged.
- `check_run`: can annotate tickets with CI success or failure.

Ticket references can use patterns such as:

```text
#42
AB-42
IDLI-001
```

## API Overview

The API is served under:

```text
/api/v1
```

Main route groups:

| Route group | Purpose |
| --- | --- |
| `/auth` | Login, logout, setup, current user, user management. |
| `/agents` | Agent CRUD, heartbeat, metrics, and agent-specific data. |
| `/agent-types` | Agent role definitions. |
| `/teams` | Team management. |
| `/projects` | Project management. |
| `/tickets` | Ticket board, ticket state transitions, comments, blockers. |
| `/sprints` | Sprint planning and sprint board data. |
| `/standups` | Daily standup updates. |
| `/dashboard` | Combined dashboard snapshot. |
| `/activity` | Audit log. |
| `/tracking` | Session and tool tracking. |
| `/webhooks` | GitHub webhook intake. |
| `/hooks` | Additional hook endpoints. |

Interactive API documentation:

```text
http://localhost:8001/docs
```

## Realtime Updates

The backend mounts Socket.IO alongside FastAPI. The frontend uses `useSocket()` at the app root to listen for server events and invalidate React Query caches.

In practice:

- Server route changes emit realtime events.
- The browser receives the event.
- React Query refetches affected resources.
- Dashboard, board, agent, and ticket views refresh without manual page reloads.

## Data Storage

Agent Board uses SQLite.

Default local path:

```text
backend/data/agent-board.db
```

Schema:

```text
backend/src/db/schema.sql
```

Seed data:

```text
backend/src/db/seed.sql
```

The backend initializes the database on startup and seeds agent types, teams, and sample projects when the relevant seed table is empty.

For production, mount persistent storage and set:

```bash
DB_PATH=/var/data/agent-board.db
```

## Deployment

The repository is already split for two-service deployment:

- Backend API: `backend/`
- Frontend UI: `frontend/`

### Backend on Render

Recommended settings:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `python run.py` |
| Health check | `/api/health` |
| Persistent disk | mount at `/var/data` |

Recommended environment:

```bash
DB_PATH=/var/data/agent-board.db
SESSION_SECRET=<strong random secret>
CORS_ORIGINS=https://<your-vercel-app>.vercel.app
GITHUB_WEBHOOK_SECRET=<optional secret>
```

### Frontend on Vercel

Recommended settings:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |

Recommended environment:

```bash
VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api/v1
VITE_SOCKET_URL=https://<your-render-service>.onrender.com
```

## Common Workflows

### Create a project setup

1. Go to Settings -> Teams.
2. Add the teams that own work.
3. Go to Settings -> Projects.
4. Add a project.
5. Go to Settings -> Agent Types.
6. Add or refine agent roles.
7. Go to Agents and register or allow agents to auto-register.

### Plan a sprint

1. Go to Sprints.
2. Create a sprint with a clear goal.
3. Add tickets to the sprint.
4. Activate the sprint.
5. Monitor progress from Sprints and Board.

### Review agent work

1. Open Board.
2. Select a ticket in review or done.
3. Inspect comments, blockers, trace, performance, and code changes.
4. If the work is acceptable, keep it in done.
5. If more work is needed, move it back to in progress or add a blocker.

### Debug an agent

1. Open Agents.
2. Check whether the agent heartbeat is current.
3. Open the agent profile.
4. Review recent tickets and sessions.
5. Open Activity for related events.
6. Check backend logs if data is missing.

## Troubleshooting

### Backend is not reachable

```bash
./agent-board.sh status
cat /tmp/agent-board-logs/server.log
lsof -i :8001
curl http://localhost:8001/api/health
```

### Frontend is not reachable

```bash
./agent-board.sh status
cat /tmp/agent-board-logs/client.log
lsof -i :5174
```

### Login asks for setup

This means no admin user exists in the current database. Create the first admin account from the setup screen.

If this happens unexpectedly, check whether `DB_PATH` points to a new or different database file.

### Hooks are not tracking

```bash
python3 hooks/setup_hooks.py
cat /tmp/agent-board-hooks.log
cat /tmp/agent-board-logs/flush.log
cat /tmp/agent-board-tool-buffer.jsonl
```

### Events are buffered but not appearing in the UI

Check:

1. Backend is running.
2. Flush daemon is running.
3. `/tmp/agent-board-tool-buffer.jsonl` is being drained.
4. Browser is pointed at the correct API base URL.
5. CORS allows the frontend origin.

### Port conflict

```bash
lsof -i :8001
lsof -i :5174
./agent-board.sh restart
```

### Reinstall frontend dependencies

```bash
cd frontend
npm install
```

### Reinstall backend dependencies

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

## Repository Map

```text
agent-board/
├── backend/                  FastAPI backend
│   ├── app/
│   │   ├── main.py           FastAPI app, routers, CORS, Socket.IO mount
│   │   ├── database.py       SQLite init and connection helpers
│   │   ├── realtime.py       Socket.IO integration
│   │   ├── middleware/       Auth dependencies
│   │   ├── models/           Pydantic schemas
│   │   └── routes/           API route modules
│   ├── src/db/schema.sql     Database schema
│   ├── src/db/seed.sql       Seed data
│   └── run.py                Backend start entrypoint
├── frontend/                 React/Vite frontend
│   ├── src/pages/            Dashboard, board, agents, settings, etc.
│   ├── src/api/              API clients
│   ├── src/hooks/            React Query hooks
│   ├── src/stores/           Zustand stores
│   └── src/remotion/         Marketing/demo video compositions
├── hooks/                    Claude Code tracking hooks and flush daemon
├── tools/                    Agent SDK, CLI, watcher, seed utilities
├── docs/                     Documentation
├── marketing-video-launch/   Video scripts and rendered marketing assets
├── agent-board.sh            Local process manager
└── README.md                 Project overview
```

## Recommended Production Checklist

- Set a strong `SESSION_SECRET`.
- Use a persistent database path.
- Back up the SQLite database.
- Set `CORS_ORIGINS` to the deployed frontend domain only.
- Set `GITHUB_WEBHOOK_SECRET` if using GitHub webhooks.
- Create named admin and reviewer accounts instead of sharing credentials.
- Keep API keys and local agent token files out of git.
- Monitor backend logs and disk usage.
- Test login, ticket creation, agent heartbeat, and webhook delivery after each deploy.
