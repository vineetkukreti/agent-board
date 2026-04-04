#!/usr/bin/env bash
set -e

trap 'kill 0' EXIT

# Kill any processes already using our ports
for port in 8001 5174; do
  pid=$(lsof -ti :"$port" 2>/dev/null) && kill -9 $pid 2>/dev/null && echo "Killed process on port $port"
done

sleep 1

# Server
(cd server && source venv/bin/activate && python run.py) &

# Client
(cd client && npm run dev) &

# Wait for server to be ready
sleep 3

# Agent watcher (auto-detect & register agents every 30s)
(cd server && source venv/bin/activate && python ../tools/agent_watcher.py --interval 30) &

# Flush daemon (buffer tool usage events to API every 5s)
python3 hooks/flush_daemon.py &

echo ""
echo "  Agent Board running:"
echo "    Frontend:  http://localhost:5174"
echo "    Backend:   http://localhost:8001"
echo "    Watcher:   every 30s (auto-registers agents)"
echo "    Flush:     every 5s  (tracks tool usage)"
echo ""

wait
