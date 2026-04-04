#!/usr/bin/env bash
# agent-board.sh — Start, stop, and check status of the Agent Board stack.
#
# Usage:
#   ./agent-board.sh start    — Start server, client, watcher, flush daemon, and install hooks
#   ./agent-board.sh stop     — Stop all components
#   ./agent-board.sh restart  — Stop then start
#   ./agent-board.sh status   — Show what's running
#   ./agent-board.sh logs     — Tail all log files

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PIDDIR="/tmp/agent-board-pids"
LOGDIR="/tmp/agent-board-logs"

# Ports
SERVER_PORT=8001
CLIENT_PORT=5174

# PID files
PID_SERVER="$PIDDIR/server.pid"
PID_CLIENT="$PIDDIR/client.pid"
PID_WATCHER="$PIDDIR/watcher.pid"
PID_FLUSH="$PIDDIR/flush.pid"

# Log files
LOG_SERVER="$LOGDIR/server.log"
LOG_CLIENT="$LOGDIR/client.log"
LOG_WATCHER="$LOGDIR/watcher.log"
LOG_FLUSH="$LOGDIR/flush.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ensure_dirs() {
  mkdir -p "$PIDDIR" "$LOGDIR"
}

is_running() {
  local pidfile="$1"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

kill_by_pidfile() {
  local pidfile="$1"
  local name="$2"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      # Wait up to 5s for graceful shutdown
      for _ in {1..10}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.5
      done
      # Force kill if still alive
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
      fi
      echo -e "  ${RED}■${NC} Stopped $name (pid $pid)"
    else
      echo -e "  ${YELLOW}■${NC} $name was not running (stale pid $pid)"
    fi
    rm -f "$pidfile"
  fi
}

kill_by_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    echo -e "  ${RED}■${NC} Killed leftover process(es) on port $port"
  fi
}

