import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, differenceInCalendarDays } from 'date-fns'
import {
  Zap, Plus, X, Play, CheckCircle, Calendar, Clock, Users,
  Ticket, BarChart3, Target, AlertTriangle, Circle, Pause, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import {
  useSprints,
  useSprint,
  useSprintBoard,
  useSprintBurndown,
  useCreateSprint,
  useActivateSprint,
  useCompleteSprint,
  useBulkDeleteSprints,
} from '../hooks/useSprints'
import { useProjects } from '../hooks/useProjects'

// ─── helpers ──────────────────────────────────────────────────────────────────

const SPRINT_STATUS = {
  planning:  { color: 'var(--text-secondary)', label: 'Planning',  bg: 'rgba(148,163,184,0.15)' },
  active:    { color: 'var(--success)',        label: 'Active',    bg: 'rgba(16,185,129,0.15)' },
  completed: { color: 'var(--accent)',         label: 'Completed', bg: 'rgba(59,130,246,0.15)' },
  cancelled: { color: 'var(--danger)',         label: 'Cancelled', bg: 'rgba(239,68,68,0.15)' },
}

function safeFormat(dateStr) {
  if (!dateStr) return '—'
  try { return format(new Date(dateStr), 'MMM d, yyyy') } catch { return '—' }
}

// ─── Sprint Card ──────────────────────────────────────────────────────────────

function SprintCard({ sprint, onActivate, onComplete, onClick, selected, onToggleSelect }) {
  const ss = SPRINT_STATUS[sprint.status] ?? SPRINT_STATUS.planning
  const isActive = sprint.status === 'active'
  const isPlanning = sprint.status === 'planning'

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-center pt-1 shrink-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(sprint.id) }}
          className="w-4 h-4 rounded cursor-pointer accent-[var(--accent)]"
        />
      </div>
      <div
        onClick={() => onClick(sprint)}
        className="rounded-xl border p-4 transition-all cursor-pointer hover:border-[var(--accent)] flex-1 min-w-0"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: isActive ? 'var(--success)' : 'var(--border)',
          boxShadow: isActive ? '0 0 0 1px rgba(16,185,129,0.3)' : undefined,
        }}
      >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {sprint.name}
            </h3>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: ss.bg, color: ss.color }}>
              {ss.label}
            </span>
          </div>
          {sprint.project_name && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {sprint.project_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPlanning && (
            <button
              onClick={(e) => { e.stopPropagation(); onActivate(sprint.id) }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                color: 'var(--success)',
              }}
            >
              <Play size={11} />
              Activate
            </button>
          )}
          {isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); onComplete(sprint.id) }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(59,130,246,0.15)',
                color: 'var(--accent)',
              }}
            >
              <CheckCircle size={11} />
              Complete
            </button>
          )}
        </div>
      </div>

      {sprint.goal && (
        <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
          {sprint.goal}
        </p>
      )}

      <div className="flex items-center justify-between text-xs"
        style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          <span>
            {sprint.start_date ? safeFormat(sprint.start_date) : '—'}
            {' → '}
            {sprint.end_date ? safeFormat(sprint.end_date) : '—'}
          </span>
        </div>
        <span>{sprint.ticket_count ?? 0} ticket{sprint.ticket_count !== 1 ? 's' : ''}</span>
      </div>
      </div>
    </div>
  )
}

// ─── Sprint Detail Modal ──────────────────────────────────────────────────────

const STATUS_ICONS = {
  todo: <Circle size={12} />,
  in_progress: <Play size={12} />,
  review: <Pause size={12} />,
  done: <CheckCircle size={12} />,
  blocked: <AlertTriangle size={12} />,
  cancelled: <X size={12} />,
}

const STATUS_COLORS = {
  todo: '#64748b',
  in_progress: 'var(--accent)',
  review: 'var(--warning)',
  done: 'var(--success)',
  blocked: 'var(--danger)',
  cancelled: '#374151',
}

const BurndownTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs border shadow-lg"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {Math.round(p.value)}</p>
      ))}
    </div>
  )
}

