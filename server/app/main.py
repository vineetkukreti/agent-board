"""
Agent Board — FastAPI application entry point.
"""

from __future__ import annotations

import logging
import traceback
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from app.database import init_db
from app.routes import (
    auth_routes,
    agents,
    agent_types,
    teams,
    projects,
    tickets,
    sprints,
    standups,
    dashboard,
    activity,
    tracking,
    github,
)

load_dotenv()

logger = logging.getLogger("agent_board")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Agent Board API — initializing database…")
    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception as exc:
        logger.error(f"Failed to initialize database: {exc}")
        raise
    yield
    logger.info("Agent Board API shutting down.")


app = FastAPI(
    title="Agent Board API",
    version="1.0.0",
    description="AI Agent Fleet Management Platform — API-first Scrum board for agent teams.",
    lifespan=lifespan,
)

# CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}:\n"
        + traceback.format_exc()
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


# Routers
app.include_router(auth_routes.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(agent_types.router, prefix="/api/v1/agent-types", tags=["agent-types"])
app.include_router(teams.router, prefix="/api/v1/teams", tags=["teams"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["tickets"])
app.include_router(sprints.router, prefix="/api/v1/sprints", tags=["sprints"])
app.include_router(standups.router, prefix="/api/v1/standups", tags=["standups"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(activity.router, prefix="/api/v1/activity", tags=["activity"])
app.include_router(tracking.router, prefix="/api/v1/tracking", tags=["tracking"])
app.include_router(github.router, prefix="/api/v1/webhooks", tags=["webhooks"])


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "agent-board-api"}
