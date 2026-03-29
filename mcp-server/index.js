#!/usr/bin/env node
/**
 * Agent Board MCP Server
 *
 * Exposes Agent Board REST API as MCP tools so Claude Code agents
 * can track their own work without any SDK imports.
 *
 * Environment variables:
 *   AGENT_BOARD_API_KEY   — agent API key (required)
 *   AGENT_BOARD_AGENT_NAME — agent name slug (e.g. "omkar", "rahul")
 *   AGENT_BOARD_URL       — board base URL (default: http://localhost:8001)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BOARD_URL = (process.env.AGENT_BOARD_URL || "http://localhost:8001").replace(/\/$/, "");
const API_KEY = process.env.AGENT_BOARD_API_KEY || "";
const AGENT_NAME = process.env.AGENT_BOARD_AGENT_NAME || "";

// Resolved at startup
let agentId = null;
let agentRecord = null;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Make an authenticated request to the Agent Board API.
 * Returns { ok, status, data } — never throws on HTTP errors.
 */
async function apiFetch(path, options = {}) {
  const url = `${BOARD_URL}/api/v1${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { detail: err.message } };
  }
}

function apiPost(path, body) {
  return apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function apiGet(path) {
  return apiFetch(path, { method: "GET" });
}

function apiPut(path, body) {
  return apiFetch(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Response formatting
// ---------------------------------------------------------------------------

/** Wrap API result into an MCP tool response text block. */
function toToolResult(result, successLabel) {
  if (!result.ok) {
    const detail =
      typeof result.data === "object"
        ? result.data.detail || JSON.stringify(result.data)
        : result.data;
    return {
      content: [
        {
          type: "text",
          text: `Error ${result.status}: ${detail}`,
        },
      ],
      isError: true,
    };
  }

  const body =
    typeof result.data === "object"
      ? JSON.stringify(result.data, null, 2)
      : result.data;

  return {
    content: [
      {
        type: "text",
        text: successLabel ? `${successLabel}\n\n${body}` : body,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Agent ID resolution
// ---------------------------------------------------------------------------

/**
 * Look up the agent by name slug and cache the ID for the session lifetime.
 * Called once at startup and falls back to a lazy lookup on first tool use.
 */
async function resolveAgent() {
  if (!AGENT_NAME) return;

  const result = await apiGet(`/agents/?per_page=200`);
  if (!result.ok) {
    process.stderr.write(
      `[agent-board-mcp] Warning: could not resolve agent name '${AGENT_NAME}': ${result.status}\n`
    );
    return;
  }

  const agents = result.data.data || [];
  const match = agents.find(
    (a) =>
      a.name === AGENT_NAME ||
      a.display_name?.toLowerCase() === AGENT_NAME.toLowerCase()
  );

  if (match) {
    agentId = match.id;
    agentRecord = match;
    process.stderr.write(
      `[agent-board-mcp] Resolved agent '${AGENT_NAME}' => id=${agentId}\n`
    );
  } else {
    process.stderr.write(
      `[agent-board-mcp] Warning: agent '${AGENT_NAME}' not found in registry\n`
    );
  }
}

/**
 * Resolve project_id from a project name or numeric string.
 * Returns null if not found.
 */
async function resolveProjectId(project) {
  if (!project) return null;

  // If it's already a number
  if (/^\d+$/.test(String(project))) return parseInt(project, 10);

  const result = await apiGet("/projects/");
  if (!result.ok) return null;

  const projects = result.data.data || [];
  const match = projects.find(
    (p) =>
      p.name?.toLowerCase() === String(project).toLowerCase() ||
      p.slug?.toLowerCase() === String(project).toLowerCase()
  );

  return match ? match.id : null;
}

/**
 * Resolve agent_id from a name slug.
 * Returns null if not found.
 */
async function resolveAgentId(name) {
  if (!name) return null;
  if (/^\d+$/.test(String(name))) return parseInt(name, 10);

  const result = await apiGet("/agents/?per_page=200");
  if (!result.ok) return null;

  const agents = result.data.data || [];
  const match = agents.find(
    (a) =>
      a.name === name ||
      a.display_name?.toLowerCase() === name.toLowerCase()
  );

  return match ? match.id : null;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "agent_board_create_ticket",
    description:
      "Create a new ticket on the Agent Board. Requires a project name or ID. " +
      "Returns the created ticket with its ID.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short, descriptive title for the ticket",
        },
        project: {
          type: "string",
          description: "Project name, slug, or numeric ID",
        },
        priority: {
          type: "string",
          enum: ["p0", "p1", "p2", "p3"],
          description: "p0=critical, p1=high, p2=medium (default), p3=low",
          default: "p2",
        },
        description: {
          type: "string",
          description: "Detailed description of the work",
        },
        assignee: {
          type: "string",
          description: "Agent name slug or numeric ID to assign the ticket to",
        },
      },
      required: ["title", "project"],
    },
  },
  {
    name: "agent_board_update_ticket",
    description:
      "Update a ticket's status using the appropriate lifecycle endpoint. " +
      "Valid statuses: todo, in_progress, review, done, blocked, cancelled.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "Numeric ticket ID",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "review", "done", "blocked", "cancelled"],
          description: "Target status for the ticket",
        },
      },
      required: ["ticket_id", "status"],
    },
  },
  {
    name: "agent_board_comment",
    description: "Add a comment to an existing ticket.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "Numeric ticket ID",
        },
        body: {
          type: "string",
          description: "Comment text (markdown supported)",
        },
      },
      required: ["ticket_id", "body"],
    },
  },
  {
    name: "agent_board_block_ticket",
    description:
      "Mark a ticket as blocked. Records the blocking reason and optionally " +
      "which agent is causing the block.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "Numeric ticket ID",
        },
        reason: {
          type: "string",
          description: "Why the ticket is blocked",
        },
        blocked_by_agent: {
          type: "string",
          description: "Name or ID of the agent causing the block (optional)",
        },
      },
      required: ["ticket_id", "reason"],
    },
  },
  {
    name: "agent_board_done_ticket",
    description:
      "Mark a ticket as done. Requires a completion summary explaining what was accomplished.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "Numeric ticket ID",
        },
        summary: {
          type: "string",
          description: "What was accomplished — shown in the done record",
        },
      },
      required: ["ticket_id", "summary"],
    },
  },
  {
    name: "agent_board_submit_standup",
    description:
      "Submit a daily standup entry for the current agent. " +
      "Upserts on (agent, project, date) so calling twice just updates.",
    inputSchema: {
      type: "object",
      properties: {
        yesterday: {
          type: "string",
          description: "What was completed yesterday",
        },
        today: {
          type: "string",
          description: "What will be worked on today",
        },
        blockers: {
          type: "string",
          description: "Any blockers (optional)",
        },
        project: {
          type: "string",
          description: "Project name, slug, or numeric ID (optional)",
        },
      },
      required: ["yesterday", "today"],
    },
  },
  {
    name: "agent_board_get_my_tickets",
    description:
      "Get all tickets assigned to the current agent (or any agent by name/ID). " +
      "Returns paginated list with status, priority, and project info.",
    inputSchema: {
      type: "object",
      properties: {
        assignee: {
          type: "string",
          description:
            "Agent name or numeric ID to fetch tickets for. " +
            "Defaults to the current agent set via AGENT_BOARD_AGENT_NAME.",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "review", "done", "blocked", "cancelled"],
          description: "Filter by status (optional)",
        },
      },
    },
  },
  {
    name: "agent_board_get_dashboard",
    description:
      "Fetch the CEO-level dashboard showing full system state: " +
      "agent counts, ticket counts by status/priority, active blockers, " +
      "recent activity, team workload, and project summaries.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "agent_board_assign_ticket",
    description: "Assign a ticket to a specific agent.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "Numeric ticket ID",
        },
        agent_name: {
          type: "string",
          description: "Agent name slug or numeric ID",
        },
      },
      required: ["ticket_id", "agent_name"],
    },
  },
  {
    name: "agent_board_request_review",
    description:
      "Request a code/work review from another agent. " +
      "Moves the ticket to 'review' status and posts a comment tagging the reviewer.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_id: {
          type: "number",
          description: "Numeric ticket ID",
        },
        reviewer_agent: {
          type: "string",
          description: "Name or ID of the agent being asked to review",
        },
        message: {
          type: "string",
          description: "Optional message to the reviewer",
        },
      },
      required: ["ticket_id", "reviewer_agent"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleCreateTicket(args) {
  const { title, project, priority = "p2", description, assignee } = args;

  const projectId = await resolveProjectId(project);
  if (projectId === null) {
    return {
      content: [{ type: "text", text: `Error: project '${project}' not found` }],
      isError: true,
    };
  }

  const body = {
    title,
    project_id: projectId,
    priority,
    ...(description ? { description } : {}),
    ...(agentId ? { reporter_id: agentId } : {}),
  };

  if (assignee) {
    const assigneeId = await resolveAgentId(assignee);
    if (assigneeId !== null) body.assignee_id = assigneeId;
  }

  const result = await apiPost("/tickets/", body);
  return toToolResult(result, `Ticket created.`);
}

async function handleUpdateTicket(args) {
  const { ticket_id, status } = args;

  // Map status to lifecycle endpoint
  const endpointMap = {
    in_progress: "start",
    blocked: "block",
    review: "review",
    done: "done",
    todo: null,      // no dedicated endpoint — fall through to note
    cancelled: null, // no dedicated endpoint
  };

  const endpoint = endpointMap[status];

  if (status === "todo" || status === "cancelled") {
    // These don't have lifecycle endpoints; use the bulk/status approach
    const result = await apiPost("/tickets/bulk/status", {
      ticket_ids: [ticket_id],
      status,
    });
    return toToolResult(result, `Ticket #${ticket_id} status updated to '${status}'.`);
  }

  if (endpoint === "block") {
    // Block needs a reason — nudge caller to use agent_board_block_ticket
    return {
      content: [
        {
          type: "text",
          text: "To block a ticket use the agent_board_block_ticket tool — it requires a reason.",
        },
      ],
      isError: true,
    };
  }

  if (endpoint === "done") {
    // Done needs a summary — nudge caller to use agent_board_done_ticket
    return {
      content: [
        {
          type: "text",
          text: "To complete a ticket use the agent_board_done_ticket tool — it requires a summary.",
        },
      ],
      isError: true,
    };
  }

  const result = await apiPost(`/tickets/${ticket_id}/${endpoint}`, {});
  return toToolResult(result, `Ticket #${ticket_id} moved to '${status}'.`);
}