function SprintDetailModal({ sprintId, onClose }) {
  const { data: sprint } = useSprint(sprintId)
  const { data: board } = useSprintBoard(sprintId)
  const { data: burndown } = useSprintBurndown(sprintId)

  if (!sprint) return null

  const ss = SPRINT_STATUS[sprint.status] ?? SPRINT_STATUS.planning
  const totalTickets = board?.total ?? sprint.ticket_count ?? 0

  // Calculate stats from board data
  const boardData = board?.board ?? {}
  const doneCount = boardData.done?.length ?? 0
  const inProgressCount = boardData.in_progress?.length ?? 0
  const reviewCount = boardData.review?.length ?? 0
  const todoCount = boardData.todo?.length ?? 0
  const blockedCount = boardData.blocked?.length ?? 0
  const progressPct = totalTickets > 0 ? Math.round((doneCount / totalTickets) * 100) : 0

  // Duration
  let daysLeft = null
  let totalDays = null
  if (sprint.start_date && sprint.end_date) {
    try {
      const start = new Date(sprint.start_date)
      const end = new Date(sprint.end_date)
      totalDays = differenceInCalendarDays(end, start)
      daysLeft = differenceInCalendarDays(end, new Date())
    } catch {
      daysLeft = null
      totalDays = null
    }
  }

  // Collect all tickets with assignees for the team section
  const allTickets = Object.values(boardData).flat()
  const agentMap = {}
  allTickets.forEach((t) => {
    const name = t.assignee_name || 'Unassigned'
    if (!agentMap[name]) agentMap[name] = { total: 0, done: 0, in_progress: 0, review: 0, todo: 0, blocked: 0 }
    agentMap[name].total++
    agentMap[name][t.status] = (agentMap[name][t.status] || 0) + 1
  })

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl border-l shadow-2xl overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} style={{ color: ss.color }} />
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: ss.bg, color: ss.color }}>
                  {ss.label}
                </span>
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {sprint.name}
              </h2>
              {sprint.project_name && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {sprint.project_name}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Sprint at a Glance */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              Sprint at a Glance
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Dates</span>
              </div>
              <span style={{ color: 'var(--text-primary)' }}>
                {safeFormat(sprint.start_date)} → {safeFormat(sprint.end_date)}
                {totalDays && <span className="text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>({totalDays} days)</span>}
              </span>

              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Time Left</span>
              </div>
              <span style={{ color: daysLeft !== null && daysLeft <= 3 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} days remaining` : daysLeft === 0 ? 'Ends today!' : 'Overdue') : '—'}
              </span>

              <div className="flex items-center gap-2">
                <Ticket size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Tickets</span>
              </div>
              <span style={{ color: 'var(--text-primary)' }}>
                {totalTickets} total · {doneCount} done
              </span>

              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Team</span>
              </div>
              <span style={{ color: 'var(--text-primary)' }}>
                {Object.keys(agentMap).filter(n => n !== 'Unassigned').length} agents
              </span>
            </div>
          </div>

          {/* Goal */}
          {sprint.goal && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} style={{ color: 'var(--accent)' }} />
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Sprint Goal
                </h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {sprint.goal}
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Progress
              </h3>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{progressPct}%</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? 'var(--success)' : 'var(--accent)' }} />
            </div>
            <div className="flex gap-4 mt-2">
              {[
                { label: 'Done', count: doneCount, color: 'var(--success)' },
                { label: 'In Progress', count: inProgressCount, color: 'var(--accent)' },
                { label: 'Review', count: reviewCount, color: 'var(--warning)' },
                { label: 'Todo', count: todoCount, color: '#64748b' },
                { label: 'Blocked', count: blockedCount, color: 'var(--danger)' },
              ].filter(s => s.count > 0).map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.count} {s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Burndown Chart */}
          {burndown && (burndown.actual?.length > 0 || burndown.ideal?.length > 0) && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
                Burndown
              </h3>
              <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis
                      dataKey="date"
                      data={burndown.ideal?.length > burndown.actual?.length ? burndown.ideal : burndown.actual}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d) => d?.slice(5) || ''}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip content={<BurndownTooltip />} />
                    {burndown.ideal?.length > 0 && (
                      <Line
                        data={burndown.ideal}
                        dataKey="remaining"
                        name="Ideal"
                        stroke="#334155"
                        strokeDasharray="5 5"
                        dot={false}
                        strokeWidth={2}
                      />
                    )}
                    {burndown.actual?.length > 0 && (
                      <Line
                        data={burndown.actual}
                        dataKey="remaining"
                        name="Actual"
                        stroke="#22D3EE"
                        dot={{ r: 3, fill: '#22D3EE' }}
                        strokeWidth={2}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Team Allocation */}
          {Object.keys(agentMap).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
                Team Allocation
              </h3>
              <div className="space-y-2">
                {Object.entries(agentMap).sort((a, b) => b[1].total - a[1].total).map(([name, stats]) => (
                  <div key={name} className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'var(--bg-primary)' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                      {name}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      {stats.total} ticket{stats.total !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {stats.done > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>
                          {stats.done} done
                        </span>
                      )}
                      {stats.in_progress > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: 'var(--accent)' }}>
                          {stats.in_progress} wip
                        </span>
                      )}
                      {stats.blocked > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                          {stats.blocked} blocked
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tickets by Status */}
          {Object.entries(boardData).filter(([, tickets]) => tickets.length > 0).map(([status, tickets]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: STATUS_COLORS[status] || '#64748b' }}>{STATUS_ICONS[status] || <Circle size={12} />}</span>
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  {status.replace('_', ' ')} ({tickets.length})
                </h3>
              </div>
              <div className="space-y-1.5">
                {tickets.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg px-3 py-2 border"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                    <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>#{t.id}</span>
                    <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                      {t.title}
                    </span>
                    {t.assignee_name && (
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {t.assignee_name}
                      </span>
                    )}
                    {t.priority && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                        style={{
                          backgroundColor: (PRIORITY_STYLES[t.priority] || {}).bg || 'var(--bg-hover)',
                          color: (PRIORITY_STYLES[t.priority] || {}).color || 'var(--text-secondary)',
                        }}>
                        {t.priority?.toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

const PRIORITY_STYLES = {
  p0: { label: 'P0', bg: 'rgba(239,68,68,0.2)',   color: 'var(--danger)' },
  p1: { label: 'P1', bg: 'rgba(245,158,11,0.2)',  color: 'var(--warning)' },
  p2: { label: 'P2', bg: 'rgba(59,130,246,0.2)',  color: 'var(--accent)' },
  p3: { label: 'P3', bg: 'rgba(107,114,128,0.2)', color: '#6b7280' },
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateSprintModal({ onClose, projects }) {
  const create = useCreateSprint()
  const [form, setForm] = useState({
    name: '',
    goal: '',
    project_id: projects[0]?.id ?? '',
    start_date: '',
    end_date: '',
  })

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.project_id) return
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        goal: form.goal.trim() || undefined,
        project_id: Number(form.project_id),
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      })
      toast.success('Sprint created')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to create sprint')
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }
  const inputClass = "w-full px-3 py-2 rounded-md text-sm outline-none"

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border shadow-2xl"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              New Sprint
            </h2>
            <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}>
                Sprint Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="Sprint 1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}>
                Project <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                value={form.project_id}
                onChange={(e) => set('project_id', e.target.value)}
                className={inputClass}
                style={inputStyle}
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}>
                Goal
              </label>
              <textarea
                value={form.goal}
                onChange={(e) => set('goal', e.target.value)}
                className={`${inputClass} resize-none`}
                style={inputStyle}
                rows={2}
                placeholder="What should be achieved?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-primary)' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-primary)' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-md text-sm font-medium border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                className="flex-1 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {create.isPending ? 'Creating...' : 'Create Sprint'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SprintsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedSprintId, setSelectedSprintId] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [searchParams, setSearchParams] = useSearchParams()
  const projectFilter = searchParams.get('project_id') ?? ''

  const { data: sprintData, isLoading } = useSprints(
    projectFilter ? { project_id: projectFilter } : {}
  )
  const { data: projectData } = useProjects()

  const activateSprint = useActivateSprint()
  const completeSprint = useCompleteSprint()
  const bulkDelete = useBulkDeleteSprints()

  const sprints = sprintData?.data ?? []
  const projects = projectData?.data ?? []

  async function handleActivate(id) {
    try {
      await activateSprint.mutateAsync(id)
      toast.success('Sprint activated')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to activate')
    }
  }

  async function handleComplete(id) {
    try {
      await completeSprint.mutateAsync(id)
      toast.success('Sprint completed')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to complete')
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    const ids = [...selected]
    const hasActive = sprints.some((s) => ids.includes(s.id) && s.status === 'active')
    if (hasActive) {
      toast.error('Cannot delete active sprints — deselect them first')
      return
    }
    try {
      await bulkDelete.mutateAsync({ sprint_ids: ids })
      toast.success(`Deleted ${ids.length} sprint${ids.length !== 1 ? 's' : ''}`)
      setSelected(new Set())
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to delete sprints')
    }
  }

  // Group by project
  const grouped = {}
  sprints.forEach((s) => {
    const key = s.project_name ?? `Project #${s.project_id}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  })

  // Sort within groups: active first, then planning, then completed
  const statusOrder = { active: 0, planning: 1, completed: 2, cancelled: 3 }
  Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
  )

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Sprints</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {isLoading ? '...' : `${sprints.length} sprint${sprints.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (e.target.value) p.set('project_id', e.target.value); else p.delete('project_id'); return p })}
            className="px-3 py-1.5 rounded-md text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            disabled={projects.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus size={15} />
            New Sprint
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}
          >
            <Trash2 size={13} />
            {bulkDelete.isPending ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={13} />
            Clear
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : sprints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Zap size={40} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {projects.length === 0 ? 'Create a project first, then add sprints' : 'No sprints yet'}
          </p>
          {projects.length > 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm underline"
              style={{ color: 'var(--accent)' }}
            >
              Create the first sprint
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([projectName, projectSprints]) => (
            <div key={projectName}>
              <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                {projectName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectSprints.map((s) => (
                  <SprintCard
                    key={s.id}
                    sprint={s}
                    onActivate={handleActivate}
                    onComplete={handleComplete}
                    onClick={(sp) => setSelectedSprintId(sp.id)}
                    selected={selected.has(s.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSprintModal
          onClose={() => setShowCreate(false)}
          projects={projects}
        />
      )}

      {selectedSprintId && (
        <SprintDetailModal
          sprintId={selectedSprintId}
          onClose={() => setSelectedSprintId(null)}
        />
      )}
    </div>
  )
}
