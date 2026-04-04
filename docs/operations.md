# Agent Board — Operations Guide

## Quick Start

```bash
cd ~/Desktop/projects/agent-board

# Start everything
./agent-board.sh start

# Check what's running
./agent-board.sh status

# Stop everything
./agent-board.sh stop
```

---

## Commands

### `./agent-board.sh start`

Starts the full Agent Board stack in the correct order:

1. **Kills** any leftover processes on ports 8001 and 5174
2. **Server** — FastAPI backend (`server/run.py`) on port 8001
3. **Client** — Vite React dev server (`client/`) on port 5174
4. **Waits** for the server to be ready (up to 15s)
5. **Agent Watcher** — scans for Claude Code agents every 30s and auto-registers them
6. **Flush Daemon** — reads tool usage buffer from `/tmp/agent-board-tool-buffer.jsonl` and POSTs events to the API every 5s
7. **Hooks** — installs Claude Code hooks (`hooks/setup_hooks.py`) so agent activity is tracked automatically

If a component is already running, it will be skipped (idempotent).

### `./agent-board.sh stop`

Gracefully shuts down all components:

- Sends `SIGTERM` to each process and waits up to 5s
- Falls back to `SIGKILL` if a process doesn't exit
- Cleans up any straggler processes on ports 8001/5174
- Removes temp files (`/tmp/agent-board-tool-buffer.jsonl`, PID files)

### `./agent-board.sh restart`

Runs `stop` then `start` with a 1s pause in between.

### `./agent-board.sh status`

Shows the running state of each component:

```
Agent Board Status

  ● Server       — running (pid 12345) (port 8001)
  ● Client       — running (pid 12346) (port 5174)
  ● Watcher      — running (pid 12347)
  ● Flush daemon — running (pid 12348)
```

A green `●` means running, red `●` means stopped.

### `./agent-board.sh logs`

Tails all log files simultaneously. Press `Ctrl+C` to stop.

```bash
./agent-board.sh logs
```

To view logs for a single component:

```bash
tail -f /tmp/agent-board-logs/server.log
tail -f /tmp/agent-board-logs/client.log
tail -f /tmp/agent-board-logs/watcher.log
tail -f /tmp/agent-board-logs/flush.log
```

---

## Architecture

### Components

| Component | Process | Port | Interval | Purpose |
|-----------|---------|------|----------|---------|
| Server | `python run.py` | 8001 | — | FastAPI backend + SQLite database |
| Client | `npm run dev` | 5174 | — | React frontend (Vite dev server) |
| Watcher | `agent_watcher.py` | — | 30s | Auto-detects and registers Claude Code agents |
| Flush Daemon | `flush_daemon.py` | — | 5s | Batches tool usage events and sends to API |
| Hooks | `track_tools.sh` | — | per event | Claude Code hook that logs agent activity |

### File Locations

| What | Path |
|------|------|
| Main script | `./agent-board.sh` |
| PID files | `/tmp/agent-board-pids/{server,client,watcher,flush}.pid` |
| Log files | `/tmp/agent-board-logs/{server,client,watcher,flush}.log` |
| Tool buffer | `/tmp/agent-board-tool-buffer.jsonl` |
| Hook scripts | `./hooks/track_tools.sh`, `./hooks/track_agent.sh` |
| Hook installer | `./hooks/setup_hooks.py` |
| Agent watcher | `./tools/agent_watcher.py` |

### Startup Flow

```
agent-board.sh start
│
├─ Kill port 8001, 5174 (cleanup)
│
├─ Start Server (FastAPI)
│   └─ Log → /tmp/agent-board-logs/server.log
│
├─ Start Client (Vite)
│   └─ Log → /tmp/agent-board-logs/client.log
│
├─ Wait for server on port 8001 (max 15s)
│
├─ Start Agent Watcher (every 30s)
│   └─ Log → /tmp/agent-board-logs/watcher.log
│
├─ Start Flush Daemon (every 5s)
│   └─ Log → /tmp/agent-board-logs/flush.log
│
└─ Install Claude Code hooks
```

### Shutdown Flow

```
agent-board.sh stop
│
├─ Stop Flush Daemon   (SIGTERM → wait 5s → SIGKILL)
├─ Stop Agent Watcher  (SIGTERM → wait 5s → SIGKILL)
├─ Stop Client         (SIGTERM → wait 5s → SIGKILL)
├─ Stop Server         (SIGTERM → wait 5s → SIGKILL)
│
├─ Kill stragglers on port 8001, 5174
└─ Clean up temp files
```

---

## Troubleshooting

### Server won't start

```bash
# Check what's using the port
lsof -i :8001

# Check server logs
cat /tmp/agent-board-logs/server.log

# Verify venv exists
ls server/venv/bin/activate
```

### Client won't start

```bash
# Check what's using the port
lsof -i :5174

# Check client logs
cat /tmp/agent-board-logs/client.log

# Reinstall dependencies
cd client && npm install
```

### Hooks not tracking agents

```bash
# Check if hooks are installed
cat ~/.claude/settings.json | python3 -m json.tool | grep track

# Reinstall hooks manually
python3 hooks/setup_hooks.py

# Check hook logs
cat /tmp/agent-board-hooks.log
```

### Flush daemon not sending events

```bash
# Check if buffer file has data
cat /tmp/agent-board-tool-buffer.jsonl

# Check flush daemon logs
cat /tmp/agent-board-logs/flush.log

# Check if server is accepting tracking data
curl -s http://localhost:8001/api/v1/tracking/tool-usage
```

### Force kill everything

If things are stuck, force-kill all components:

```bash
./agent-board.sh stop

# If still hanging:
kill -9 $(lsof -ti :8001) 2>/dev/null
kill -9 $(lsof -ti :5174) 2>/dev/null
rm -rf /tmp/agent-board-pids/
```

---

## Access

| Resource | URL | Credentials |
|----------|-----|-------------|
| Frontend | http://localhost:5174 | admin / admin |
| Backend API | http://localhost:8001/api/v1 | API key auth |
| API Docs | http://localhost:8001/docs | — |
