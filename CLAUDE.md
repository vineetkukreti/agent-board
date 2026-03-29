# Agent Board

A self-hosted, API-first Scrum/Jira-like platform for managing AI agent fleets across projects.

## Architecture

- **Client**: React 19 + Vite + TailwindCSS 4 (in `client/`, port 5174)
- **Server**: Python FastAPI + SQLite via aiosqlite (in `server/`, port 8001)
- **State management**: Zustand (client), React Query for server state
- **Database**: SQLite (`server/data/agent-board.db`)

## Development

```bash
# Server (requires venv)
cd server && source venv/bin/activate && python run.py

# Client
cd client && npm run dev
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

- `client/src/` — React frontend source
- `server/app/` — FastAPI application code
- `server/app/routes/` — API route handlers
- `server/app/services/` — Business logic
- `server/app/models/` — Pydantic schemas
- `server/app/middleware/` — Auth middleware
- `server/src/db/` — Schema and seed SQL
