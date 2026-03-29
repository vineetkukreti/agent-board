#!/usr/bin/env python3
"""
agent_sdk.py — Lightweight Agent Board SDK.

A single-file Python module that any Vineet Corp agent can import to report
work, manage tickets, and submit standups. Zero external dependencies — only
stdlib plus the agent's API key.

Quick start:
    from agent_sdk import AgentBoard

    board = AgentBoard(agent_name="rahul")
    ticket = board.create_ticket("Fix slow query", project="agent-board", priority="p1")
    board.start_ticket(ticket["id"])
    board.done_ticket(ticket["id"], summary="Added composite index")

API key resolution order:
    1. Explicit api_key argument
    2. AGENT_BOARD_API_KEY environment variable
    3. tools/agent_keys.json keyed by agent_name
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

logger = logging.getLogger("agent_board_sdk")
if not logger.handlers:
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s [agent_sdk] %(message)s")


# ---------------------------------------------------------------------------
# Internal HTTP helper
# ---------------------------------------------------------------------------


def _http(
    method: str,
    url: str,
    payload: dict | None = None,
    api_key: str | None = None,
    params: dict | None = None,
) -> tuple[int, Any]:
    """
    Make an HTTP request and return (status_code, parsed_body).

    Never raises — on network/decode errors returns (-1, error_string).
    """
    if params:
        from urllib.parse import urlencode
        url = f"{url}?{urlencode(params)}"

    data = json.dumps(payload).encode() if payload is not None else None
    headers: dict[str, str] = {"Content-Type": "application/json", "Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            body = json.loads(raw) if raw else {}
            return resp.status, body
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read().decode())
        except Exception:
            body = {"detail": str(exc)}
        return exc.code, body
    except Exception as exc:
        return -1, str(exc)


# ---------------------------------------------------------------------------
# Key loader
# ---------------------------------------------------------------------------


def _load_key_from_file(agent_name: str) -> str | None:
    """Try to read the API key for *agent_name* from tools/agent_keys.json."""
    # Look relative to this file's directory
    candidate = Path(__file__).parent / "agent_keys.json"
    if not candidate.exists():
        return None
    try:
        with candidate.open() as f:
            keys: dict = json.load(f)
        return keys.get(agent_name)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# SDK class
# ---------------------------------------------------------------------------


class AgentBoard:
    """
    Lightweight SDK for agents to report work to Agent Board.

    Parameters
    ----------
    url : str
        Base URL of the Agent Board API.
    api_key : str | None
        The agent's API key. If not provided, the SDK tries the
        AGENT_BOARD_API_KEY env var, then agent_keys.json.
    agent_name : str | None
        The agent's registered name (e.g. "rahul"). Used for key lookup
        from agent_keys.json and as the default author on standups.
    """

    def __init__(
        self,
        url: str = "http://localhost:8001",
        api_key: str | None = None,
        agent_name: str | None = None,
    ) -> None:
        self._base = url.rstrip("/")
        self._name = agent_name

        # Key resolution
        if api_key:
            self._key = api_key
        elif os.environ.get("AGENT_BOARD_API_KEY"):
            self._key = os.environ["AGENT_BOARD_API_KEY"]
        elif agent_name:
            self._key = _load_key_from_file(agent_name) or ""
        else:
            self._key = ""

        if not self._key:
            logger.warning(
                "No API key found for agent '%s'. "
                "Set AGENT_BOARD_API_KEY or pass api_key=. "
                "All SDK calls will be unauthenticated and will likely fail.",
                agent_name or "unknown",
            )

        # Cache agent id after first successful lookup
        self._agent_id: int | None = None

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    def _url(self, path: str) -> str:
        return f"{self._base}{path}"

    def _get(self, path: str, params: dict | None = None) -> tuple[int, Any]:
        return _http("GET", self._url(path), api_key=self._key, params=params)

    def _post(self, path: str, payload: dict) -> tuple[int, Any]:
        return _http("POST", self._url(path), payload=payload, api_key=self._key)

    def _put(self, path: str, payload: dict) -> tuple[int, Any]:
        return _http("PUT", self._url(path), payload=payload, api_key=self._key)

    def _warn(self, action: str, sc: int, body: Any) -> None:
        detail = body.get("detail", body) if isinstance(body, dict) else body
        logger.warning("[%s] %s failed (%s): %s", self._name or "agent", action, sc, detail)

    def _resolve_agent_id(self) -> int | None:
        """
        Return the numeric agent ID for this instance's agent_name by querying
        the board. Result is cached after the first successful lookup.
        """
        if self._agent_id is not None:
            return self._agent_id
        if not self._name:
            logger.warning("agent_name not set — cannot resolve agent_id")
            return None

        sc, body = self._get("/api/v1/agents/", {"per_page": 200})
        if sc != 200:
            self._warn("resolve_agent_id", sc, body)
            return None

        for agent in body.get("data", []):
            if agent.get("name") == self._name:
                self._agent_id = agent["id"]
                return self._agent_id

        # Paginate if needed
        pages = body.get("pagination", {}).get("pages", 1)
        for page in range(2, pages + 1):
            sc, body = self._get("/api/v1/agents/", {"per_page": 200, "page": page})
            if sc != 200:
                break
            for agent in body.get("data", []):
                if agent.get("name") == self._name:
                    self._agent_id = agent["id"]
                    return self._agent_id

        logger.warning("Agent '%s' not found on the board.", self._name)
        return None

    def _resolve_project_id(self, project: str) -> int | None:
        """
        Resolve a project slug or name to its numeric ID.
        """
        sc, body = self._get("/api/v1/projects/")
        if sc != 200:
            self._warn("resolve_project_id", sc, body)
            return None

        project_lower = project.lower().strip()
        for p in body.get("data", []):
            if p.get("slug", "").lower() == project_lower:
                return p["id"]
            if p.get("name", "").lower() == project_lower:
                return p["id"]

        logger.warning("Project '%s' not found on the board.", project)
        return None

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    def heartbeat(self) -> dict:
        """
        Ping Agent Board to mark this agent as active.

        Returns the response dict, or an empty dict on failure.
        """
        agent_id = self._resolve_agent_id()
        if agent_id is None:
            return {}

        sc, body = self._post(f"/api/v1/agents/{agent_id}/heartbeat", {})
        if sc != 200:
            self._warn("heartbeat", sc, body)
            return {}
        return body

    def create_ticket(
        self,
        title: str,
        project: str,
        priority: str = "p2",
        description: str = "",
    ) -> dict:
        """
        Create a new ticket and return the ticket data dict (including id).

        Parameters
        ----------
        title : str
            Short title for the ticket.
        project : str
            Project slug or name (e.g. "agent-board", "dsa-tracker").
        priority : str
            One of p0, p1, p2, p3 (default: p2).
        description : str
            Optional longer description.

        Returns
        -------
        dict
            Full ticket object. Check ticket["id"] for the new ticket ID.
            Returns empty dict on failure.
        """
        project_id = self._resolve_project_id(project)
        if project_id is None:
            return {}

        agent_id = self._resolve_agent_id()

        payload: dict = {
            "title": title,
            "project_id": project_id,
            "priority": priority,
        }
        if description:
            payload["description"] = description
        if agent_id is not None:
            payload["reporter_id"] = agent_id
            payload["assignee_id"] = agent_id

        sc, body = self._post("/api/v1/tickets/", payload)
        if sc != 201:
            self._warn("create_ticket", sc, body)
            return {}
        return body

    def start_ticket(self, ticket_id: int) -> dict:
        """
        Mark a ticket as in_progress.

        Returns the updated ticket dict, or empty dict on failure.
        """
        sc, body = self._post(f"/api/v1/tickets/{ticket_id}/start", {})
        if sc != 200:
            self._warn(f"start_ticket({ticket_id})", sc, body)
            return {}
        return body

    def block_ticket(
        self,
        ticket_id: int,
        reason: str,
        blocked_by_agent: str | None = None,
    ) -> dict:
        """
        Mark a ticket as blocked.

        Parameters
        ----------
        ticket_id : int
            The ticket to block.
        reason : str
            Human-readable explanation of the blocker.
        blocked_by_agent : str | None
            Name of the agent causing the block (optional). The agent's ID
            will be looked up and attached to the blocker record.

        Returns
        -------
        dict
            Updated ticket dict, or empty dict on failure.
        """
        payload: dict = {"reason": reason}

        if blocked_by_agent:
            # Look up the blocking agent's ID
            sc, body = self._get("/api/v1/agents/", {"per_page": 200})
            if sc == 200:
                for agent in body.get("data", []):
                    if agent.get("name") == blocked_by_agent:
                        payload["blocked_by_agent_id"] = agent["id"]
                        break

        sc, body = self._post(f"/api/v1/tickets/{ticket_id}/block", payload)
        if sc != 200:
            self._warn(f"block_ticket({ticket_id})", sc, body)
            return {}
        return body

    def unblock_ticket(self, ticket_id: int) -> dict:
        """
        Resolve all active blockers and set the ticket back to in_progress.

        Returns the updated ticket dict, or empty dict on failure.
        """
        sc, body = self._post(f"/api/v1/tickets/{ticket_id}/unblock", {})
        if sc != 200:
            self._warn(f"unblock_ticket({ticket_id})", sc, body)
            return {}
        return body

    def review_ticket(self, ticket_id: int) -> dict:
        """
        Move a ticket to the review state.

        Returns the updated ticket dict, or empty dict on failure.
        """
        sc, body = self._post(f"/api/v1/tickets/{ticket_id}/review", {})
        if sc != 200:
            self._warn(f"review_ticket({ticket_id})", sc, body)
            return {}
        return body

    def done_ticket(self, ticket_id: int, summary: str = "") -> dict:
        """
        Mark a ticket as done.

        Parameters
        ----------
        ticket_id : int
            The ticket to close.
        summary : str
            Optional closing summary (stored as close_summary).

        Returns
        -------
        dict
            Updated ticket dict, or empty dict on failure.
        """
        params: dict = {}
        if summary:
            params["close_summary"] = summary

        url = self._url(f"/api/v1/tickets/{ticket_id}/done")
        if params:
            from urllib.parse import urlencode
            url = f"{url}?{urlencode(params)}"

        sc, body = _http("POST", url, payload={}, api_key=self._key)
        if sc != 200:
            self._warn(f"done_ticket({ticket_id})", sc, body)
            return {}
        return body

    def comment(self, ticket_id: int, body: str) -> dict:
        """
        Add a comment to a ticket.

        Parameters
        ----------
        ticket_id : int
            Target ticket.
        body : str
            Comment text.

        Returns
        -------
        dict
            Created comment object, or empty dict on failure.
        """
        agent_id = self._resolve_agent_id()
        if agent_id is None:
            logger.warning("Cannot comment: agent_id unknown for '%s'", self._name)
            return {}

        payload = {"body": body, "author_id": agent_id}
        sc, resp = self._post(f"/api/v1/tickets/{ticket_id}/comments", payload)
        if sc != 201:
            self._warn(f"comment(ticket={ticket_id})", sc, resp)
            return {}
        return resp

    def submit_standup(
        self,
        yesterday: str,
        today: str,
        blockers: str = "",
        project: str | None = None,
    ) -> dict:
        """
        Submit a daily standup entry for today.

        Parameters
        ----------
        yesterday : str
            What was accomplished yesterday.
        today : str
            What is planned for today.
        blockers : str
            Any blockers (default: empty string).
        project : str | None
            Project slug or name to associate the standup with (optional).

        Returns
        -------
        dict
            Created standup entry, or empty dict on failure.
        """
        agent_id = self._resolve_agent_id()
        if agent_id is None:
            return {}

        payload: dict = {
            "agent_id": agent_id,
            "yesterday": yesterday,
            "today": today,
            "blockers": blockers or None,
        }

        if project:
            project_id = self._resolve_project_id(project)
            if project_id is not None:
                payload["project_id"] = project_id

        sc, body = self._post("/api/v1/standups/", payload)
        if sc not in (200, 201):
            self._warn("submit_standup", sc, body)
            return {}
        return body

    def get_my_tickets(self) -> list[dict]:
        """
        Return all tickets currently assigned to this agent.

        Returns
        -------
        list[dict]
            List of ticket dicts (may be empty). On error, returns [].
        """
        agent_id = self._resolve_agent_id()
        if agent_id is None:
            return []

        tickets: list[dict] = []
        page = 1
        while True:
            sc, body = self._get(
                "/api/v1/tickets/",
                {"assignee_id": agent_id, "per_page": 100, "page": page},
            )
            if sc != 200:
                self._warn("get_my_tickets", sc, body)
                break
            tickets.extend(body.get("data", []))
            pagination = body.get("pagination", {})
            if page >= pagination.get("pages", 1):
                break
            page += 1

        return tickets

    # -----------------------------------------------------------------------
    # Convenience
    # -----------------------------------------------------------------------

    def __repr__(self) -> str:
        key_status = "key set" if self._key else "NO KEY"
        return f"<AgentBoard agent='{self._name}' url='{self._base}' {key_status}>"
