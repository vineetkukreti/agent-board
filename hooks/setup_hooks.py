#!/usr/bin/env python3
"""
setup_hooks.py — Wire track_agent.sh into Claude Code's settings.json.

Reads ~/.claude/settings.json, merges the Agent-tracking hooks (PreToolUse,
PostToolUse, SubagentStop), and writes it back.  Existing hooks are preserved.

Usage:
    python3 /home/vineet/Desktop/projects/agent-board/hooks/setup_hooks.py

    # Preview changes without writing:
    python3 setup_hooks.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SETTINGS_PATH = Path.home() / ".claude" / "settings.json"
HOOK_SCRIPT   = "/home/vineet/Desktop/projects/agent-board/hooks/track_agent.sh"

# ---------------------------------------------------------------------------
# Hook definitions to inject
# ---------------------------------------------------------------------------

# The command run for every Agent tool event.  The hook script reads the event
# type from the JSON payload and dispatches internally, so one command covers
# all three event types.
HOOK_COMMAND = f"bash {HOOK_SCRIPT}"

NEW_HOOKS: dict[str, list[dict]] = {
    "PreToolUse": [
        {
            "matcher": "Agent",
            "hooks": [
                {
                    "type":    "command",
                    "command": HOOK_COMMAND,
                    # block_on_error=false → never block Claude if the script fails
                    "block_on_error": False,
                }
            ],
        }
    ],
    "PostToolUse": [
        {
            "matcher": "Agent",
            "hooks": [
                {
                    "type":    "command",
                    "command": HOOK_COMMAND,
                    "block_on_error": False,
                }
            ],
        }
    ],
    "SubagentStop": [
        {
            "hooks": [
                {
                    "type":    "command",
                    "command": HOOK_COMMAND,
                    "block_on_error": False,
                }
            ],
        }
    ],
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def load_settings(path: Path) -> dict:
    if not path.exists():
        print(f"settings.json not found at {path} — will create it.")
        return {}
    with path.open() as f:
        return json.load(f)


def backup_settings(path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = path.with_suffix(f".{timestamp}.bak")
    shutil.copy2(path, backup)
    return backup


def hooks_already_present(existing_hooks: list[dict], command: str) -> bool:
    """Return True if a hook with this exact command already exists in the list."""
    for entry in existing_hooks:
        for h in entry.get("hooks", []):
            if h.get("command") == command:
                return True
    return False


def merge_hooks(settings: dict) -> tuple[dict, list[str]]:
    """
    Merge NEW_HOOKS into settings["hooks"].
    Returns (updated_settings, list_of_changes_made).
    """
    settings.setdefault("hooks", {})
    added: list[str] = []

    for event_type, new_entries in NEW_HOOKS.items():
        existing = settings["hooks"].setdefault(event_type, [])

        if hooks_already_present(existing, HOOK_COMMAND):
            print(f"  {event_type}: already configured — skipping.")
            continue

        existing.extend(new_entries)
        added.append(event_type)
        print(f"  {event_type}: added Agent tracking hook.")

    return settings, added


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Configure Claude Code hooks for Agent Board tracking."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing settings.json.",
    )
    parser.add_argument(
        "--settings",
        default=str(SETTINGS_PATH),
        help=f"Path to settings.json (default: {SETTINGS_PATH})",
    )
    args = parser.parse_args()

    settings_path = Path(args.settings)

    # Validate hook script exists.
    if not os.path.exists(HOOK_SCRIPT):
        print(f"ERROR: hook script not found at {HOOK_SCRIPT}")
        print("Run this script from the agent-board repo root after creating the hooks.")
        sys.exit(1)

    print(f"Reading settings from: {settings_path}")
    settings = load_settings(settings_path)

    print("\nMerging Agent tracking hooks:")
    updated_settings, added = merge_hooks(settings)

    if not added:
        print("\nNothing to do — all hooks already present.")
        return

    if args.dry_run:
        print("\n[dry-run] Updated settings would be:")
        print(json.dumps(updated_settings, indent=2))
        print("\n[dry-run] No files were written.")
        return

    # Back up the existing file before overwriting.
    if settings_path.exists():
        backup_path = backup_settings(settings_path)
        print(f"\nBacked up original settings to: {backup_path}")

    # Ensure parent directory exists.
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    with settings_path.open("w") as f:
        json.dump(updated_settings, f, indent=2)
        f.write("\n")

    print(f"\nWrote updated settings to: {settings_path}")
    print(f"\nAdded hooks for events: {', '.join(added)}")
    print("\nAgent Board tracking is now active.")
    print("Logs will appear in: /tmp/agent-board-hooks.log")
    print("Ticket store (PreToolUse -> PostToolUse pairing): /tmp/agent-board-ticket-store.json")
    print("\nNext steps:")
    print("  1. Make sure Agent Board server is running: cd backend && uvicorn app.main:app --port 8001")
    print("  2. Spawn any agent via the Agent tool or a slash command — a ticket will be auto-created.")
    print("  3. Tail the log to verify: tail -f /tmp/agent-board-hooks.log")


if __name__ == "__main__":
    main()