async function handleComment(args) {
  const { ticket_id, body } = args;

  if (!agentId) {
    return {
      content: [
        {
          type: "text",
          text: "Error: AGENT_BOARD_AGENT_NAME not set or agent not found. " +
                "Cannot determine author_id for comment.",
        },
      ],
      isError: true,
    };
  }

  const result = await apiPost(`/tickets/${ticket_id}/comments`, {
    body,
    author_id: agentId,
  });
  return toToolResult(result, `Comment added to ticket #${ticket_id}.`);
}

async function handleBlockTicket(args) {
  const { ticket_id, reason, blocked_by_agent } = args;

  const blockBody = { reason };

  if (blocked_by_agent) {
    const blockerId = await resolveAgentId(blocked_by_agent);
    if (blockerId !== null) blockBody.blocked_by_agent_id = blockerId;
  }

  const result = await apiPost(`/tickets/${ticket_id}/block`, blockBody);
  return toToolResult(result, `Ticket #${ticket_id} marked as blocked.`);
}

async function handleDoneTicket(args) {
  const { ticket_id, summary } = args;

  // The /done endpoint accepts close_summary as a query param
  const path = `/tickets/${ticket_id}/done?close_summary=${encodeURIComponent(summary)}`;
  const result = await apiPost(path, {});
  return toToolResult(result, `Ticket #${ticket_id} marked as done.`);
}

