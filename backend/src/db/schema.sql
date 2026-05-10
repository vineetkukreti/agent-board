-- ============================================================
-- Agent Board — SQLite Schema
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ============================================================
-- AGENT_TYPES (dynamic registry)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_types (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE,
    slug          TEXT    NOT NULL UNIQUE,
    category      TEXT,
    description   TEXT,
    metadata      TEXT    DEFAULT '{}',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_types_category ON agent_types(category);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE,
    slug          TEXT    NOT NULL UNIQUE,
    description   TEXT,
    color         TEXT,
    metadata      TEXT    DEFAULT '{}',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- AGENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,
    agent_type_id INTEGER REFERENCES agent_types(id) ON DELETE SET NULL,
    team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    model         TEXT,
    status        TEXT    NOT NULL DEFAULT 'idle'
                          CHECK(status IN ('active','idle','blocked','offline')),
    api_key_hash  TEXT    UNIQUE,
    is_human      INTEGER NOT NULL DEFAULT 0,
    avatar_url    TEXT,
    metadata      TEXT    DEFAULT '{}',
    last_seen_at  TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agents_status     ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_team       ON agents(team_id);
CREATE INDEX IF NOT EXISTS idx_agents_type       ON agents(agent_type_id);
CREATE INDEX IF NOT EXISTS idx_agents_last_seen  ON agents(last_seen_at);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE,
    slug          TEXT    NOT NULL UNIQUE,
    description   TEXT,
    status        TEXT    NOT NULL DEFAULT 'active'
                          CHECK(status IN ('active','archived','paused')),
    metadata      TEXT    DEFAULT '{}',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SPRINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS sprints (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    goal          TEXT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status        TEXT    NOT NULL DEFAULT 'planning'
                          CHECK(status IN ('planning','active','completed','cancelled')),
    start_date    TEXT,
    end_date      TEXT,
    metadata      TEXT    DEFAULT '{}',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status  ON sprints(status);

-- ============================================================
-- TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    description   TEXT,
    status        TEXT    NOT NULL DEFAULT 'todo'
                          CHECK(status IN ('todo','in_progress','review','done','blocked','cancelled')),
    priority      TEXT    NOT NULL DEFAULT 'p2'
                          CHECK(priority IN ('p0','p1','p2','p3')),
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id   INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    reporter_id   INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    sprint_id     INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
    parent_id     INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    tags          TEXT    DEFAULT '[]',
    close_summary TEXT,
    closed_at     TEXT,
    metadata      TEXT    DEFAULT '{}',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_status    ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority  ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_project   ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee  ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sprint    ON tickets(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tickets_parent    ON tickets(parent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created   ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_project_status ON tickets(project_id, status);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id     INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id     INTEGER REFERENCES agents(id) ON DELETE CASCADE,
    body          TEXT    NOT NULL,
    metadata      TEXT    DEFAULT '{}',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);

-- ============================================================
-- BLOCKERS
-- ============================================================
CREATE TABLE IF NOT EXISTS blockers (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id            INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    blocked_by_ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    blocked_by_agent_id  INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    reason               TEXT    NOT NULL,
    status               TEXT    NOT NULL DEFAULT 'active'
                                 CHECK(status IN ('active','resolved')),
    resolved_at          TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blockers_ticket ON blockers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_blockers_status ON blockers(status);

-- ============================================================
-- STANDUP_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS standup_entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id      INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    date          TEXT    NOT NULL,
    yesterday     TEXT,
    today         TEXT,
    blockers      TEXT,
    metadata      TEXT    DEFAULT '{}',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(agent_id, project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_standup_agent_date ON standup_entries(agent_id, date);
CREATE INDEX IF NOT EXISTS idx_standup_date       ON standup_entries(date);

-- ============================================================
-- ACTIVITY_LOG (append-only audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type    TEXT    NOT NULL,
    entity_type   TEXT    NOT NULL,
    entity_id     INTEGER NOT NULL,
    agent_id      INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    old_value     TEXT,
    new_value     TEXT,
    summary       TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_created         ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_project         ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_agent           ON activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_type            ON activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log(project_id, created_at);

-- ============================================================
-- SPRINT_SNAPSHOTS (daily burndown data)
-- ============================================================
CREATE TABLE IF NOT EXISTS sprint_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sprint_id   INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    date        TEXT    NOT NULL,
    todo        INTEGER NOT NULL DEFAULT 0,
    in_progress INTEGER NOT NULL DEFAULT 0,
    review      INTEGER NOT NULL DEFAULT 0,
    done        INTEGER NOT NULL DEFAULT 0,
    blocked     INTEGER NOT NULL DEFAULT 0,
    total       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT,
    UNIQUE(sprint_id, date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_sprint ON sprint_snapshots(sprint_id);

-- ============================================================
-- AGENT_SESSIONS (links a Claude Code session to agent+ticket)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_sessions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id         TEXT    NOT NULL,
    agent_id           INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    ticket_id          INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    project_id         INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    cwd                TEXT,
    task_description   TEXT,
    status             TEXT    NOT NULL DEFAULT 'active'
                               CHECK(status IN ('active','completed','error')),
    input_tokens       INTEGER NOT NULL DEFAULT 0,
    output_tokens      INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost_usd     REAL    NOT NULL DEFAULT 0.0,
    summary            TEXT,
    metadata           TEXT    DEFAULT '{}',
    started_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_sid      ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent           ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_ticket          ON agent_sessions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status          ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started         ON agent_sessions(started_at);

-- ============================================================
-- TOOL_USAGE_LOG (individual tool calls within a session)
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_usage_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER REFERENCES agent_sessions(id) ON DELETE CASCADE,
    ticket_id       INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    agent_id        INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    tool_name       TEXT    NOT NULL,
    file_path       TEXT,
    command         TEXT,
    lines_added     INTEGER DEFAULT 0,
    lines_removed   INTEGER DEFAULT 0,
    duration_ms     INTEGER,
    is_error        INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    metadata        TEXT    DEFAULT '{}',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tool_usage_session  ON tool_usage_log(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_ticket   ON tool_usage_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool     ON tool_usage_log(tool_name);

-- ============================================================
-- TICKET_METRICS (aggregated stats per ticket)
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_metrics (
    ticket_id          INTEGER PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
    input_tokens       INTEGER NOT NULL DEFAULT 0,
    output_tokens      INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost_usd     REAL    NOT NULL DEFAULT 0.0,
    duration_seconds   INTEGER NOT NULL DEFAULT 0,
    files_modified     TEXT    DEFAULT '[]',
    tools_used         TEXT    DEFAULT '{}',
    lines_added        INTEGER NOT NULL DEFAULT 0,
    lines_removed      INTEGER NOT NULL DEFAULT 0,
    error_count        INTEGER NOT NULL DEFAULT 0,
    session_count      INTEGER NOT NULL DEFAULT 0,
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ADMIN_USERS (human UI auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'admin'
                          CHECK(role IN ('admin','lead','viewer')),
    display_name  TEXT,
    email         TEXT,
    team_id       INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    token         TEXT    PRIMARY KEY,
    admin_id      INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    username      TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'admin',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhooks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    url           TEXT    NOT NULL,
    secret        TEXT,
    events        TEXT    NOT NULL DEFAULT '["*"]',
    is_active     INTEGER NOT NULL DEFAULT 1,
    description   TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id    INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event         TEXT    NOT NULL,
    payload       TEXT    NOT NULL,
    status_code   INTEGER,
    response_body TEXT,
    success       INTEGER NOT NULL DEFAULT 0,
    attempt       INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
