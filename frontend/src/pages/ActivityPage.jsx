import { useSearchParams } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  Activity, Ticket, Bot, CheckCircle2, AlertTriangle,
  MessageSquare, Zap, Folder, Clock, ChevronDown,
} from 'lucide-react'
import { useActivity } from '../hooks/useActivity'
import { useAgents } from '../hooks/useAgents'
import { useProjects } from '../hooks/useProjects'

// ─── helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Events' },
  { value: 'ticket.created',         label: 'Ticket Created' },
  { value: 'ticket.in_progress',     label: 'Ticket Started' },
  { value: 'ticket.review',          label: 'Ticket Review' },
  { value: 'ticket.done',            label: 'Ticket Done' },
  { value: 'ticket.blocked',         label: 'Ticket Blocked' },
  { value: 'ticket.commented',       label: 'Comment Added' },
  { value: 'ticket.blocker_added',   label: 'Blocker Added' },
  { value: 'ticket.blocker_resolved', label: 'Blocker Resolved' },
  { value: 'agent.created',          label: 'Agent Registered' },
  { value: 'agent.updated',          label: 'Agent Updated' },
  { value: 'sprint.activated',       label: 'Sprint Activated' },
  { value: 'sprint.completed',       label: 'Sprint Completed' },
  { value: 'sprint.created',         label: 'Sprint Created' },
  { value: 'project.created',        label: 'Project Created' },
  { value: 'project.updated',        label: 'Project Updated' },
  { value: 'standup.submitted',      label: 'Standup Submitted' },
]

const EVENT_ICON_MAP = {
  'ticket.created':          { icon: Ticket,        color: 'var(--text-secondary)' },
  'ticket.in_progress':      { icon: Activity,      color: 'var(--accent)' },
  'ticket.review':           { icon: Clock,         color: 'var(--warning)' },
  'ticket.done':             { icon: CheckCircle2,  color: 'var(--success)' },
  'ticket.blocked':          { icon: AlertTriangle, color: 'var(--danger)' },
  'ticket.commented':        { icon: MessageSquare, color: 'var(--text-secondary)' },
  'ticket.blocker_added':    { icon: AlertTriangle, color: 'var(--danger)' },
  'ticket.blocker_resolved': { icon: CheckCircle2,  color: 'var(--success)' },
  'ticket.updated':          { icon: Ticket,        color: 'var(--text-secondary)' },
  'agent.created':           { icon: Bot,           color: 'var(--accent)' },
  'agent.updated':           { icon: Bot,           color: 'var(--text-secondary)' },
  'sprint.activated':        { icon: Zap,           color: 'var(--success)' },
  'sprint.completed':        { icon: CheckCircle2,  color: 'var(--accent)' },
  'sprint.created':          { icon: Zap,           color: 'var(--text-secondary)' },
  'project.created':         { icon: Folder,        color: 'var(--accent)' },
  'project.updated':         { icon: Folder,        color: 'var(--text-secondary)' },
  'standup.submitted':       { icon: MessageSquare, color: 'var(--success)' },
}

function getEventMeta(eventType) {
  return EVENT_ICON_MAP[eventType] ?? { icon: Activity, color: 'var(--text-secondary)' }
}

function safeDistance(dateStr) {
  if (!dateStr) return '—'
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) } catch { return '—' }
}

// ─── Activity Event Row ───────────────────────────────────────────────────────

function EventRow({ event, isLast }) {
  const { icon: Icon, color } = getEventMeta(event.event_type)

  return (
    <li className="flex items-start gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
        >
          <Icon size={13} style={{ color }} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-1" style={{ backgroundColor: 'var(--border)', minHeight: '24px' }} />
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {event.summary ?? event.event_type}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {event.agent_name && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  by {event.agent_name}
                </span>
              )}
              {event.project_name && (
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {event.project_name}
                </span>
              )}
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {event.event_type}
              </span>
            </div>
          </div>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
            {safeDistance(event.created_at)}
          </span>
        </div>
      </div>
    </li>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1)
  const filters = {
    project_id: searchParams.get('project_id') ?? '',
    agent_id: searchParams.get('agent_id') ?? '',
    event_type: searchParams.get('event_type') ?? '',
  }

  const { data: agentData } = useAgents({ per_page: 200 })
  const { data: projectData } = useProjects()

  const activeParams = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '')
  )

  const { data, isLoading, isFetching } = useActivity({
    ...activeParams,
    page,
    per_page: 30,
  })

  const events = data?.data ?? []
  const pagination = data?.pagination ?? {}

  function setFilter(k, v) {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (v) p.set(k, v); else p.delete(k)
      p.delete('page')
      return p
    })
  }

  function setPage(pageOrFn) {
    const next = typeof pageOrFn === 'function' ? pageOrFn(page) : pageOrFn
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (next > 1) p.set('page', String(next)); else p.delete('page')
      return p
    })
  }

  const agents = agentData?.data ?? []
  const projects = projectData?.data ?? []

  const selectStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Activity Feed
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {pagination.total != null ? `${pagination.total} events` : '...'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.project_id}
          onChange={(e) => setFilter('project_id', e.target.value)}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={filters.agent_id}
          onChange={(e) => setFilter('agent_id', e.target.value)}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.display_name}</option>
          ))}
        </select>

        <select
          value={filters.event_type}
          onChange={(e) => setFilter('event_type', e.target.value)}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          {EVENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {Object.values(filters).some(Boolean) && (
          <button
            onClick={() => setSearchParams({})}
            className="text-xs px-2.5 py-1.5 rounded-md"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {isLoading ? (
          <ul className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full animate-pulse shrink-0"
                  style={{ backgroundColor: 'var(--bg-hover)' }} />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-3/4 rounded animate-pulse"
                    style={{ backgroundColor: 'var(--bg-hover)' }} />
                  <div className="h-3 w-1/2 rounded animate-pulse"
                    style={{ backgroundColor: 'var(--bg-hover)' }} />
                </div>
              </li>
            ))}
          </ul>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Activity size={36} style={{ color: 'var(--text-secondary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No activity found
            </p>
          </div>
        ) : (
          <>
            <ul>
              {events.map((event, idx) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isLast={idx === events.length - 1 && page >= pagination.pages}
                />
              ))}
            </ul>

            {/* Load more */}
            {page < (pagination.pages ?? 1) && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isFetching}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <ChevronDown size={14} />
                  {isFetching ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}

            {page >= (pagination.pages ?? 1) && events.length > 0 && (
              <p className="text-center text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
                All {pagination.total} events loaded
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
