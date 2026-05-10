#!/usr/bin/env python3
"""
flush_daemon.py — Background daemon that reads tool usage buffer and POSTs to Agent Board.

Reads /tmp/agent-board-tool-buffer.jsonl every 5 seconds, batches events,
and sends them to POST /api/v1/tracking/tool-usage.

Usage:
    python hooks/flush_daemon.py                # foreground
    python hooks/flush_daemon.py --daemon       # background
    python hooks/flush_daemon.py --stop         # stop background daemon
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BUFFER_FILE = Path("/tmp/agent-board-tool-buffer.jsonl")
PID_FILE = Path("/tmp/agent-board-flush-daemon.pid")
LOG_FILE = Path("/tmp/agent-board-flush-daemon.log")
API_BASE = "http://localhost:8001/api/v1"
# Permanent API key — survives server restarts
HOOK_API_KEY = "MM43kZ6ho5cjbSNprP9vjkj8vxgbCpFciWi-og7w0X4"
INTERVAL = 5  # seconds


def log(msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def get_token() -> str | None:
    """Login as admin and return token."""
    try:
        data = json.dumps({"username": "admin", "password": "admin"}).encode()
        req = urllib.request.Request(
            f"{API_BASE}/auth/login",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode()).get("token")
    except Exception as e:
        log(f"Login failed: {e}")
        return None


def post_events(api_key: str, events: list[dict]) -> bool:
    """POST batched tool usage events."""
    try:
        payload = {"events": events}
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"{API_BASE}/tracking/tool-usage",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            return result.get("logged", 0) > 0
    except Exception as e:
        log(f"POST failed: {e}")
        return False


def read_buffer() -> tuple[str, list[dict]]:
    """Read all lines from buffer. Returns (raw_content, parsed_events)."""
    if not BUFFER_FILE.exists():
        return "", []

    try:
        content = BUFFER_FILE.read_text()
        if not content.strip():
            return "", []

        events = []
        for line in content.strip().splitlines():
            try:
                raw = json.loads(line)
                # Convert buffer format to API format
                event = {
                    "session_id": raw.get("session_id", ""),
                    "tool_name": raw.get("tool", ""),
                    "file_path": raw.get("file_path") or None,
                    "command": raw.get("command") or None,
                    "lines_added": raw.get("lines_added", 0),
                    "lines_removed": raw.get("lines_removed", 0),
                    "is_error": raw.get("is_error", False),
                    "error_message": raw.get("error_msg") or None,
                }
                events.append(event)
            except json.JSONDecodeError:
                continue

        return content, events
    except Exception as e:
        log(f"Buffer read error: {e}")
        return "", []


def clear_buffer(old_content: str) -> None:
    """Clear only the content we already read — preserve any new lines appended since."""
    try:
        current = BUFFER_FILE.read_text()
        if current == old_content:
            BUFFER_FILE.write_text("")
        else:
            # New events were appended while we were posting — keep them
            remaining = current[len(old_content):]
            BUFFER_FILE.write_text(remaining)
    except Exception:
        pass


STALENESS_INTERVAL = 60  # Check staleness every 60 seconds
DB_PATH = Path(__file__).parent.parent / "backend" / "data" / "agent-board.db"


def mark_stale_agents() -> None:
    """Mark agents as offline if not seen in 5 minutes. Close orphaned sessions older than 1 hour."""
    import sqlite3
    if not DB_PATH.exists():
        return
    try:
        db = sqlite3.connect(str(DB_PATH), timeout=3)
        c = db.execute(
            "UPDATE agents SET status = 'offline' "
            "WHERE status = 'active' AND last_seen_at IS NOT NULL "
            "AND last_seen_at < datetime('now', '-5 minutes')"
        )
        if c.rowcount > 0:
            log(f"Marked {c.rowcount} stale agents as offline")
        c2 = db.execute(
            "UPDATE agent_sessions SET status = 'completed', ended_at = datetime('now'), "
            "summary = 'Auto-closed: orphaned session' "
            "WHERE status = 'active' AND started_at < datetime('now', '-1 hour')"
        )
        if c2.rowcount > 0:
            log(f"Closed {c2.rowcount} orphaned sessions")
        db.commit()
        db.close()
    except Exception as e:
        log(f"Staleness check error: {e}")


def run_loop():
    """Main flush loop."""
    log(f"Flush daemon started (interval={INTERVAL}s, using permanent API key)")
    staleness_counter = 0

    while True:
        try:
            raw_content, events = read_buffer()
            if events:
                if post_events(HOOK_API_KEY, events):
                    clear_buffer(raw_content)
                    log(f"Flushed {len(events)} tool events")
                else:
                    log(f"Failed to flush {len(events)} events — will retry")

            # Periodically mark stale agents as offline
            staleness_counter += INTERVAL
            if staleness_counter >= STALENESS_INTERVAL:
                staleness_counter = 0
                mark_stale_agents()

        except KeyboardInterrupt:
            log("Stopped.")
            break
        except Exception as e:
            log(f"Error: {e}")

        time.sleep(INTERVAL)


def stop_daemon():
    if not PID_FILE.exists():
        print("No daemon running.")
        return
    pid = int(PID_FILE.read_text().strip())
    try:
        os.kill(pid, signal.SIGTERM)
        print(f"Stopped flush daemon (PID {pid})")
    except ProcessLookupError:
        print(f"PID {pid} not found.")
    PID_FILE.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--daemon", action="store_true")
    parser.add_argument("--stop", action="store_true")
    parser.add_argument("--interval", type=int, default=5)
    args = parser.parse_args()

    global INTERVAL
    INTERVAL = args.interval

    if args.stop:
        stop_daemon()
        return

    if args.daemon:
        pid = os.fork()
        if pid > 0:
            PID_FILE.write_text(str(pid))
            print(f"Flush daemon started (PID {pid})")
            print(f"  Log: {LOG_FILE}")
            sys.exit(0)
        else:
            sys.stdout = open(LOG_FILE, "a", buffering=1)
            sys.stderr = sys.stdout
            os.setsid()

    run_loop()


if __name__ == "__main__":
    main()
