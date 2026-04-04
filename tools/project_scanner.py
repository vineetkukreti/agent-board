#!/usr/bin/env python3
"""
project_scanner.py — Scan a project directory and extract rich metadata.

Detects project name, description, tech stack, git info, sprint files,
agent definitions from CLAUDE.md, and generates standups from git activity.

Usage:
    python tools/project_scanner.py /path/to/project
    python tools/project_scanner.py /path/to/project --json
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path


# ── Tech stack detection by file extension ─────────────────────────────────

EXTENSION_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".java": "Java",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".c": "C",
    ".cpp": "C++",
    ".h": "C/C++",
    ".cs": "C#",
    ".php": "PHP",
    ".lua": "Lua",
    ".zig": "Zig",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".erl": "Erlang",
    ".hs": "Haskell",
    ".ml": "OCaml",
    ".scala": "Scala",
    ".dart": "Dart",
    ".vue": "Vue",
    ".svelte": "Svelte",
}

# Framework detection from config files
FRAMEWORK_FILES = {
    "package.json": None,  # special: parsed for dependencies
    "next.config.js": "Next.js",
    "next.config.ts": "Next.js",
    "next.config.mjs": "Next.js",
    "nuxt.config.ts": "Nuxt",
    "nuxt.config.js": "Nuxt",
    "vite.config.js": "Vite",
    "vite.config.ts": "Vite",
    "angular.json": "Angular",
    "tailwind.config.js": "TailwindCSS",
    "tailwind.config.ts": "TailwindCSS",
    "postcss.config.js": "PostCSS",
    "webpack.config.js": "Webpack",
    "tsconfig.json": "TypeScript",
    "pyproject.toml": "Python",
    "setup.py": "Python",
    "requirements.txt": "Python",
    "Pipfile": "Python",
    "Cargo.toml": "Rust",
    "go.mod": "Go",
    "Gemfile": "Ruby",
    "pom.xml": "Java/Maven",
    "build.gradle": "Gradle",
    "Makefile": "Make",
    "Dockerfile": "Docker",
    "docker-compose.yml": "Docker Compose",
    "docker-compose.yaml": "Docker Compose",
    ".github/workflows": "GitHub Actions",
    "Procfile": "Heroku",
    "fly.toml": "Fly.io",
    "vercel.json": "Vercel",
}

# Known dependency-to-framework mapping (from package.json)
NPM_FRAMEWORKS = {
    "react": "React",
    "next": "Next.js",
    "vue": "Vue",
    "nuxt": "Nuxt",
    "svelte": "Svelte",
    "@angular/core": "Angular",
    "express": "Express",
    "fastify": "Fastify",
    "hono": "Hono",
    "tailwindcss": "TailwindCSS",
    "prisma": "Prisma",
    "drizzle-orm": "Drizzle",
    "zustand": "Zustand",
    "@tanstack/react-query": "React Query",
    "socket.io": "Socket.IO",
    "three": "Three.js",
    "electron": "Electron",
}


def _run_git(cwd: str, *args: str, timeout: float = 3) -> str | None:
    """Run a git command, return stdout or None on failure."""
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return None


def scan_project_name(project_dir: Path) -> tuple[str, str]:
    """
    Extract project name and description.
    Returns (name, description).
    """
    name = project_dir.name
    description = ""

    # Try package.json
    pkg = project_dir / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            if data.get("name"):
                name = data["name"]
            if data.get("description"):
                description = data["description"]
        except (json.JSONDecodeError, OSError):
            pass

    # Try pyproject.toml
    if not description:
        pyproject = project_dir / "pyproject.toml"
        if pyproject.exists():
            try:
                text = pyproject.read_text()
                m = re.search(r'^name\s*=\s*"(.+?)"', text, re.MULTILINE)
                if m:
                    name = m.group(1)
                m = re.search(r'^description\s*=\s*"(.+?)"', text, re.MULTILINE)
                if m:
                    description = m.group(1)
            except OSError:
                pass

    # Try Cargo.toml
    if not description:
        cargo = project_dir / "Cargo.toml"
        if cargo.exists():
            try:
                text = cargo.read_text()
                m = re.search(r'^name\s*=\s*"(.+?)"', text, re.MULTILINE)
                if m:
                    name = m.group(1)
                m = re.search(r'^description\s*=\s*"(.+?)"', text, re.MULTILINE)
                if m:
                    description = m.group(1)
            except OSError:
                pass

    # Try README.md for description
    if not description:
        for readme_name in ("README.md", "readme.md", "Readme.md"):
            readme = project_dir / readme_name
            if readme.exists():
                try:
                    text = readme.read_text(errors="replace")
                    # Skip the H1 title, grab first paragraph
                    lines = text.split("\n")
                    para_lines = []
                    past_title = False
                    for line in lines:
                        stripped = line.strip()
                        if not past_title:
                            if stripped.startswith("#"):
                                past_title = True
                                continue
                            if stripped:
                                past_title = True
                        if past_title:
                            if stripped.startswith("#"):
                                break
                            if stripped == "" and para_lines:
                                break
                            if stripped and not stripped.startswith("![") and not stripped.startswith("[!"):
                                para_lines.append(stripped)
                    description = " ".join(para_lines)[:300]
                except OSError:
                    pass
                break

    return name, description


def scan_tech_stack(project_dir: Path) -> list[str]:
    """Detect tech stack from file extensions and config files."""
    tech = set()

    # Check config files
    for filename, framework in FRAMEWORK_FILES.items():
        target = project_dir / filename
        if target.exists():
            if framework:
                tech.add(framework)
            elif filename == "package.json":
                # Parse package.json for frameworks
                try:
                    data = json.loads(target.read_text())
                    all_deps = {}
                    all_deps.update(data.get("dependencies", {}))
                    all_deps.update(data.get("devDependencies", {}))
                    for dep, fw in NPM_FRAMEWORKS.items():
                        if dep in all_deps:
                            tech.add(fw)
                except (json.JSONDecodeError, OSError):
                    pass

    # Scan file extensions (quick sample — max 500 files)
    ext_counter: Counter = Counter()
    count = 0
    skip_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist",
                 "build", ".next", ".nuxt", "target", "vendor", ".tox", "coverage"}

    for root, dirs, files in os.walk(project_dir):
        # Prune skip directories
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in EXTENSION_MAP:
                ext_counter[ext] += 1
                count += 1
                if count > 500:
                    break
        if count > 500:
            break

    # Add languages for top extensions
    for ext, _ in ext_counter.most_common(5):
        lang = EXTENSION_MAP.get(ext)
        if lang:
            tech.add(lang)

    return sorted(tech)


def scan_git_info(project_dir: Path) -> dict:
    """Extract git repository info."""
    info = {
        "repo_url": "",
        "branch": "",
        "last_commit": "",
        "last_commit_date": "",
        "commit_count_24h": 0,
    }

    if not (project_dir / ".git").exists():
        return info

    cwd = str(project_dir)

    # Repo URL
    url = _run_git(cwd, "remote", "get-url", "origin")
    if url:
        info["repo_url"] = url

    # Current branch
    branch = _run_git(cwd, "rev-parse", "--abbrev-ref", "HEAD")
    if branch:
        info["branch"] = branch

    # Last commit
    log = _run_git(cwd, "log", "-1", "--format=%H|%s|%ai")
    if log and "|" in log:
        parts = log.split("|", 2)
        info["last_commit"] = parts[1] if len(parts) > 1 else ""
        info["last_commit_date"] = parts[2] if len(parts) > 2 else ""

    # Commits in last 24h
    count = _run_git(cwd, "rev-list", "--count", "--since=24.hours.ago", "HEAD")
    if count and count.isdigit():
        info["commit_count_24h"] = int(count)

    return info


def scan_sprint_files(project_dir: Path) -> list[str]:
    """Find SPRINT_*.md files in the project directory."""
    sprints = []
    for pattern in ("SPRINT_*.md", "sprint_*.md", "sprints/SPRINT_*.md"):
        for match in project_dir.glob(pattern):
            sprints.append(str(match))
    return sorted(sprints)


def scan_agent_definitions(project_dir: Path) -> list[dict]:
    """
    Parse CLAUDE.md and .claude/agents/*.md for agent definitions.
    Returns list of {name, role, skills}.
    """
    agents = []

    # Check .claude/agents/*.md
    agents_dir = project_dir / ".claude" / "agents"
    if agents_dir.exists():
        for md in agents_dir.glob("*.md"):
            try:
                text = md.read_text(errors="replace")
                name = md.stem.lower()
                role = ""
                skills = []

                # Parse YAML frontmatter
                fm_match = re.match(r"^---\s*\n(.+?)\n---", text, re.DOTALL)
                if fm_match:
                    fm = fm_match.group(1)
                    role_m = re.search(r"^role:\s*(.+)$", fm, re.MULTILINE)
                    if role_m:
                        role = role_m.group(1).strip().strip('"')
                    # Look for tools/skills
                    tools_m = re.search(r"^tools:\s*\[(.+?)\]", fm, re.MULTILINE)
                    if tools_m:
                        skills = [s.strip().strip('"') for s in tools_m.group(1).split(",")]

                # If no role from frontmatter, get from first paragraph
                if not role:
                    lines = text.split("\n")
                    for line in lines:
                        stripped = line.strip()
                        if stripped and not stripped.startswith("#") and not stripped.startswith("---"):
                            role = stripped[:120]
                            break

                agents.append({
                    "name": name,
                    "role": role,
                    "skills": skills,
                    "source": str(md),
                })
            except OSError:
                continue

    # Check CLAUDE.md for agent references
    claude_md = project_dir / "CLAUDE.md"
    if claude_md.exists():
        try:
            text = claude_md.read_text(errors="replace")
            # Look for agent-like references (e.g., "@agent-name" or "Agent: name")
            for m in re.finditer(r"@(\w[\w-]+)", text):
                agent_name = m.group(1).lower()
                # Only add if not already found
                if not any(a["name"] == agent_name for a in agents):
                    agents.append({
                        "name": agent_name,
                        "role": "Referenced in CLAUDE.md",
                        "skills": [],
                        "source": str(claude_md),
                    })
        except OSError:
            pass

    return agents


def scan_git_standup(project_dir: Path, hours: int = 24) -> list[dict]:
    """
    Generate standup entries from git log for the last N hours.
    Returns list of {author, commits_done, current_branch}.
    """
    standups = []
    cwd = str(project_dir)

    if not (project_dir / ".git").exists():
        return standups

    # Get commits from last N hours, grouped by author
    log = _run_git(
        cwd, "log", f"--since={hours}.hours.ago",
        "--format=%an|%s", "--no-merges",
    )
    if not log:
        return standups

    # Group commits by author
    author_commits: dict[str, list[str]] = {}
    for line in log.strip().split("\n"):
        if "|" not in line:
            continue
        author, message = line.split("|", 1)
        author = author.strip()
        if author not in author_commits:
            author_commits[author] = []
        author_commits[author].append(message.strip())

    # Get current branch
    branch = _run_git(cwd, "rev-parse", "--abbrev-ref", "HEAD") or "unknown"

    for author, commits in author_commits.items():
        # Build "done" summary from commit messages
        done_items = []
        for c in commits[:10]:  # cap at 10
            done_items.append(f"- {c}")
        done = "\n".join(done_items)

        # "doing" = current branch work
        doing = f"Working on branch: {branch}"

        standups.append({
            "author": author,
            "done": done,
            "doing": doing,
            "commits_count": len(commits),
        })

    return standups


def scan_project(project_dir: str | Path) -> dict:
    """Full project scan. Returns all detected metadata."""
    project_dir = Path(project_dir).resolve()

    if not project_dir.is_dir():
        return {"error": f"Not a directory: {project_dir}"}

    name, description = scan_project_name(project_dir)
    tech_stack = scan_tech_stack(project_dir)
    git_info = scan_git_info(project_dir)
    sprint_files = scan_sprint_files(project_dir)
    agents = scan_agent_definitions(project_dir)
    standups = scan_git_standup(project_dir)

    return {
        "path": str(project_dir),
        "name": name,
        "slug": name.lower().replace(" ", "-").replace("_", "-"),
        "description": description,
        "tech_stack": tech_stack,
        "git": git_info,
        "sprint_files": sprint_files,
        "agents": agents,
        "standups": standups,
    }


def main():
    parser = argparse.ArgumentParser(description="Scan a project directory for metadata")
    parser.add_argument("directory", help="Path to the project directory")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    result = scan_project(args.directory)

    if args.json:
        print(json.dumps(result, indent=2))
        return

    # Pretty print
    print(f"\n{'='*60}")
    print(f"  Project: {result['name']}")
    print(f"  Path:    {result['path']}")
    print(f"  Slug:    {result['slug']}")
    if result["description"]:
        print(f"  Desc:    {result['description'][:80]}")
    print(f"{'='*60}\n")

    print(f"  Tech Stack: {', '.join(result['tech_stack']) or 'unknown'}")
    print()

    git = result["git"]
    if git["branch"]:
        print(f"  Git Branch:     {git['branch']}")
        print(f"  Last Commit:    {git['last_commit']}")
        print(f"  Repo URL:       {git['repo_url']}")
        print(f"  Commits (24h):  {git['commit_count_24h']}")
    else:
        print("  Git: not a git repository")
    print()

    if result["sprint_files"]:
        print(f"  Sprint Files ({len(result['sprint_files'])}):")
        for sf in result["sprint_files"]:
            print(f"    - {sf}")
    else:
        print("  Sprint Files: none found")
    print()

    if result["agents"]:
        print(f"  Agent Definitions ({len(result['agents'])}):")
        for a in result["agents"]:
            print(f"    - {a['name']:20s} | {a['role'][:50]}")
    else:
        print("  Agent Definitions: none found")
    print()

    if result["standups"]:
        print(f"  Git Standups (last 24h):")
        for s in result["standups"]:
            print(f"    - {s['author']}: {s['commits_count']} commits")
    else:
        print("  Git Standups: no recent commits")
    print()


if __name__ == "__main__":
    main()
