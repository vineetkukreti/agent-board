# Contributing to Agent Board

Agent Board is a self-hosted AI agent fleet management platform — think Jira/Linear, but purpose-built for tracking AI agents (Claude, GPT-4, etc.) across projects, sprints, and tasks.

---

## What is Agent Board?

Agent Board gives you a real-time dashboard of every AI agent working in your codebase:

- **Agents** — Register AI agents, track their status (active/idle/blocked/offline), and see what they're working on
- **Tickets** — Full Scrum-style ticket lifecycle: todo → in_progress → review → done
- **Sprints** — Time-boxed sprint planning with kanban board view
- **Standups** — Daily progress reports per agent
- **Cost Tracking** — Token usage and USD cost per agent, ticket, and project
- **Activity Feed** — Append-only audit log of every event
- **Claude Code Integration** — Auto-registers agents and creates tickets via Claude Code hooks

It is **API-first** — every feature is accessible via REST, so you can integrate any agent framework.

---

## Architecture at a Glance

```
agent-board/
├── backend/          # Python FastAPI + SQLite (port 8001)
│   ├── app/
│   │   ├── main.py           # App entry point, CORS, router registration
│   │   ├── database.py       # SQLite connection (aiosqlite, WAL mode)
│   │   ├── routes/           # 11 route modules (agents, tickets, sprints, etc.)
│   │   ├── models/
│   │   │   └── schemas.py    # Pydantic v2 enums + shared types
│   │   └── middleware/
│   │       └── auth.py       # Agent key auth + admin session auth
│   └── src/db/
│       ├── schema.sql        # 15 tables (auto-runs on startup)
│       └── seed.sql          # Optional seed data
│
├── frontend/          # React 19 + Vite + TailwindCSS 4 (port 5174)
│   └── src/
│       ├── App.jsx            # Router + protected routes
│       ├── api/               # Axios wrappers (one file per entity)
│       ├── hooks/             # React Query data hooks
│       ├── pages/             # 11 route pages
│       ├── components/        # Reusable UI components
│       └── stores/            # Zustand: authStore, boardStore
│
├── tools/           # CLI, SDK, and agent tracking tools
│   ├── agent_sdk.py          # Zero-dep Python SDK for agents
│   ├── agent_cli.py          # CLI for manual ticket operations
│   ├── agent_watcher.py      # Auto-detects and registers Claude Code agents
│   ├── ingest_sprint.py      # Parses SPRINT_*.md files → tickets
│   └── agent_keys.json       # Stored agent API keys (gitignored in prod)
│
├── hooks/           # Claude Code event hooks
│   ├── track_agent.sh        # Auto-creates tickets when agents are spawned
│   ├── track_tools.sh        # Buffers every tool call (Read/Edit/Bash/etc.)
│   ├── flush_daemon.py       # Drains the buffer every 5s → API
│   └── setup_hooks.py        # Installs hooks into ~/.claude/settings.json
│
└── docs/
    └── operations.md         # Startup, shutdown, and troubleshooting
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, aiosqlite, Pydantic v2 |
| Frontend | React 19, Vite, TailwindCSS 4, React Query v5, Zustand v5 |
| Database | SQLite (WAL mode) |
| Auth | SHA-256 API keys (agents) + bcrypt sessions (admins) |
| Agent Integration | Claude Code hooks (bash + Python) |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- Git

### Setup

```bash
git clone https://github.com/your-org/agent-board.git
cd agent-board

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py          # starts on http://localhost:8001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # starts on http://localhost:5174
```

Open http://localhost:5174 and log in with `admin` / `admin`.

The API docs (Swagger UI) are at http://localhost:8001/docs.

### One-liner start (if orchestration script is set up)

```bash
./agent-board.sh start
```

---

## How the Codebase Fits Together

### Request Flow (API)

```
HTTP Request
  → FastAPI router (backend/app/main.py)
  → Auth middleware (middleware/auth.py)
      → Agent: Bearer API key → SHA-256 lookup in agents table
      → Admin: Bearer session token → in-memory session dict
  → Route handler (routes/*.py)
      → aiosqlite query
      → Pydantic response model
  → JSON response
```

### Frontend Data Flow

```
User action
  → React component
  → React Query mutation (hooks/use*.js)
  → Axios API call (api/*.js)
  → Server
  → onSuccess: invalidateQueries → refetch
  → UI updates
```

### Agent Auto-Tracking Flow

```
Claude Code spawns an agent
  → PreToolUse hook (track_agent.sh) fires
  → Extracts agent_name, project, task from prompt
  → POST /api/v1/tracking/auto-register
      → creates agent + project + ticket in one call
  → Stores ticket_id in /tmp/agent-board-ticket-store.json

Agent does work (Read/Edit/Bash/etc.)
  → track_tools.sh appends to /tmp/agent-board-tool-buffer.jsonl (fast)

Flush daemon (every 5s)
  → Reads buffer
  → POST /api/v1/tracking/tool-usage (batch)

Agent finishes
  → PostToolUse hook marks ticket done
```

---

## Key Files to Know

| File | What it does |
|------|-------------|
| `backend/app/routes/tickets.py` | Most complex route — full ticket CRUD + state machine (818 lines) |
| `backend/app/routes/tracking.py` | Auto-registration + cost tracking (710 lines) |
| `backend/src/db/schema.sql` | Single source of truth for the DB schema |
| `backend/app/middleware/auth.py` | Both auth paths (agent key + admin session) |
| `frontend/src/App.jsx` | All routes and the auth guard |
| `frontend/src/api/axiosInstance.js` | Base axios config: auth header + 401 redirect |
| `tools/agent_sdk.py` | What external agents import to self-report work |

---

## Ticket State Machine

All status transitions are enforced server-side in `routes/tickets.py`:

```
todo  ──────────────────────►  in_progress  ──►  review  ──►  done
  ▲                               │   ▲                          (terminal)
  │                               ▼   │
  │                           blocked ─┘
  │
  └──────────────────────────────────────────────────────────── cancelled
                                                                  (terminal)
```

Use the dedicated transition endpoints — do not `PUT` the status field directly.

---

## Database Schema Overview

15 tables in `backend/src/db/schema.sql`. Key ones:

| Table | Purpose |
|-------|---------|
| `agents` | AI agent registry (name, status, API key hash, team) |
| `agent_types` | Categories of agents (e.g., "code-agent", "analyst") |
| `teams` | Logical groupings of agents |
| `projects` | Work containers |
| `tickets` | Work items with full lifecycle |
| `sprints` | Time-boxed sprint containers |
| `standup_entries` | Daily agent reports |
| `activity_log` | Append-only audit trail |
| `agent_sessions` | Claude Code session records (tokens, cost) |
| `tool_usage_log` | Per-tool call events |
| `ticket_metrics` | Aggregated cost/usage per ticket |

Foreign key cascades: deleting a project cascades to its tickets, sprints, and standups.

---

## How to Contribute

### Adding a New Backend Endpoint

1. **Add your schema** — Define request/response Pydantic models at the top of the route file (or in `models/schemas.py` if shared).

2. **Write the route handler** in the appropriate `backend/app/routes/*.py` file. Use `async def` and `Depends(get_db)`:
   ```python
   @router.post("/", response_model=MyResponse)
   async def create_thing(body: MyCreate, db=Depends(get_db)):
       ...
   ```

3. **Auth** — Add the right dependency:
   - `Depends(get_current_admin)` for admin-only endpoints
   - `Depends(get_current_agent)` for agent-authenticated endpoints
   - `Depends(require_auth)` if either works

4. **Log to activity** — For any mutation that changes entity state, insert a row into `activity_log`.

5. **Verify in Swagger** — http://localhost:8001/docs auto-generates from your docstrings.

6. **Wire up the client**:
   - Add a function to `frontend/src/api/{entity}.js`
   - Add `useQuery` / `useMutation` hooks to `frontend/src/hooks/use{Entity}.js`
   - Call the hook from your page/component

### Adding a New Frontend Page

1. Create `frontend/src/pages/{Name}Page.jsx`
2. Add a route in `frontend/src/App.jsx` inside the `<AppShell>` block
3. Add a nav link in `frontend/src/components/layout/Sidebar.jsx`
4. Use existing hooks from `frontend/src/hooks/` — don't call axios directly from pages

### Adding a New CLI Command

1. Add a subcommand to `tools/agent_cli.py` using argparse
2. Implement the logic using `AgentBoard` from `tools/agent_sdk.py`
3. Test: `python3 tools/agent_cli.py <your-command> --help`

### Modifying the Database Schema

1. Edit `backend/src/db/schema.sql` — this is the source of truth
2. The schema runs on `init_db()` which fires on server startup
3. For an existing database, either delete `backend/data/agent-board.db` (dev only) or write a migration script
4. There is currently no migration framework — changes are applied manually

---

## Code Conventions

### Backend (Python)

- Async everywhere: all route handlers and DB calls use `async/await`
- Schemas defined in the route file unless they're shared across routes
- Use `aiosqlite` cursor directly — no ORM
- Error responses: raise `HTTPException(status_code=..., detail="...")`
- Pagination: `?page=1&per_page=50` pattern, return `{"items": [...], "pagination": {...}}`

### Frontend (JavaScript/React)

- **Never call axios directly from a component** — always go through a hook
- React Query hooks follow this naming: `useTickets`, `useCreateTicket`, `useUpdateTicket`
- `queryKey` arrays: `['tickets']`, `['tickets', id]`, `['tickets', filters]`
- Invalidate related queries on mutation success (e.g., updating a ticket also invalidates `['dashboard']`)
- Tailwind utility classes — no custom CSS files unless unavoidable

### Git

- Commit messages: imperative mood, present tense (`fix: CORS mismatch`, `feat: add sprint board`)
- Prefix: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- One logical change per commit

---

## Running the Full Stack Locally

```bash
# Start everything
./agent-board.sh start

# Check status
./agent-board.sh status

# Tail logs
./agent-board.sh logs

# Stop
./agent-board.sh stop
```

**Individual component logs:**
```
/tmp/agent-board-logs/server.log
/tmp/agent-board-logs/client.log
/tmp/agent-board-logs/watcher.log
/tmp/agent-board-logs/flush.log
/tmp/agent-board-hooks.log
```

**Check API health:**
```bash
curl http://localhost:8001/api/health
```

**Reset the database (dev only):**
```bash
rm backend/data/agent-board.db
# Restart the server — schema auto-applies
```

---

## Using the Agent SDK

If you're building an agent that should report work to Agent Board:

```python
from tools.agent_sdk import AgentBoard

board = AgentBoard(agent_name="my-agent")

# Create and track a ticket
ticket = board.create_ticket("Implement feature X", project="my-project", priority="p1")
board.start_ticket(ticket["id"])
# ... do the work ...
board.done_ticket(ticket["id"], summary="Implemented X, added tests")

# Submit a standup
board.submit_standup(
    yesterday="Finished feature X",
    today="Starting feature Y",
    blockers="Waiting on API key from team"
)
```

API key resolution order:
1. Explicit `api_key=` argument
2. `AGENT_BOARD_API_KEY` environment variable
3. Entry in `tools/agent_keys.json` keyed by agent name

---

## Pull Request Guidelines

- **Target branch:** `main`
- Keep PRs focused — one feature or fix per PR
- Include a short description of what changed and why
- If you're adding a new API endpoint, note the route and method in the PR description
- The project owner reviews and merges all PRs

---

## Questions?

Open an issue or check `docs/operations.md` for detailed operational runbook.
