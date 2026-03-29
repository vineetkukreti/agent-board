#!/usr/bin/env bash
# track_agent.sh — Claude Code hook for automatic Agent Board ticket tracking.
#
# Receives a JSON event on stdin from Claude Code hooks.
# Handles PreToolUse (create ticket) and PostToolUse (close ticket) for
# the "Agent" tool.
#
# Usage (wired automatically by setup_hooks.py):
#   PreToolUse  matcher=Agent → bash track_agent.sh
#   PostToolUse matcher=Agent → bash track_agent.sh
#
# Requirements: python3, curl
# Logs: /tmp/agent-board-hooks.log
# Never exits non-zero — must not block the main Claude Code workflow.

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

LOG_FILE="/tmp/agent-board-hooks.log"
API_BASE="http://localhost:8001/api/v1"
KEYS_FILE="/home/vineet/Desktop/projects/agent-board/tools/agent_keys.json"
# Ticket IDs are written to a temp file so PreToolUse can pass the ID to
# PostToolUse within the same session (keyed by agent+task hash).
TICKET_STORE="/tmp/agent-board-ticket-store.json"
# Default project_id — "DSA Tracker" project on Agent Board.
DEFAULT_PROJECT_ID=1
# Default priority for auto-created tickets.
DEFAULT_PRIORITY="p2"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------

