"""
Agent Board — Real-time WebSocket layer using python-socketio.

Provides a Socket.IO async server that broadcasts events to connected clients
whenever agents, tickets, or sessions change.

Usage in route handlers:
    from app.realtime import broadcast
    await broadcast("ticket.created", {"id": 1, "title": "Fix bug"})
"""

from __future__ import annotations

import logging
import os

import socketio

logger = logging.getLogger("agent_board.realtime")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=cors_origins,
    logger=False,
    engineio_logger=False,
)

# Wrap as an ASGI app so FastAPI can mount it
sio_app = socketio.ASGIApp(sio, socketio_path="/socket.io")


@sio.event
async def connect(sid, environ):
    logger.info(f"Socket.IO client connected: {sid}")


@sio.event
async def disconnect(sid):
    logger.info(f"Socket.IO client disconnected: {sid}")


async def broadcast(event: str, data: dict | None = None) -> None:
    """Emit an event to all connected Socket.IO clients."""
    try:
        await sio.emit(event, data or {})
    except Exception as exc:
        logger.warning(f"Failed to broadcast '{event}': {exc}")
