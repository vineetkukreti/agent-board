import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { ArrowLeft, Activity, Ticket, CheckCircle2, AlertTriangle, Clock, Bot, User } from 'lucide-react'
import { useAgent } from '../hooks/useAgents'
import { useTickets } from '../hooks/useTickets'
import { useActivity } from '../hooks/useActivity'
import { useStandups } from '../hooks/useStandups'

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:  { color: 'var(--success)',        label: 'Active',  bg: 'rgba(16,185,129,0.15)' },
  idle:    { color: 'var(--text-secondary)', label: 'Idle',    bg: 'rgba(148,163,184,0.15)' },
  blocked: { color: 'var(--warning)',        label: 'Blocked', bg: 'rgba(245,158,11,0.15)' },
  offline: { color: 'var(--danger)',         label: 'Offline', bg: 'rgba(239,68,68,0.15)' },
}

const PRIORITY_STYLES = {
  p0: { label: 'P0', bg: 'rgba(239,68,68,0.2)',   color: 'var(--danger)' },
  p1: { label: 'P1', bg: 'rgba(245,158,11,0.2)',  color: 'var(--warning)' },
  p2: { label: 'P2', bg: 'rgba(59,130,246,0.2)',  color: 'var(--accent)' },
  p3: { label: 'P3', bg: 'rgba(107,114,128,0.2)', color: '#6b7280' },
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function hashColor(str) {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#f97316', '#84cc16',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function safeDistance(dateStr) {
  if (!dateStr) return '—'
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) } catch { return '—' }
}

function safeFormat(dateStr, fmt = 'MMM d, yyyy') {
  if (!dateStr) return '—'
  try { return format(new Date(dateStr), fmt) } catch { return '—' }
}

function StatBadge({ icon, label, value, color }) {
  return (
    <div className="rounded-xl border px-4 py-3 flex items-center gap-3"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function CurrentWork({ agentId }) {
  const { data, isLoading } = useTickets({ assignee_id: agentId, per_page: 50 })
  const tickets = data?.data ?? []
  const active = tickets.filter((t) => !['done', 'cancelled'].includes(t.status))

  if (isLoading) return (
    <div className="space-y-2 pt-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
      ))}
    </div>
  )

  if (active.length === 0) return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active tickets</p>
    </div>
  )

  return (
    <ul className="divide-y pt-2" style={{ borderColor: 'var(--border)' }}>
      {active.map((t) => {
        const ps = PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.p3
        return (
          <li key={t.id} className="py-3 flex items-center gap-3">
            <span className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ backgroundColor: ps.bg, color: ps.color }}>
              {ps.label}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                #{t.id} · {t.status.replace('_', ' ')} · {t.project_name ?? `Project #${t.project_id}`}
              </p>
            </div>
            {t.status === 'blocked' && (
              <AlertTriangle size={14} style={{ color: 'var(--danger)' }} className="shrink-0" />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ActivityTab({ agentId }) {
  const { data, isLoading } = useActivity({ agent_id: agentId, per_page: 30 })
  const events = data?.data ?? []

  if (isLoading) return (
    <div className="space-y-2 pt-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
      ))}
    </div>
  )

  if (events.length === 0) return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No activity yet</p>
    </div>
  )

  return (
    <div className="pt-4 relative">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-4 bottom-0 w-px"
        style={{ backgroundColor: 'var(--border)' }} />
      <ul className="space-y-4">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 z-10"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}>
              <Activity size={13} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {e.summary ?? e.event_type}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {safeDistance(e.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StandupsTab({ agentId }) {
  const { data, isLoading } = useStandups({ agent_id: agentId, per_page: 30 })
  const standups = data?.data ?? []

  if (isLoading) return (
    <div className="space-y-3 pt-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
      ))}
    </div>
  )

  if (standups.length === 0) return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No standups submitted yet</p>
    </div>
  )

  return (
    <ul className="space-y-3 pt-4">
      {standups.map((s) => (
        <li key={s.id} className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {safeFormat(s.date)}
            </span>
            {s.project_name && (
              <span className="text-xs px-1.5 py-0.5 rounded ml-auto"
                style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {s.project_name}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {s.yesterday && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Yesterday
                </p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.yesterday}</p>
              </div>
            )}
            {s.today && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
                  Today
                </p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.today}</p>
              </div>
            )}
            {s.blockers && (
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--danger)' }}>
                  Blockers
                </p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.blockers}</p>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// need Calendar import
import { Calendar } from 'lucide-react'

// ─── main page ────────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('work')

  const { data: agent, isLoading, isError } = useAgent(id)
  const { data: ticketData } = useTickets({ assignee_id: id, per_page: 200 })

  const tickets = ticketData?.data ?? []
  const openCount = tickets.filter((t) => !['done', 'cancelled'].includes(t.status)).length
  const doneCount = tickets.filter((t) => t.status === 'done').length
  const blockedCount = tickets.filter((t) => t.status === 'blocked').length

  const TABS = [
    { key: 'work',     label: 'Current Work' },
    { key: 'activity', label: 'Activity' },
    { key: 'standups', label: 'Standups' },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse pb-8">
        <div className="h-32 rounded-xl" style={{ backgroundColor: 'var(--bg-card)' }} />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl" style={{ backgroundColor: 'var(--bg-card)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !agent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm" style={{ color: 'var(--danger)' }}>Agent not found</p>
        <Link to="/agents" className="text-sm underline" style={{ color: 'var(--accent)' }}>
          Back to agents
        </Link>
      </div>
    )
  }

  const status = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline
  const avatarBg = hashColor(agent.name)

  return (
    <div className="space-y-5 pb-8">
      {/* Back link */}
      <Link to="/agents" className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={15} />
        All Agents
      </Link>

      {/* Header card */}
      <div className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-4">
          {/* Large avatar */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-white text-xl font-bold"
            style={{ backgroundColor: avatarBg }}>
            {agent.is_human ? <User size={28} /> : initials(agent.display_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {agent.display_name}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: status.bg, color: status.color }}>
                {status.label}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              @{agent.name}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {agent.team_name && (
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {agent.team_name}
                </span>
              )}
              {agent.agent_type_name && (
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: 'var(--accent)' }}>
                  {agent.agent_type_name}
                </span>
              )}
              {agent.model && (
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  {agent.model}
                </span>
              )}
              {agent.is_human && (
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  Human
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Last seen</p>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {safeDistance(agent.last_seen_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatBadge
          icon={<Ticket size={18} />}
          label="Open Tickets"
          value={openCount}
          color="var(--accent)"
        />
        <StatBadge
          icon={<CheckCircle2 size={18} />}
          label="Completed"
          value={doneCount}
          color="var(--success)"
        />
        <StatBadge
          icon={<AlertTriangle size={18} />}
          label="Blocked"
          value={blockedCount}
          color="var(--danger)"
        />
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 p-1 rounded-lg w-fit"
          style={{ backgroundColor: 'var(--bg-card)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeTab === tab.key ? 'var(--bg-hover)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {activeTab === 'work' && <CurrentWork agentId={id} />}
          {activeTab === 'activity' && <ActivityTab agentId={id} />}
          {activeTab === 'standups' && <StandupsTab agentId={id} />}
        </div>
      </div>
    </div>
  )
}
