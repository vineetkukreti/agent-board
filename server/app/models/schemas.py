"""
Agent Board — Pydantic v2 schemas for all domain models.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class AgentStatus(str, Enum):
    active = "active"
    idle = "idle"
    blocked = "blocked"
    offline = "offline"


class ProjectStatus(str, Enum):
    active = "active"
    archived = "archived"
    paused = "paused"


class SprintStatus(str, Enum):
    planning = "planning"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class TicketStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    review = "review"
    done = "done"
    blocked = "blocked"
    cancelled = "cancelled"


class TicketPriority(str, Enum):
    p0 = "p0"
    p1 = "p1"
    p2 = "p2"
    p3 = "p3"


class BlockerStatus(str, Enum):
    active = "active"
    resolved = "resolved"


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

T = TypeVar("T")


class Pagination(BaseModel):
    page: int = Field(ge=1, default=1)
    per_page: int = Field(ge=1, le=200, default=50)
    total: int
    total_pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    pagination: Pagination


# ---------------------------------------------------------------------------
# AgentType
# ---------------------------------------------------------------------------


class AgentTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    category: str | None = None
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    category: str | None
    description: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    description: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    metadata: dict[str, Any] = Field(default_factory=dict)


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    metadata: dict[str, Any] | None = None


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    color: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------


class AgentRegister(BaseModel):
    """Used when an agent self-registers. Returns api_key on success."""

    name: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    display_name: str = Field(min_length=1, max_length=128)
    agent_type_id: int | None = None
    team_id: int | None = None
    model: str | None = None
    is_human: bool = False
    avatar_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentRegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    display_name: str
    api_key: str  # returned only on registration, never again


class AgentUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    agent_type_id: int | None = None
    team_id: int | None = None
    model: str | None = None
    status: AgentStatus | None = None
    avatar_url: str | None = None
    metadata: dict[str, Any] | None = None


class AgentWorkload(BaseModel):
    """Embedded workload summary on AgentResponse."""

    open_tickets: int = 0
    in_progress_tickets: int = 0
    blocked_tickets: int = 0
    review_tickets: int = 0


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    display_name: str
    agent_type_id: int | None
    team_id: int | None
    model: str | None
    status: AgentStatus
    is_human: bool
    avatar_url: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    last_seen_at: str | None
    created_at: str
    updated_at: str
    workload: AgentWorkload = Field(default_factory=AgentWorkload)


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    description: str | None = None
    status: ProjectStatus = ProjectStatus.active
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    status: ProjectStatus | None = None
    metadata: dict[str, Any] | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    status: ProjectStatus
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Sprint
# ---------------------------------------------------------------------------


class SprintCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    goal: str | None = None
    project_id: int
    status: SprintStatus = SprintStatus.planning
    start_date: str | None = None  # ISO date string, e.g. "2026-04-01"
    end_date: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SprintUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    goal: str | None = None
    status: SprintStatus | None = None
    start_date: str | None = None
    end_date: str | None = None
    metadata: dict[str, Any] | None = None


class SprintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    goal: str | None
    project_id: int
    status: SprintStatus
    start_date: str | None
    end_date: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Ticket
# ---------------------------------------------------------------------------


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description: str | None = None
    status: TicketStatus = TicketStatus.todo
    priority: TicketPriority = TicketPriority.p2
    project_id: int
    assignee_id: int | None = None
    reporter_id: int | None = None
    sprint_id: int | None = None
    parent_id: int | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = None
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assignee_id: int | None = None
    sprint_id: int | None = None
    parent_id: int | None = None
    tags: list[str] | None = None
    close_summary: str | None = None
    metadata: dict[str, Any] | None = None


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    status: TicketStatus
    priority: TicketPriority
    project_id: int
    assignee_id: int | None
    reporter_id: int | None
    sprint_id: int | None
    parent_id: int | None
    tags: list[str] = Field(default_factory=list)
    close_summary: str | None
    closed_at: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Comment
# ---------------------------------------------------------------------------


class CommentCreate(BaseModel):
    ticket_id: int
    author_id: int
    body: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    author_id: int
    body: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


# ---------------------------------------------------------------------------
# Blocker
# ---------------------------------------------------------------------------


class BlockerCreate(BaseModel):
    ticket_id: int
    blocked_by_ticket_id: int | None = None
    blocked_by_agent_id: int | None = None
    reason: str = Field(min_length=1)


class BlockerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    blocked_by_ticket_id: int | None
    blocked_by_agent_id: int | None
    reason: str
    status: BlockerStatus
    resolved_at: str | None
    created_at: str


# ---------------------------------------------------------------------------
# StandupEntry
# ---------------------------------------------------------------------------


class StandupEntryCreate(BaseModel):
    agent_id: int
    project_id: int | None = None
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    yesterday: str | None = None
    today: str | None = None
    blockers: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class StandupEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    agent_id: int
    project_id: int | None
    date: str
    yesterday: str | None
    today: str | None
    blockers: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


# ---------------------------------------------------------------------------
# ActivityLog
# ---------------------------------------------------------------------------


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    entity_type: str
    entity_id: int
    agent_id: int | None
    project_id: int | None
    old_value: str | None
    new_value: str | None
    summary: str | None
    created_at: str


# ---------------------------------------------------------------------------
# Dashboard (CEO / full board view)
# ---------------------------------------------------------------------------


class TicketStatusBreakdown(BaseModel):
    todo: int = 0
    in_progress: int = 0
    review: int = 0
    done: int = 0
    blocked: int = 0
    cancelled: int = 0


class AgentStatusBreakdown(BaseModel):
    active: int = 0
    idle: int = 0
    blocked: int = 0
    offline: int = 0


class ProjectSummary(BaseModel):
    id: int
    name: str
    slug: str
    status: ProjectStatus
    ticket_breakdown: TicketStatusBreakdown
    active_sprint: SprintResponse | None


class DashboardResponse(BaseModel):
    total_agents: int
    agent_status_breakdown: AgentStatusBreakdown
    total_projects: int
    total_teams: int
    ticket_breakdown: TicketStatusBreakdown
    active_blockers: int
    projects: list[ProjectSummary]
    recent_activity: list[ActivityLogResponse]
    standups_today: int
    generated_at: str


# ---------------------------------------------------------------------------
# Admin auth
# ---------------------------------------------------------------------------


class AdminLogin(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)


class AdminLoginResponse(BaseModel):
    token: str
    admin_id: int
    username: str
    role: str