async function handleSubmitStandup(args) {
  const { yesterday, today, blockers, project } = args;

  if (!agentId) {
    return {
      content: [
        {
          type: "text",
          text: "Error: AGENT_BOARD_AGENT_NAME not set or agent not resolved. " +
                "Set AGENT_BOARD_AGENT_NAME to the agent's name slug.",
        },
      ],
      isError: true,
    };
  }

  const body = {
    agent_id: agentId,
    yesterday,
    today,
    ...(blockers ? { blockers } : {}),
  };

  if (project) {
    const projectId = await resolveProjectId(project);
    if (projectId !== null) body.project_id = projectId;
  }

  const result = await apiPost("/standups/", body);
  return toToolResult(result, "Standup submitted.");
}

async function handleGetMyTickets(args) {
  const { assignee, status: filterStatus } = args || {};

  let targetId = agentId;

  if (assignee) {
    targetId = await resolveAgentId(assignee);
    if (targetId === null) {
      return {
        content: [{ type: "text", text: `Error: agent '${assignee}' not found` }],
        isError: true,
      };
    }
  }

  if (targetId === null) {
    return {
      content: [
        {
          type: "text",
          text: "Error: no assignee specified and AGENT_BOARD_AGENT_NAME not set.",
        },
      ],
      isError: true,
    };
  }

  let path = `/tickets/?assignee_id=${targetId}&per_page=100`;
  if (filterStatus) path += `&status=${filterStatus}`;

  const result = await apiGet(path);
  if (!result.ok) return toToolResult(result);

  const tickets = result.data.data || [];
  const pagination = result.data.pagination || {};

  if (tickets.length === 0) {
    return {
      content: [{ type: "text", text: "No tickets found." }],
    };
  }

  // Format a compact summary table then append full JSON
  const lines = [
    `Found ${tickets.length} ticket(s) (total: ${pagination.total ?? tickets.length})\n`,
    "ID   | Priority | Status      | Project              | Title",
    "-----|----------|-------------|----------------------|" + "-".repeat(40),
  ];

  for (const t of tickets) {
    const id = String(t.id).padEnd(4);
    const pri = (t.priority || "").padEnd(8);
    const st = (t.status || "").padEnd(11);
    const proj = (t.project_name || `#${t.project_id}`).substring(0, 20).padEnd(20);
    lines.push(`${id} | ${pri} | ${st} | ${proj} | ${t.title}`);
  }

  lines.push("\n--- Full data ---\n");
  lines.push(JSON.stringify(tickets, null, 2));

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleGetDashboard() {
  const result = await apiGet("/dashboard/");
  return toToolResult(result, "Agent Board Dashboard");
}

async function handleAssignTicket(args) {
  const { ticket_id, agent_name } = args;

  const targetAgentId = await resolveAgentId(agent_name);
  if (targetAgentId === null) {
    return {
      content: [{ type: "text", text: `Error: agent '${agent_name}' not found` }],
      isError: true,
    };
  }

  const result = await apiPut(`/tickets/${ticket_id}`, {
    assignee_id: targetAgentId,
  });
  return toToolResult(result, `Ticket #${ticket_id} assigned to '${agent_name}'.`);
}

async function handleRequestReview(args) {
  const { ticket_id, reviewer_agent, message } = args;

  // Step 1: Move ticket to review status
  const reviewResult = await apiPost(`/tickets/${ticket_id}/review`, {});
  if (!reviewResult.ok) {
    return toToolResult(reviewResult, null);
  }

  // Step 2: Post a comment tagging the reviewer
  if (!agentId) {
    // Still succeed on status change; warn about missing comment author
    return {
      content: [
        {
          type: "text",
          text:
            `Ticket #${ticket_id} moved to review.\n` +
            `Warning: AGENT_BOARD_AGENT_NAME not set, could not post reviewer comment.\n\n` +
            JSON.stringify(reviewResult.data, null, 2),
        },
      ],
    };
  }

  const commentBody =
    `@${reviewer_agent} — review requested.` +
    (message ? `\n\n${message}` : "");

  const commentResult = await apiPost(`/tickets/${ticket_id}/comments`, {
    body: commentBody,
    author_id: agentId,
  });

  if (!commentResult.ok) {
    return {
      content: [
        {
          type: "text",
          text:
            `Ticket #${ticket_id} moved to review.\n` +
            `Warning: could not post reviewer comment — ${commentResult.status}: ` +
            `${commentResult.data?.detail || commentResult.data}\n\n` +
            JSON.stringify(reviewResult.data, null, 2),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text:
          `Ticket #${ticket_id} moved to review. Comment posted tagging @${reviewer_agent}.\n\n` +
          JSON.stringify(reviewResult.data, null, 2),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

const HANDLERS = {
  agent_board_create_ticket: handleCreateTicket,
  agent_board_update_ticket: handleUpdateTicket,
  agent_board_comment: handleComment,
  agent_board_block_ticket: handleBlockTicket,
  agent_board_done_ticket: handleDoneTicket,
  agent_board_submit_standup: handleSubmitStandup,
  agent_board_get_my_tickets: handleGetMyTickets,
  agent_board_get_dashboard: handleGetDashboard,
  agent_board_assign_ticket: handleAssignTicket,
  agent_board_request_review: handleRequestReview,
};

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  {
    name: "agent-board-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = HANDLERS[name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    return await handler(args || {});
  } catch (err) {
    // Never crash the MCP server — surface the error as a tool response
    return {
      content: [
        {
          type: "text",
          text: `Unexpected error in ${name}: ${err.message}\n${err.stack || ""}`,
        },
      ],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  // Validate required env vars
  if (!API_KEY) {
    process.stderr.write(
      "[agent-board-mcp] Warning: AGENT_BOARD_API_KEY not set. " +
        "Authenticated endpoints will fail.\n"
    );
  }

  // Resolve agent identity from the registry
  if (AGENT_NAME) {
    await resolveAgent();
  } else {
    process.stderr.write(
      "[agent-board-mcp] Warning: AGENT_BOARD_AGENT_NAME not set. " +
        "Tools that require an agent ID (comments, standup) will fail.\n"
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[agent-board-mcp] Server running. Board: ${BOARD_URL} | ` +
      `Agent: ${AGENT_NAME || "(none)"} (id=${agentId ?? "unresolved"})\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[agent-board-mcp] Fatal: ${err.message}\n`);
  process.exit(1);
});