wait_for_port() {
  local port="$1"
  local timeout="${2:-15}"
  local elapsed=0
  while ! lsof -ti :"$port" >/dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [[ $elapsed -ge $timeout ]]; then
      return 1
    fi
  done
  return 0
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

do_start() {
  ensure_dirs
  echo -e "${CYAN}Starting Agent Board...${NC}"
  echo ""

  # --- Kill anything on our ports first ---
  kill_by_port $SERVER_PORT
  kill_by_port $CLIENT_PORT

  # --- Server ---
  if is_running "$PID_SERVER"; then
    echo -e "  ${YELLOW}■${NC} Server already running (pid $(cat "$PID_SERVER"))"
  else
    (cd "$DIR/server" && source venv/bin/activate && python run.py) \
      > "$LOG_SERVER" 2>&1 &
    echo $! > "$PID_SERVER"
    echo -e "  ${GREEN}■${NC} Server starting on port $SERVER_PORT..."
  fi

  # --- Client ---
  if is_running "$PID_CLIENT"; then
    echo -e "  ${YELLOW}■${NC} Client already running (pid $(cat "$PID_CLIENT"))"
  else
    (cd "$DIR/client" && npm run dev) \
      > "$LOG_CLIENT" 2>&1 &
    echo $! > "$PID_CLIENT"
    echo -e "  ${GREEN}■${NC} Client starting on port $CLIENT_PORT..."
  fi

  # --- Wait for server before starting dependent services ---
  echo -n "  Waiting for server..."
  if wait_for_port $SERVER_PORT 15; then
    echo -e " ${GREEN}ready${NC}"
  else
    echo -e " ${RED}timeout (check $LOG_SERVER)${NC}"
  fi

  # --- Agent Watcher ---
  if is_running "$PID_WATCHER"; then
    echo -e "  ${YELLOW}■${NC} Watcher already running (pid $(cat "$PID_WATCHER"))"
  else
    (cd "$DIR/server" && source venv/bin/activate && python ../tools/agent_watcher.py --interval 30) \
      > "$LOG_WATCHER" 2>&1 &
    echo $! > "$PID_WATCHER"
    echo -e "  ${GREEN}■${NC} Agent watcher started (every 30s)"
  fi

  # --- Flush Daemon ---
  if is_running "$PID_FLUSH"; then
    echo -e "  ${YELLOW}■${NC} Flush daemon already running (pid $(cat "$PID_FLUSH"))"
  else
    python3 "$DIR/hooks/flush_daemon.py" \
      > "$LOG_FLUSH" 2>&1 &
    echo $! > "$PID_FLUSH"
    echo -e "  ${GREEN}■${NC} Flush daemon started (every 5s)"
  fi

  # --- Install hooks ---
  echo -n "  Installing Claude Code hooks..."
  if python3 "$DIR/hooks/setup_hooks.py" > /dev/null 2>&1; then
    echo -e " ${GREEN}done${NC}"
  else
    echo -e " ${YELLOW}skipped (non-critical)${NC}"
  fi

  echo ""
  echo -e "${GREEN}Agent Board is running:${NC}"
  echo -e "  Frontend:  ${CYAN}http://localhost:$CLIENT_PORT${NC}"
  echo -e "  Backend:   ${CYAN}http://localhost:$SERVER_PORT${NC}"
  echo -e "  Watcher:   every 30s (auto-registers agents)"
  echo -e "  Flush:     every 5s  (tracks tool usage)"
  echo -e "  Logs:      $LOGDIR/"
  echo ""
}

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------

do_stop() {
  echo -e "${CYAN}Stopping Agent Board...${NC}"
  echo ""

  kill_by_pidfile "$PID_FLUSH"   "Flush daemon"
  kill_by_pidfile "$PID_WATCHER" "Agent watcher"
  kill_by_pidfile "$PID_CLIENT"  "Client"
  kill_by_pidfile "$PID_SERVER"  "Server"

  # Clean up any stragglers on ports
  kill_by_port $SERVER_PORT
  kill_by_port $CLIENT_PORT

  # Clean up temp files
  rm -f /tmp/agent-board-tool-buffer.jsonl
  rm -f /tmp/agent-board-flush-daemon.pid

  echo ""
  echo -e "${GREEN}Agent Board stopped.${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

do_status() {
  echo -e "${CYAN}Agent Board Status${NC}"
  echo ""

  local all_stopped=true

  for name_pid in "Server:$PID_SERVER:$SERVER_PORT" "Client:$PID_CLIENT:$CLIENT_PORT" "Watcher:$PID_WATCHER:" "Flush daemon:$PID_FLUSH:"; do
    IFS=':' read -r name pidfile port <<< "$name_pid"
    if is_running "$pidfile"; then
      local pid
      pid=$(cat "$pidfile")
      local port_info=""
      [[ -n "$port" ]] && port_info=" (port $port)"
      echo -e "  ${GREEN}●${NC} $name — running (pid $pid)$port_info"
      all_stopped=false
    else
      echo -e "  ${RED}●${NC} $name — stopped"
    fi
  done

  echo ""
  if [[ "$all_stopped" == true ]]; then
    echo -e "  ${RED}All components are stopped.${NC} Run: ./agent-board.sh start"
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

do_logs() {
  echo -e "${CYAN}Tailing Agent Board logs (Ctrl+C to stop)${NC}"
  echo ""
  tail -f "$LOG_SERVER" "$LOG_CLIENT" "$LOG_WATCHER" "$LOG_FLUSH" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-}" in
  start)
    do_start
    ;;
  stop)
    do_stop
    ;;
  restart)
    do_stop
    sleep 1
    do_start
    ;;
  status)
    do_status
    ;;
  logs)
    do_logs
    ;;
  *)
    echo "Usage: ./agent-board.sh {start|stop|restart|status|logs}"
    echo ""
    echo "  start    Start server, client, watcher, flush daemon & hooks"
    echo "  stop     Stop all components"
    echo "  restart  Stop then start everything"
    echo "  status   Show what's running"
    echo "  logs     Tail all log files"
    exit 1
    ;;
esac
