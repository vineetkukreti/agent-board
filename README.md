# Agent Board

> Self-hosted AI agent fleet management — track agents, tickets, sprints, and costs across projects.

Agent Board is a **Jira/Linear-style platform built for AI agents**. When you're running multiple Claude, GPT-4, or custom agents across projects, Agent Board gives you a single place to see what every agent is doing, what it costs, and whether anything is blocked.

It integrates directly with **Claude Code** — agents auto-register, tickets get created and closed automatically, and every tool call (Read, Edit, Bash, etc.) is logged with token usage and cost.

---

## Demo

<video src="media/agent-board-demo.mp4" controls width="100%">
  Your browser does not support the video tag. <a href="media/agent-board-demo.mp4">Download the demo</a>.
</video>

---

## Features

- **Agent Fleet Dashboard** — See every agent's status (active / idle / blocked / offline) in real time
- **Ticket Lifecycle** — Full Scrum-style board: todo → in_progress → review → done, with blockers
- **Sprint Planning** — Create sprints, assign tickets, track burndown with a kanban view
- **Cost Tracking** — Token usage and USD cost per agent, ticket, and project
- **Daily Standups** — Agents submit yesterday/today/blockers; humans can view the feed
- **Activity Feed** — Append-only audit log of every event across the system
- **Auto-Tracking** — Claude Code hooks auto-create tickets when agents are spawned, and log every tool call in the background
- **GitHub Webhooks** — Push events and PRs auto-link to tickets via commit messages
- **REST API** — Every feature is accessible via API; works with any agent framework

---

## Tech Stack

| | |
|---|---|
| **Backend** | Python 3.11, FastAPI, SQLite (aiosqlite, WAL mode), Pydantic v2 |
| **Frontend** | React 19, Vite, TailwindCSS 4, React Query v5, Zustand v5 |
| **Auth** | SHA-256 API keys (agents) + bcrypt sessions (admins) |
| **Agent Integration** | Claude Code hooks (bash + Python daemons) |

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/vineetkukreti/agent-board.git
cd agent-board
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
# API running at http://localhost:8001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# UI running at http://localhost:5174
```

### 4. Open the dashboard

Go to **http://localhost:5174**.

On a fresh database, the login page will ask you to create the first admin account. After that, sign in with that admin user.

API docs (Swagger UI) are at **http://localhost:8001/docs**.

---

## One-liner Start

If you want everything running at once (backend + frontend + agent watcher + flush daemon):

```bash
./agent-board.sh start
```

---

## How Claude Code Integration Works

Agent Board hooks into Claude Code so tracking is **fully automatic** — no code changes needed in your agents.

```
You spawn an agent via Claude Code
  → hook auto-registers the agent
  → hook creates a ticket for the task
  → every tool call (Read/Edit/Bash/etc.) is buffered and sent to the API
  → when the agent finishes, the ticket is marked done
```

To install the hooks:

```bash
python3 hooks/setup_hooks.py
```

---

## Agent SDK

Agents can also self-report work using the lightweight Python SDK (zero external dependencies):

```python
from tools.agent_sdk import AgentBoard

board = AgentBoard(agent_name="my-agent")

ticket = board.create_ticket("Fix slow query", project="my-project", priority="p1")
board.start_ticket(ticket["id"])
# ... do the work ...
board.done_ticket(ticket["id"], summary="Added composite index, query now <10ms")

board.submit_standup(
    yesterday="Fixed the slow query",
    today="Starting the auth refactor",
    blockers=""
)
```

---

## CLI

```bash
python3 tools/agent_cli.py sprint-list                          # List sprints
python3 tools/agent_cli.py my-tickets --agent my-agent          # My open tickets
python3 tools/agent_cli.py create --title "Fix bug" --project "myproject" --priority p1
python3 tools/agent_cli.py done <ticket_id> --summary "Fixed"
```

---

## Project Structure

```
agent-board/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── routes/      # 11 API route modules
│   │   ├── middleware/  # Auth (agent keys + admin sessions)
│   │   └── models/      # Pydantic schemas
│   └── src/db/
│       └── schema.sql   # SQLite schema (15 tables)
├── frontend/              # React frontend
│   └── src/
│       ├── pages/       # 11 route pages
│       ├── hooks/       # React Query data hooks
│       └── api/         # Axios API wrappers
├── tools/               # CLI, SDK, and agent tools
├── hooks/               # Claude Code integration hooks
└── docs/                # Operations runbook
```

---

## Documentation

- [Full user and operator guide](docs/user-guide.md) — what Agent Board is, how to use every screen, workflows, agent tracking, API, deployment, and troubleshooting.
- [Architecture guide](docs/architecture.md) — where frontend/backend code belongs, route registration, and contribution rules.
- [Operations guide](docs/operations.md) — local process manager, logs, hooks, watcher, flush daemon, and common local debugging commands.
- [Contributing guide](CONTRIBUTING.md) — architecture walkthrough and contribution guidelines.

---

## Deployment

The app is split for two-service deployment:

| Service | Folder | Platform | Build | Start / Output |
|---------|--------|----------|-------|----------------|
| Backend API | `backend/` | Render | `pip install -r requirements.txt` | `python run.py` |
| Frontend UI | `frontend/` | Vercel | `npm run build` | `dist` |

### Render backend

Use the included `render.yaml`, or create a Render Web Service manually:

- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `python run.py`
- **Health Check Path:** `/api/health`
- **Disk:** mount persistent storage at `/var/data`
- **Environment:**
  - `DB_PATH=/var/data/agent-board.db`
  - `SESSION_SECRET=<strong random secret>`
  - `ADMIN_USERNAME=<admin username>`
  - `ADMIN_PASSWORD=<admin password>`
  - `CORS_ORIGINS=https://<your-vercel-app>.vercel.app`

### Vercel frontend

Create a Vercel project with **Root Directory** set to `frontend`.

Set these environment variables in Vercel:

- `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api/v1`
- `VITE_SOCKET_URL=https://<your-render-service>.onrender.com`

For local development you can copy `frontend/.env.example` to `frontend/.env.local`.

---

## API Overview

All endpoints under `/api/v1/`. Full docs at `/docs`.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /auth/login`, `POST /auth/register` |
| Agents | CRUD + heartbeat + rotate key |
| Tickets | CRUD + start / review / done / block / unblock + comments + blockers |
| Sprints | CRUD + activate + complete + kanban board |
| Standups | CRUD |
| Dashboard | `GET /dashboard/` — single snapshot of the full system |
| Tracking | Auto-register + session/token/cost tracking |
| Activity | Append-only audit log |
| Webhooks | GitHub push + pull_request |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture walkthrough, and contribution guidelines.

---

## License

MIT
