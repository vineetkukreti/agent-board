# Sprint: Competitive Feature Parity

## Sprint Meta
| Field | Value |
|-------|-------|
| Start Date | 2026-05-03 |
| End Date | 2026-05-04 |

## North Star
**"Close the gap with Mission Control, AgentOps, and ai-agent-board — make Agent Board the best self-hosted AI agent management platform"**

## Sprint Backlog

### P0 -- Critical (Ship Today)
| ID | Title | Description | Squad | Size | Dependencies | Status |
|----|-------|-------------|-------|------|--------------|--------|
| T1 | WebSocket real-time updates | Add Socket.IO to server + client. Push agent status changes, new tickets, session start/end live to dashboard. No more 30s polling. | Lead: rahul | L | None | TODO |
| T2 | Live token/cost tracking | Capture real token counts from Claude Code session transcripts. Parse JSONL transcript files for usage data. Update session end to include actual costs. | Lead: kavya | M | None | TODO |
| T3 | Code diff viewer in ticket detail | Add a "Changes" tab to ticket detail showing git diffs (files changed, lines added/removed with syntax-highlighted diff view). Pull from git log for the session timeframe. | Lead: sakshi | L | None | TODO |

### P1 -- High
| ID | Title | Description | Squad | Size | Dependencies | Status |
|----|-------|-------------|-------|------|--------------|--------|
| T4 | Session replay / agent trace | Add a "Trace" tab to ticket detail showing step-by-step tool calls with inputs/outputs, timing, and token cost per step. Data already in tool_usage_log. | Lead: sakshi | M | None | TODO |
| T5 | Agent activity sparklines | Add mini sparkline charts to agent cards showing activity over last 24h (sessions per hour). Visual at-a-glance health. | Lead: sakshi | S | None | TODO |
| T6 | Webhook system | POST notifications on events (ticket.created, agent.registered, session.ended, sprint.completed). Configurable URLs with retry and HMAC signing. | Lead: rahul | M | None | TODO |

### P2 -- Medium
| ID | Title | Description | Squad | Size | Dependencies | Status |
|----|-------|-------------|-------|------|--------------|--------|
| T7 | Agent leaderboard page | New /leaderboard page showing agent rankings by completion rate, speed, cost efficiency, error rate. Backend exists, needs UI. | Lead: sakshi | M | None | TODO |
| T8 | RBAC for dashboard users | Add viewer/lead/admin roles with permission checks. Viewers can see but not modify. Leads can manage tickets. Admins can manage agents/users. | Lead: rahul | M | None | TODO |
| T9 | Project health dashboard | Per-project view with sprint velocity, burn-down chart, agent allocation, cost breakdown, and tech stack badges. | Lead: sakshi | M | None | TODO |
