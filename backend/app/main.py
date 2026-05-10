"""
Agent Board — FastAPI application entry point.
"""

from __future__ import annotations

import logging
import os
import traceback
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.realtime import sio_app
from app.routing import register_api_routes

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
    redirect_slashes=False,
)

# CORS
cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
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


register_api_routes(app)


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "agent-board-api"}


# Mount Socket.IO alongside FastAPI
app.mount("/", sio_app)
