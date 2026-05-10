"""
API router registry.

Keep route mounting in one small module so app/main.py stays focused on process
startup, middleware, exception handling, and realtime mounting.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import FastAPI

from app.routes import (
    activity,
    agent_types,
    agents,
    auth_routes,
    dashboard,
    github,
    projects,
    sprints,
    standups,
    teams,
    tickets,
    tracking,
    webhooks,
)


@dataclass(frozen=True)
class RouteConfig:
    router: object
    prefix: str
    tag: str


API_ROUTES = (
    RouteConfig(auth_routes.router, "/api/v1/auth", "auth"),
    RouteConfig(agents.router, "/api/v1/agents", "agents"),
    RouteConfig(agent_types.router, "/api/v1/agent-types", "agent-types"),
    RouteConfig(teams.router, "/api/v1/teams", "teams"),
    RouteConfig(projects.router, "/api/v1/projects", "projects"),
    RouteConfig(tickets.router, "/api/v1/tickets", "tickets"),
    RouteConfig(sprints.router, "/api/v1/sprints", "sprints"),
    RouteConfig(standups.router, "/api/v1/standups", "standups"),
    RouteConfig(dashboard.router, "/api/v1/dashboard", "dashboard"),
    RouteConfig(activity.router, "/api/v1/activity", "activity"),
    RouteConfig(tracking.router, "/api/v1/tracking", "tracking"),
    RouteConfig(github.router, "/api/v1/webhooks", "github-webhooks"),
    RouteConfig(webhooks.router, "/api/v1/hooks", "webhooks"),
)


def register_api_routes(app: FastAPI) -> None:
    for route in API_ROUTES:
        app.include_router(route.router, prefix=route.prefix, tags=[route.tag])