log() {
    echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Read stdin (the hook JSON payload)
# ---------------------------------------------------------------------------

INPUT=$(cat)

if [[ -z "$INPUT" ]]; then
    log "WARN: empty stdin — nothing to do"
    exit 0
fi

log "RAW INPUT: $INPUT"

# Write input to a temp file so the python parser doesn't compete for stdin.
INPUT_TMP=$(mktemp /tmp/agent-board-hook-XXXXXX.json)
printf '%s' "$INPUT" > "$INPUT_TMP"
trap 'rm -f "$INPUT_TMP"; log "ERROR: unexpected failure at line $LINENO — exiting silently"; exit 0' ERR
trap 'rm -f "$INPUT_TMP"' EXIT

# ---------------------------------------------------------------------------
# Parse the event with python3 (more reliable than jq for nested JSON)
# ---------------------------------------------------------------------------

PARSED=$(python3 - "$INPUT_TMP" <<'PYEOF' 2>/dev/null || echo "PARSE_ERROR"
import sys, json, os, re

input_file = sys.argv[1] if len(sys.argv) > 1 else None
if not input_file:
    print("PARSE_ERROR: no input file")
    sys.exit(0)

with open(input_file) as f:
    raw = f.read()

try:
    data = json.loads(raw)
except Exception as e:
    print(f"PARSE_ERROR: {e}")
    sys.exit(0)

hook_type   = data.get("hook_event_name", "")   # PreToolUse | PostToolUse | SubagentStop
tool_name   = data.get("tool_name", "")
tool_input  = data.get("tool_input", {})
tool_result = data.get("tool_response", {})      # present on PostToolUse
cwd         = data.get("cwd", "")

# Only act on Agent tool calls.
if tool_name != "Agent":
    print("SKIP")
    sys.exit(0)

# --- extract agent name ---
# Claude Code Agent tool can carry a description or subagent_type field.
agent_name = (
    tool_input.get("subagent_type")
    or tool_input.get("agent_name")
    or ""
)
# Try to pull a recognisable agent name from the prompt as fallback.
prompt = tool_input.get("prompt", "") or tool_input.get("description", "")
if not agent_name:
    # Look for "you are <name>" or "agent: <name>" patterns.
    m = re.search(r"(?:you are|acting as|agent[:\s]+)\s*[`\"]?(\w+)[`\"]?",
                  prompt, re.IGNORECASE)
    agent_name = m.group(1) if m else "subagent"

# --- extract task title (first non-empty line of the prompt, max 80 chars) ---
lines = [l.strip() for l in prompt.splitlines() if l.strip()]
task_title = lines[0][:80] if lines else "Agent task"

# Prefix with agent name for readability in the board.
title = f"[{agent_name}] {task_title}"

# --- extract project name from cwd ---
# cwd is something like /home/vineet/Desktop/projects/dsa-tracker/...
# We want "dsa-tracker".
project_name = ""
if cwd:
    parts = cwd.rstrip("/").split("/")
    # Look for "projects" segment and take the next one.
    for i, p in enumerate(parts):
        if p == "projects" and i + 1 < len(parts):
            project_name = parts[i + 1]
            break
    if not project_name:
        project_name = parts[-1] if parts else "unknown"

# A stable key we can use to match PreToolUse → PostToolUse pairs.
# Hash of tool_use_id if present, else agent_name + first 40 chars of prompt.
tool_use_id = data.get("tool_use_id", "")
store_key = tool_use_id if tool_use_id else f"{agent_name}:{prompt[:40]}"

out = {
    "hook_type":    hook_type,
    "agent_name":   agent_name,
    "title":        title,
    "prompt":       prompt[:500],   # cap description length
    "project_name": project_name,
    "store_key":    store_key,
    "tool_result":  str(tool_result)[:300] if tool_result else "",
}
print(json.dumps(out))
PYEOF
)

if [[ "$PARSED" == "SKIP" || "$PARSED" == "PARSE_ERROR"* || -z "$PARSED" ]]; then
    log "SKIP: not an Agent tool call or parse error — $PARSED"
    exit 0
fi

log "PARSED: $PARSED"

# ---------------------------------------------------------------------------
# Extract fields from the parsed JSON
# ---------------------------------------------------------------------------

get_field() {
    python3 -c "import sys,json; print(json.loads(sys.argv[1]).get(sys.argv[2],''))" "$PARSED" "$1" 2>/dev/null || true
}

HOOK_TYPE=$(get_field "hook_type")
AGENT_NAME=$(get_field "agent_name")
TITLE=$(get_field "title")
PROMPT=$(get_field "prompt")
PROJECT_NAME=$(get_field "project_name")
STORE_KEY=$(get_field "store_key")
TOOL_RESULT=$(get_field "tool_result")

# ---------------------------------------------------------------------------
# Resolve API key — use arjun (orchestrator) as the caller identity
# ---------------------------------------------------------------------------

AGENT_API_KEY=""
if [[ -f "$KEYS_FILE" ]]; then
    AGENT_API_KEY=$(python3 -c "
import sys, json
with open('$KEYS_FILE') as f:
    keys = json.load(f)
print(keys.get('arjun', ''))
" 2>/dev/null || true)
fi

if [[ -z "$AGENT_API_KEY" ]]; then
    log "WARN: could not read arjun API key from $KEYS_FILE — skipping API calls"
    exit 0
fi

# ---------------------------------------------------------------------------
# Ticket store helpers (maps store_key → ticket_id)
# ---------------------------------------------------------------------------

store_ticket_id() {
    local key="$1"
    local ticket_id="$2"
    python3 - <<PYEOF2 2>/dev/null || true
import json, os
store_file = "$TICKET_STORE"
store = {}
if os.path.exists(store_file):
    try:
        with open(store_file) as f:
            store = json.load(f)
    except Exception:
        store = {}
store["$key"] = "$ticket_id"
with open(store_file, "w") as f:
    json.dump(store, f)
PYEOF2
}

get_ticket_id() {
    local key="$1"
    python3 - <<PYEOF3 2>/dev/null || true
import json, os
store_file = "$TICKET_STORE"
if not os.path.exists(store_file):
    print("")
else:
    try:
        with open(store_file) as f:
            store = json.load(f)
        print(store.get("$key", ""))
    except Exception:
        print("")
PYEOF3
}

remove_ticket_id() {
    local key="$1"
    python3 - <<PYEOF4 2>/dev/null || true
import json, os
store_file = "$TICKET_STORE"
if not os.path.exists(store_file):
    pass
else:
    try:
        with open(store_file) as f:
            store = json.load(f)
        store.pop("$key", None)
        with open(store_file, "w") as f:
            json.dump(store, f)
    except Exception:
        pass
PYEOF4
}

# ---------------------------------------------------------------------------
# Resolve project_id from Agent Board (search by name, fall back to default)
# ---------------------------------------------------------------------------

resolve_project_id() {
    local name="$1"
    if [[ -z "$name" ]]; then
        echo "$DEFAULT_PROJECT_ID"
        return
    fi
    local result
    result=$(curl -s \
        -H "Authorization: Bearer $AGENT_API_KEY" \
        "$API_BASE/projects/" 2>/dev/null || echo "")
    if [[ -z "$result" ]]; then
        echo "$DEFAULT_PROJECT_ID"
        return
    fi
    python3 - <<PYEOF5 2>/dev/null || echo "$DEFAULT_PROJECT_ID"
import sys, json
raw = '''$result'''
name = '''$name'''.lower()
try:
    projects = json.loads(raw)
    items = projects if isinstance(projects, list) else projects.get("items", [])
    for p in items:
        if p.get("name","").lower() == name or p.get("slug","").lower() == name:
            print(p["id"])
            sys.exit(0)
except Exception:
    pass
print($DEFAULT_PROJECT_ID)
PYEOF5
}

# ---------------------------------------------------------------------------
# PreToolUse — create a ticket for the agent's work
# ---------------------------------------------------------------------------

handle_pre_tool_use() {
    log "PreToolUse: creating ticket for agent=$AGENT_NAME title='$TITLE'"

    local project_id
    project_id=$(resolve_project_id "$PROJECT_NAME")
    log "Resolved project_id=$project_id for project_name=$PROJECT_NAME"

    # Build description — include the full prompt so reviewers know what was asked.
    local description
    description=$(python3 -c "
import json, sys
desc = 'Auto-created by Claude Code hook.\n\n**Agent**: $AGENT_NAME\n**Project**: $PROJECT_NAME\n\n**Prompt**:\n' + '''$PROMPT'''
print(json.dumps(desc))
" 2>/dev/null || echo '"Auto-created by Claude Code hook."')

    local payload
    payload=$(python3 -c "
import json
print(json.dumps({
    'title':       '$TITLE',
    'project_id':  $project_id,
    'priority':    '$DEFAULT_PRIORITY',
    'description': $description,
    'tags':        ['auto-tracked', 'agent:$AGENT_NAME'],
}))
" 2>/dev/null || true)

    if [[ -z "$payload" ]]; then
        log "ERROR: could not build ticket payload"
        return
    fi

    log "POST $API_BASE/tickets/ payload=$payload"

    local response
    response=$(curl -s -X POST "$API_BASE/tickets/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AGENT_API_KEY" \
        -d "$payload" 2>/dev/null || echo "")

    log "CREATE response: $response"

    # Extract ticket ID and persist it for the matching PostToolUse call.
    local ticket_id
    ticket_id=$(python3 -c "
import sys, json
try:
    d = json.loads('''$response''')
    print(d.get('id', ''))
except Exception:
    print('')
" 2>/dev/null || true)

    if [[ -n "$ticket_id" ]]; then
        store_ticket_id "$STORE_KEY" "$ticket_id"
        log "Stored ticket_id=$ticket_id for store_key=$STORE_KEY"

        # Immediately transition to in_progress so the board reflects live work.
        local start_response
        start_response=$(curl -s -X POST "$API_BASE/tickets/$ticket_id/start" \
            -H "Authorization: Bearer $AGENT_API_KEY" 2>/dev/null || echo "")
        log "START response: $start_response"
    else
        log "WARN: no ticket_id in response — ticket may not have been created"
    fi
}

# ---------------------------------------------------------------------------
# PostToolUse — mark ticket done with a result summary
# ---------------------------------------------------------------------------

handle_post_tool_use() {
    local ticket_id
    ticket_id=$(get_ticket_id "$STORE_KEY")

    if [[ -z "$ticket_id" ]]; then
        log "PostToolUse: no stored ticket_id for store_key=$STORE_KEY — nothing to close"
        return
    fi

    log "PostToolUse: closing ticket_id=$ticket_id for agent=$AGENT_NAME"

    # Post a comment with the result summary before marking done.
    if [[ -n "$TOOL_RESULT" ]]; then
        local comment_payload
        comment_payload=$(python3 -c "
import json
body = 'Agent completed.\n\n**Result summary**:\n' + '''$TOOL_RESULT'''
print(json.dumps({'body': body}))
" 2>/dev/null || true)

        if [[ -n "$comment_payload" ]]; then
            local comment_response
            comment_response=$(curl -s -X POST "$API_BASE/tickets/$ticket_id/comments" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $AGENT_API_KEY" \
                -d "$comment_payload" 2>/dev/null || echo "")
            log "COMMENT response: $comment_response"
        fi
    fi

    # Transition ticket → done.
    local done_response
    done_response=$(curl -s -X POST "$API_BASE/tickets/$ticket_id/done" \
        -H "Authorization: Bearer $AGENT_API_KEY" 2>/dev/null || echo "")
    log "DONE response: $done_response"

    remove_ticket_id "$STORE_KEY"
}

# ---------------------------------------------------------------------------
# SubagentStop — log a note; ticket may already be closed via PostToolUse
# ---------------------------------------------------------------------------

handle_subagent_stop() {
    local ticket_id
    ticket_id=$(get_ticket_id "$STORE_KEY")
    log "SubagentStop: agent=$AGENT_NAME store_key=$STORE_KEY ticket_id=${ticket_id:-none}"

    if [[ -n "$ticket_id" ]]; then
        # Agent stopped without a normal PostToolUse — mark done anyway.
        log "SubagentStop: closing orphaned ticket_id=$ticket_id"
        local stop_comment
        stop_comment=$(python3 -c "
import json
print(json.dumps({'body': 'Agent stopped (SubagentStop event). Marked done automatically.'}))
" 2>/dev/null || true)
        if [[ -n "$stop_comment" ]]; then
            curl -s -X POST "$API_BASE/tickets/$ticket_id/comments" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $AGENT_API_KEY" \
                -d "$stop_comment" >/dev/null 2>&1 || true
        fi
        curl -s -X POST "$API_BASE/tickets/$ticket_id/done" \
            -H "Authorization: Bearer $AGENT_API_KEY" >/dev/null 2>&1 || true
        remove_ticket_id "$STORE_KEY"
    fi
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

case "$HOOK_TYPE" in
    PreToolUse)
        handle_pre_tool_use
        ;;
    PostToolUse)
        handle_post_tool_use
        ;;
    SubagentStop)
        handle_subagent_stop
        ;;
    *)
        log "SKIP: unrecognised hook_type=$HOOK_TYPE"
        ;;
esac

log "Done."
exit 0
