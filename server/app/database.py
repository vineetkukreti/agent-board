"""
Agent Board — Async SQLite database layer using aiosqlite.
"""

from __future__ import annotations

import os
import aiosqlite
from pathlib import Path
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

DB_PATH: str = os.getenv("DB_PATH", "./data/agent-board.db")

_HERE = Path(__file__).parent.parent  # server/
_SCHEMA_PATH = _HERE / "src" / "db" / "schema.sql"
_SEED_PATH = _HERE / "src" / "db" / "seed.sql"


def _resolved_db_path() -> Path:
    p = Path(DB_PATH)
    if not p.is_absolute():
        p = (_HERE / p).resolve()
    return p


async def init_db() -> None:
    db_path = _resolved_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(db_path)) as db:
        await db.execute("PRAGMA journal_mode = WAL;")
        await db.execute("PRAGMA foreign_keys = ON;")
        await db.execute("PRAGMA busy_timeout = 5000;")

        if _SCHEMA_PATH.exists():
            schema_sql = _SCHEMA_PATH.read_text()
            await db.executescript(schema_sql)
        else:
            raise FileNotFoundError(f"Schema file not found: {_SCHEMA_PATH}")

        # Seed only when agent_types table is empty
        cursor = await db.execute("SELECT COUNT(*) FROM agent_types;")
        row = await cursor.fetchone()
        if row and row[0] == 0 and _SEED_PATH.exists():
            seed_sql = _SEED_PATH.read_text()
            await db.executescript(seed_sql)

        await db.commit()


@asynccontextmanager
async def get_db_ctx() -> AsyncGenerator[aiosqlite.Connection, None]:
    db_path = _resolved_db_path()
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON;")
        await db.execute("PRAGMA journal_mode = WAL;")
        try:
            yield db
        finally:
            pass


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    db_path = _resolved_db_path()
    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON;")
        yield db
