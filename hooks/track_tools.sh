#!/usr/bin/env bash
# track_tools.sh — Claude Code hook for comprehensive agent tracking.
#
# Fires on ALL tool calls across ALL projects. Two modes:
#   1. Agent tool (subagent start/stop) — synchronous API call to auto-register
#   2. All other tools (Read/Edit/Write/Bash) — fast buffer append (<20ms)
#
# A separate flush daemon reads the buffer and POSTs batched events.
#
# Never exits non-zero — must not block Claude Code.

set -uo pipefail

LOG="/tmp/agent-board-hooks.log"
BUFFER="/tmp/agent-board-tool-buffer.jsonl"
API="http://localhost:8001/api/v1"
KEYS_FILE="/home/vineet/Desktop/projects/agent-board/tools/agent_keys.json"
SESSION_STORE="/tmp/agent-board-session-store.json"
# Permanent API key — survives server restarts (no session tokens!)
HOOK_API_KEY="MM43kZ6ho5cjbSNprP9vjkj8vxgbCpFciWi-og7w0X4"

log() { echo "[$(date '+%H:%M:%S')] $*" >> "$LOG" 2>/dev/null || true; }

# Read stdin
INPUT=$(cat 2>/dev/null || true)
[[ -z "$INPUT" ]] && exit 0

# Parse with python3 — fast, single pass
RESULT=$(python3 -c "
import json, sys, os, time

raw = sys.stdin.read()
try:
    data = json.loads(raw)
except:
    print('{}')
    sys.exit(0)

hook    = data.get('hook_event_name', '')
tool    = data.get('tool_name', '')
tinput  = data.get('tool_input', {})
tresult = data.get('tool_response', {})
cwd     = data.get('cwd', '')
tuid    = data.get('tool_use_id', '')
sid     = os.environ.get('CLAUDE_CODE_SESSION_ID', tuid[:16] if tuid else str(int(time.time())))

# Extract agent info for Agent tool
agent_name = ''
task_desc = ''
if tool == 'Agent':
    agent_name = tinput.get('subagent_type', '') or tinput.get('agent_name', '')
    prompt = tinput.get('prompt', '') or tinput.get('description', '')
    task_desc = prompt[:256] if prompt else ''
    if not agent_name:
        agent_name = 'subagent'

# Extract file_path for file tools
file_path = ''
command = ''
if tool in ('Read', 'Edit', 'Write', 'Glob', 'Grep'):
    file_path = tinput.get('file_path', '') or tinput.get('path', '') or tinput.get('pattern', '')
elif tool == 'Bash':
    command = tinput.get('command', '')[:200] if tinput.get('command') else ''

# Check for errors in result
is_error = False
error_msg = ''
if isinstance(tresult, dict):
    if tresult.get('error') or tresult.get('is_error'):
        is_error = True
        error_msg = str(tresult.get('error', ''))[:200]
elif isinstance(tresult, str) and 'error' in tresult.lower()[:50]:
    is_error = True
    error_msg = tresult[:200]

# Lines changed for Edit/Write
lines_added = 0
lines_removed = 0
if tool == 'Edit':
    new = tinput.get('new_string', '')
    old = tinput.get('old_string', '')
    lines_added = len(new.splitlines()) if new else 0
    lines_removed = len(old.splitlines()) if old else 0

out = {
    'hook': hook,
    'tool': tool,
    'agent_name': agent_name,
    'task_desc': task_desc,
    'cwd': cwd,
    'session_id': sid,
    'tool_use_id': tuid,
    'file_path': file_path,
    'command': command,
    'is_error': is_error,
    'error_msg': error_msg,
    'lines_added': lines_added,
    'lines_removed': lines_removed,
    'ts': time.time(),
}
print(json.dumps(out))
" <<< "$INPUT" 2>/dev/null || echo "{}")

[[ -z "$RESULT" || "$RESULT" == "{}" ]] && exit 0

# Extract fields
HOOK=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('hook',''))" "$RESULT" 2>/dev/null)
TOOL=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('tool',''))" "$RESULT" 2>/dev/null)
AGENT=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('agent_name',''))" "$RESULT" 2>/dev/null)
SID=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('session_id',''))" "$RESULT" 2>/dev/null)

# Auth — use permanent API key (no session tokens, survives server restarts)
AUTH_HEADER="Authorization: Bearer $HOOK_API_KEY"

# ── Agent tool: synchronous auto-register ────────────────────────────────────

if [[ "$TOOL" == "Agent" && "$HOOK" == "PreToolUse" && -n "$AGENT" ]]; then
    # Use python to build JSON safely and call API with permanent key
    RESP=$(python3 -c "
import json, sys, urllib.request, urllib.error

parsed = json.loads(sys.argv[1])
payload = json.dumps({
    'agent_name': parsed.get('agent_name', ''),
    'task_description': parsed.get('task_desc', '')[:256],
    'cwd': parsed.get('cwd', ''),
    'session_id': sys.argv[2],
}).encode()

req = urllib.request.Request(
    sys.argv[3] + '/tracking/auto-register',
    data=payload,
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sys.argv[4]},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=6) as resp:
        print(resp.read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
except Exception as e:
    print(json.dumps({'error': str(e)}))
" "$RESULT" "$SID" "$API" "$HOOK_API_KEY" 2>/dev/null || true)

    log "AUTO-REGISTER: agent=$AGENT session=$SID resp=$RESP"

    # Store session mapping
    if [[ -n "$RESP" ]]; then
        python3 -c "
import json, os, sys
store = {}
sf = sys.argv[1]
if os.path.exists(sf):
    try:
        with open(sf) as f: store = json.load(f)
    except: pass
try:
    store[sys.argv[2]] = json.loads(sys.argv[3])
except:
    store[sys.argv[2]] = {}
with open(sf, 'w') as f: json.dump(store, f)
" "$SESSION_STORE" "$SID" "$RESP" 2>/dev/null || true
    fi
    exit 0
fi

if [[ "$TOOL" == "Agent" && "$HOOK" == "PostToolUse" ]]; then
    if [[ -n "$SID" ]]; then
        # End the session with permanent API key
        python3 -c "
import json, urllib.request, urllib.error, sys
payload = json.dumps({'status':'completed','summary':'Agent task completed'}).encode()
req = urllib.request.Request(
    sys.argv[1] + '/tracking/sessions/' + sys.argv[2] + '/end',
    data=payload,
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sys.argv[3]},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=6) as resp:
        pass
except: pass
" "$API" "$SID" "$HOOK_API_KEY" 2>/dev/null || true
        log "SESSION-END: session=$SID"
    fi
    exit 0
fi

# ── Auto-detect SPRINT_*.md file writes ──────────────────────────────────────

FILE_PATH=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('file_path',''))" "$RESULT" 2>/dev/null)

if [[ "$TOOL" == "Write" && "$HOOK" == "PostToolUse" && "$FILE_PATH" =~ SPRINT.*\.md$ ]]; then
    log "SPRINT-DETECTED: $FILE_PATH"
    # Run ingest in background so we don't block the agent
    INGEST="/home/vineet/Desktop/projects/agent-board/tools/ingest_sprint.py"
    CWD=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('cwd',''))" "$RESULT" 2>/dev/null)
    (
        python3 "$INGEST" "$FILE_PATH" --project "$CWD" --activate >> "$LOG" 2>&1
        log "SPRINT-INGESTED: $FILE_PATH"
    ) &
fi

# ── All other tools: fast buffer append ──────────────────────────────────────

echo "$RESULT" >> "$BUFFER" 2>/dev/null || true
exit 0
