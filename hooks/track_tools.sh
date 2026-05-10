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
task_title = ''
if tool == 'Agent':
    agent_name = tinput.get('subagent_type', '') or tinput.get('agent_name', '')
    short_desc = tinput.get('description', '') or ''
    prompt = tinput.get('prompt', '') or ''
    # Use 'description' (3-5 word summary) as title, full prompt as description
    task_title = short_desc[:120] if short_desc else ''
    task_desc = prompt[:500] if prompt else short_desc[:500]
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
    'task_title': task_title,
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
    'task_title': parsed.get('task_title', '')[:120],
    'task_description': parsed.get('task_desc', '')[:500],
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

if [[ "$TOOL" == "Agent" && ( "$HOOK" == "PostToolUse" || "$HOOK" == "SubagentStop" ) ]]; then
    if [[ -n "$SID" ]]; then
        # Extract meaningful summary from the agent's result
        python3 -c "
import json, urllib.request, urllib.error, sys, os

parsed = json.loads(sys.argv[1])
hook = parsed.get('hook', '')

# Extract summary from tool_response or last_assistant_message
status = 'completed'
summary = ''

def truncate(text, max_chars=500, max_lines=15):
    if not text:
        return ''
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    out = '\n'.join(lines[:max_lines])
    if len(out) > max_chars:
        out = out[:max_chars] + '...'
    return out

try:
    raw_input = sys.argv[6]
    data = json.loads(raw_input)

    if hook == 'SubagentStop':
        # SubagentStop has last_assistant_message with actual output
        msg = data.get('last_assistant_message', '')
        if msg:
            summary = truncate(msg)
    else:
        # PostToolUse — tool_response has the agent's result
        result = data.get('tool_response', '')

        if isinstance(result, str) and result:
            summary = truncate(result)
        elif isinstance(result, dict):
            # Try to find actual text content, not the raw dict
            for key in ('summary', 'message', 'result', 'output', 'content'):
                if result.get(key) and isinstance(result[key], str):
                    summary = truncate(result[key])
                    break
            if not summary:
                # Last resort: look for the longest string value (likely the actual output)
                texts = [(k, v) for k, v in result.items()
                         if isinstance(v, str) and len(v) > 20 and k != 'prompt']
                if texts:
                    texts.sort(key=lambda x: len(x[1]), reverse=True)
                    summary = truncate(texts[0][1])
except Exception:
    pass

# Extract tokens from transcript JSONL
tokens = {'input': 0, 'output': 0, 'cache_read': 0, 'cache_write': 0}
try:
    raw_input = sys.argv[6]
    data = json.loads(raw_input)
    # For subagents use agent_transcript_path; for main session use transcript_path
    transcript = data.get('agent_transcript_path', '') or data.get('transcript_path', '')
    if transcript and os.path.exists(transcript):
        with open(transcript) as f:
            for line in f:
                try:
                    msg = json.loads(line)
                    usage = msg.get('usage', {})
                    if usage:
                        tokens['input'] = max(tokens['input'], usage.get('input_tokens', 0))
                        tokens['output'] += usage.get('output_tokens', 0)
                        tokens['cache_read'] = max(tokens['cache_read'], usage.get('cache_read_input_tokens', 0))
                        tokens['cache_write'] = max(tokens['cache_write'], usage.get('cache_creation_input_tokens', 0))
                except:
                    pass
except Exception:
    pass

if not summary:
    summary = 'Task completed'

# Check for errors
if parsed.get('is_error'):
    status = 'error'
    summary = parsed.get('error_msg', '') or summary

payload = json.dumps({
    'status': status,
    'summary': summary,
    'input_tokens': tokens['input'],
    'output_tokens': tokens['output'],
    'cache_read_tokens': tokens['cache_read'],
    'cache_write_tokens': tokens['cache_write'],
}).encode()
req = urllib.request.Request(
    sys.argv[2] + '/tracking/sessions/' + sys.argv[3] + '/end',
    data=payload,
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sys.argv[4]},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=6) as resp:
        pass
except: pass
" "$RESULT" "$API" "$SID" "$HOOK_API_KEY" "" "$INPUT" 2>/dev/null || true
        log "SESSION-END: session=$SID hook=$HOOK"
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
