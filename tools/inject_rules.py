#!/usr/bin/env python3
"""
inject_rules.py — Inject Agent Board tracking rules into all project CLAUDE.md files.

Adds the tracking section to every project's CLAUDE.md so agents know how to report work.
Safe to run multiple times — only adds if not already present.

Usage:
    python tools/inject_rules.py                     # All projects in ~/Desktop/projects/
    python tools/inject_rules.py /path/to/project    # Single project
    python tools/inject_rules.py --dry-run            # Preview without writing
    python tools/inject_rules.py --remove             # Remove injected rules
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

MARKER_START = "<!-- AGENT-BOARD-TRACKING-START -->"
MARKER_END = "<!-- AGENT-BOARD-TRACKING-END -->"

RULES_FILE = Path(__file__).parent / "agent_board_rules.md"
PROJECTS_DIR = Path.home() / "Desktop" / "projects"


def get_rules() -> str:
    """Load the rules template."""
    if RULES_FILE.exists():
        return RULES_FILE.read_text()
    return "## Agent Board — Work Tracking\n\nSee http://localhost:5174 for the dashboard.\n"


def inject_rules(project_dir: Path, dry_run: bool = False) -> str:
    """Inject rules into a project's CLAUDE.md. Returns status message."""
    claude_md = project_dir / "CLAUDE.md"
    rules_block = f"\n\n{MARKER_START}\n{get_rules()}\n{MARKER_END}\n"

    if claude_md.exists():
        content = claude_md.read_text()

        # Already has rules?
        if MARKER_START in content:
            return f"  [skip] {project_dir.name} — rules already present"

        # Append rules
        new_content = content.rstrip() + rules_block
        if not dry_run:
            claude_md.write_text(new_content)
        return f"  [added] {project_dir.name} — appended to existing CLAUDE.md"
    else:
        # Create new CLAUDE.md with project name + rules
        header = f"# {project_dir.name.replace('-', ' ').title()}\n"
        new_content = header + rules_block
        if not dry_run:
            claude_md.write_text(new_content)
        return f"  [created] {project_dir.name} — new CLAUDE.md with rules"


def remove_rules(project_dir: Path, dry_run: bool = False) -> str:
    """Remove injected rules from a project's CLAUDE.md."""
    claude_md = project_dir / "CLAUDE.md"
    if not claude_md.exists():
        return f"  [skip] {project_dir.name} — no CLAUDE.md"

    content = claude_md.read_text()
    if MARKER_START not in content:
        return f"  [skip] {project_dir.name} — no rules to remove"

    # Remove the block between markers (including the markers and surrounding newlines)
    import re
    new_content = re.sub(
        rf"\n*{re.escape(MARKER_START)}.*?{re.escape(MARKER_END)}\n*",
        "\n",
        content,
        flags=re.DOTALL,
    )
    if not dry_run:
        claude_md.write_text(new_content.rstrip() + "\n")
    return f"  [removed] {project_dir.name} — rules removed"


def main():
    parser = argparse.ArgumentParser(description="Inject Agent Board rules into project CLAUDE.md files")
    parser.add_argument("project", nargs="?", default=None, help="Path to a specific project (default: all in ~/Desktop/projects/)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--remove", action="store_true", help="Remove injected rules instead of adding")
    args = parser.parse_args()

    if args.dry_run:
        print("DRY RUN — no files will be modified\n")

    if args.project:
        projects = [Path(args.project).resolve()]
    else:
        projects = sorted(p for p in PROJECTS_DIR.iterdir() if p.is_dir() and not p.name.startswith("."))

    action = remove_rules if args.remove else inject_rules
    action_name = "Removing" if args.remove else "Injecting"

    print(f"{action_name} Agent Board rules in {len(projects)} projects:\n")

    added = 0
    skipped = 0
    for p in projects:
        result = action(p, dry_run=args.dry_run)
        print(result)
        if "[added]" in result or "[created]" in result or "[removed]" in result:
            added += 1
        else:
            skipped += 1

    print(f"\nDone: {added} modified, {skipped} skipped")


if __name__ == "__main__":
    main()
