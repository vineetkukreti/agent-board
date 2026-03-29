import { formatDistanceToNow } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Users, Ticket, AlertTriangle, Activity, Bot, Clock,
  CheckCircle2, Circle, XCircle, Pause,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  active:  { dot: 'var(--success)',  label: 'Active' },
  idle:    { dot: 'var(--text-secondary)', label: 'Idle' },
  blocked: { dot: 'var(--warning)',  label: 'Blocked' },
  offline: { dot: 'var(--danger)',   label: 'Offline' },
}

const TICKET_STATUS_COLORS = {
  todo:        '#64748b',
  in_progress: 'var(--accent)',
  review:      'var(--warning)',
  done:        'var(--success)',
  blocked:     'var(--danger)',
  cancelled:   '#374151',
}

const PRIORITY_COLORS = {
  p0: 'var(--danger)',
  p1: 'var(--warning)',
  p2: 'var(--accent)',
  p3: '#6b7280',
}

const EVENT_ICONS = {
  'ticket.created':          <Ticket size={14} />,
  'ticket.in_progress':      <Circle size={14} />,
  'ticket.review':           <Pause size={14} />,
  'ticket.done':             <CheckCircle2 size={14} />,
  'ticket.blocked':          <AlertTriangle size={14} />,
  'ticket.commented':        <Activity size={14} />,
  'agent.created':           <Bot size={14} />,
  'agent.updated':           <Bot size={14} />,
  'sprint.activated':        <Activity size={14} />,
  'sprint.completed':        <CheckCircle2 size={14} />,
  'project.created':         <Ticket size={14} />,
  'standup.submitted':       <Clock size={14} />,
}

function eventIcon(type) {
  return EVENT_ICONS[type] ?? <Activity size={14} />
}

function safeDistance(dateStr) {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return '—'
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4 border flex items-center gap-4"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}22` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
          {value ?? '—'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-4 border animate-pulse"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="h-4 w-1/2 rounded mb-2" style={{ backgroundColor: 'var(--bg-hover)' }} />
      <div className="h-8 w-1/3 rounded" style={{ backgroundColor: 'var(--bg-hover)' }} />
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs border shadow-lg"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }}>{p.value} tickets</p>
      ))}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard()

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          Failed to load dashboard. Check server connection.
        </p>
      </div>
    )
  }

  const agents = data?.agents ?? {}
  const tickets = data?.tickets ?? {}
  const blockers = data?.blockers ?? {}
  const recentActivity = data?.recent_activity ?? []
  const teamWorkload = data?.team_workload ?? []

  const ticketStatusData = [
    { name: 'Todo',        value: tickets.by_status?.todo ?? 0 },
    { name: 'In Progress', value: tickets.by_status?.in_progress ?? 0 },
    { name: 'Review',      value: tickets.by_status?.review ?? 0 },
    { name: 'Done',        value: tickets.by_status?.done ?? 0 },
    { name: 'Blocked',     value: tickets.by_status?.blocked ?? 0 },
  ]

  const ticketPriorityData = [
    { name: 'P0 Critical', value: tickets.by_priority?.p0 ?? 0 },
    { name: 'P1 High',     value: tickets.by_priority?.p1 ?? 0 },
    { name: 'P2 Medium',   value: tickets.by_priority?.p2 ?? 0 },
    { name: 'P3 Low',      value: tickets.by_priority?.p3 ?? 0 },
  ]

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          System Overview
        </h1>
        {data && (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Auto-refreshes every 30s
          </span>
        )}
      </div>

      {/* Row 1 — Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              icon={<Users size={20} />}
              label="Active Agents"
              value={agents.by_status?.active ?? 0}
              color="var(--success)"
            />
            <StatCard
              icon={<Circle size={20} />}
              label="Idle Agents"
              value={agents.by_status?.idle ?? 0}
              color="var(--text-secondary)"
            />
            <StatCard
              icon={<AlertTriangle size={20} />}
              label="Blocked Agents"
              value={agents.by_status?.blocked ?? 0}
              color="var(--warning)"
            />
            <StatCard
              icon={<XCircle size={20} />}
              label="Offline Agents"
              value={agents.by_status?.offline ?? 0}
              color="var(--danger)"
            />
          </>
        )}
      </div>

      {/* Row 2 — Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ticket status chart */}
        <div className="rounded-xl p-4 border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
            Tickets by Status
          </h2>
          {isLoading ? (
            <div className="h-40 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ticketStatusData} barCategoryGap="30%">
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {ticketStatusData.map((entry, i) => {
                    const keyMap = {
                      'Todo': TICKET_STATUS_COLORS.todo,
                      'In Progress': TICKET_STATUS_COLORS.in_progress,
                      'Review': TICKET_STATUS_COLORS.review,
                      'Done': TICKET_STATUS_COLORS.done,
                      'Blocked': TICKET_STATUS_COLORS.blocked,
                    }
                    return <Cell key={i} fill={keyMap[entry.name] ?? '#64748b'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ticket priority chart */}
        <div className="rounded-xl p-4 border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
            Tickets by Priority
          </h2>
          {isLoading ? (
            <div className="h-40 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-hover)' }} />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ticketPriorityData} barCategoryGap="30%">
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={24}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {ticketPriorityData.map((entry, i) => {
                    const colorMap = {
                      'P0 Critical': PRIORITY_COLORS.p0,
                      'P1 High':     PRIORITY_COLORS.p1,
                      'P2 Medium':   PRIORITY_COLORS.p2,
                      'P3 Low':      PRIORITY_COLORS.p3,
                    }
                    return <Cell key={i} fill={colorMap[entry.name] ?? '#6b7280'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3 — Blockers + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active blockers */}
        <div className="rounded-xl border flex flex-col"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b"
            style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Active Blockers
            </h2>
            {!isLoading && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                {blockers.total_active ?? 0}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-64">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 rounded animate-pulse"
                    style={{ backgroundColor: 'var(--bg-hover)' }} />
                ))}
              </div>
            ) : blockers.items?.length > 0 ? (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {blockers.items.map((b) => (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {b.ticket_title ?? `Ticket #${b.ticket_id}`}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--danger)' }}>
                          {b.reason}
                        </p>
                        {b.assignee_name && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Assigned to {b.assignee_name}
                          </p>
                        )}
                      </div>
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {safeDistance(b.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center justify-center h-full py-12">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No active blockers
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border flex flex-col"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-4 pt-4 pb-3 border-b"
            style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Recent Activity
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-64">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded animate-pulse"
                    style={{ backgroundColor: 'var(--bg-hover)' }} />
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {recentActivity.map((event) => (
                  <li key={event.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      {eventIcon(event.event_type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {event.summary ?? event.event_type}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {event.agent_name ? `by ${event.agent_name} · ` : ''}{safeDistance(event.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No activity yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4 — Team workload */}
      <div className="rounded-xl border"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="px-4 pt-4 pb-3 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Team Workload
          </h2>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded animate-pulse"
                style={{ backgroundColor: 'var(--bg-hover)' }} />
            ))}
          </div>
        ) : teamWorkload.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  {['Team', 'Members', 'In Progress', 'Review', 'Blocked', 'Open Total'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {teamWorkload.map((t) => (
                  <tr key={t.team_id} className="transition-colors"
                    style={{ ':hover': { backgroundColor: 'var(--bg-hover)' } }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      <div className="flex items-center gap-2">
                        {t.color && (
                          <span className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }} />
                        )}
                        {t.team_name}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {t.member_count}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: 'var(--accent)' }}>
                        {t.in_progress}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}>
                        {t.review}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                        {t.blocked}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t.open}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No teams yet
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
