import { useState } from 'react'
import { Plus, ChevronDown, X, AlertTriangle, User } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  useTickets,
  useCreateTicket,
  useStartTicket,
  useReviewTicket,
  useDoneTicket,
} from '../hooks/useTickets'
import { useProjects } from '../hooks/useProjects'
import { useSprints } from '../hooks/useSprints'
import { useAgents } from '../hooks/useAgents'

// ─── helpers ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'todo',        label: 'To Do',       color: 'var(--text-secondary)' },
  { key: 'in_progress', label: 'In Progress',  color: 'var(--accent)' },
  { key: 'review',      label: 'Review',       color: 'var(--warning)' },
  { key: 'done',        label: 'Done',         color: 'var(--success)' },
]

const PRIORITY_STYLES = {
  p0: { label: 'P0', bg: 'rgba(239,68,68,0.2)',   color: 'var(--danger)' },
  p1: { label: 'P1', bg: 'rgba(245,158,11,0.2)',  color: 'var(--warning)' },
  p2: { label: 'P2', bg: 'rgba(59,130,246,0.2)',  color: 'var(--accent)' },
  p3: { label: 'P3', bg: 'rgba(107,114,128,0.2)', color: '#6b7280' },
}

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.p3
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StatusDropdown({ ticket, onTransition }) {
  const [open, setOpen] = useState(false)

  const TRANSITIONS = {
    todo:        ['in_progress'],
    in_progress: ['review', 'todo'],
    review:      ['done', 'in_progress'],
    done:        [],
    blocked:     ['in_progress'],
    cancelled:   [],
  }

  const options = TRANSITIONS[ticket.status] ?? []
  if (options.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
        style={{
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
        }}
      >
        Move <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-xl min-w-[140px]"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {options.map((s) => (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation()
                  onTransition(ticket, s)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-primary)' }}
              >
                Move to {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TicketCard({ ticket, onClick, onTransition }) {
  return (
    <div
      onClick={() => onClick(ticket)}
      className="rounded-lg border p-3 cursor-pointer transition-colors hover:border-[var(--accent)]"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
          {ticket.title}
        </p>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {ticket.status === 'blocked' && (
            <AlertTriangle size={12} style={{ color: 'var(--danger)' }} className="shrink-0" />
          )}
          {ticket.assignee_name ? (
            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {ticket.assignee_name}
            </span>
          ) : (
            <User size={12} style={{ color: 'var(--text-secondary)' }} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            #{ticket.id}
          </span>
          <StatusDropdown ticket={ticket} onTransition={onTransition} />
        </div>
      </div>
    </div>
  )
}

function TicketDetailModal({ ticket, onClose }) {
  if (!ticket) return null
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l shadow-2xl overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between p-5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0 pr-4">
            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              #{ticket.id} · {ticket.project_name ?? `Project #${ticket.project_id}`}
            </p>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {ticket.title}
            </h2>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs px-2 py-0.5 rounded border"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>
          {ticket.description && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Description
              </p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {ticket.description}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Assignee</p>
              <p style={{ color: 'var(--text-primary)' }}>{ticket.assignee_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Sprint</p>
              <p style={{ color: 'var(--text-primary)' }}>{ticket.sprint_id ? `#${ticket.sprint_id}` : '—'}</p>
            </div>
          </div>
          {ticket.tags && (() => {
            try {
              const tags = JSON.parse(ticket.tags)
              if (tags.length > 0) return (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )
            } catch { return null }
          })()}
        </div>
      </div>
    </>
  )
}

function CreateTicketModal({ onClose, projects, agents }) {
  const createTicket = useCreateTicket()
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'p2',
    project_id: projects[0]?.id ?? '',
    assignee_id: '',
  })

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.project_id) return
    try {
      await createTicket.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        project_id: Number(form.project_id),
        assignee_id: form.assignee_id ? Number(form.assignee_id) : undefined,
      })
      toast.success('Ticket created')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to create ticket')
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-md text-sm outline-none"
  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }
  const labelStyle = { color: 'var(--text-primary)' }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border shadow-2xl"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              New Ticket
            </h2>
            <button onClick={onClose} className="p-1 rounded"
              style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={labelStyle}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="What needs to be done?"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className={clsx(inputClass, 'resize-none')}
                style={inputStyle}
                rows={3}
                placeholder="Optional details..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => set('priority', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="p0">P0 — Critical</option>
                  <option value="p1">P1 — High</option>
                  <option value="p2">P2 — Medium</option>
                  <option value="p3">P3 — Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                  Project
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
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                Assignee
              </label>
              <select
                value={form.assignee_id}
                onChange={(e) => set('assignee_id', e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.display_name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-md text-sm font-medium border transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTicket.isPending || !form.title.trim()}
                className="flex-1 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const [filters, setFilters] = useState({
    project_id: '',
    sprint_id: '',
    assignee_id: '',
    priority: '',
  })
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const ticketParams = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '')
  )

  const { data: ticketData, isLoading } = useTickets(ticketParams)
  const { data: projectData } = useProjects()
  const { data: agentData } = useAgents({ per_page: 200 })
  const { data: sprintData } = useSprints(
    filters.project_id ? { project_id: filters.project_id } : {}
  )

  const startTicket = useStartTicket()
  const reviewTicket = useReviewTicket()
  const doneTicket = useDoneTicket()

  const tickets = ticketData?.data ?? []
  const projects = projectData?.data ?? []
  const agents = agentData?.data ?? []
  const sprints = sprintData?.data ?? []

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  async function handleTransition(ticket, targetStatus) {
    try {
      if (targetStatus === 'in_progress') await startTicket.mutateAsync(ticket.id)
      else if (targetStatus === 'review') await reviewTicket.mutateAsync(ticket.id)
      else if (targetStatus === 'done') await doneTicket.mutateAsync({ id: ticket.id })
      else if (targetStatus === 'todo') {
        // No direct "back to todo" lifecycle endpoint — we update via PUT
        toast('Moving back to Todo is not supported via lifecycle API')
        return
      }
      toast.success(`Moved to ${targetStatus.replace('_', ' ')}`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Transition failed')
    }
  }

  const columnTickets = (status) => tickets.filter((t) => t.status === status)

  const selectStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
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
          value={filters.sprint_id}
          onChange={(e) => setFilter('sprint_id', e.target.value)}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          <option value="">All Sprints</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={filters.assignee_id}
          onChange={(e) => setFilter('assignee_id', e.target.value)}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          <option value="">All Assignees</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.display_name}</option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilter('priority', e.target.value)}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          <option value="">All Priorities</option>
          <option value="p0">P0 — Critical</option>
          <option value="p1">P1 — High</option>
          <option value="p2">P2 — Medium</option>
          <option value="p3">P3 — Low</option>
        </select>

        <div className="ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus size={15} />
            New Ticket
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-4 gap-4 flex-1 overflow-hidden">
        {COLUMNS.map((col) => {
          const colTickets = columnTickets(col.key)
          return (
            <div key={col.key} className="flex flex-col gap-2 min-h-0">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: col.color }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {col.label}
                </span>
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                  }}>
                  {isLoading ? '…' : colTickets.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg animate-pulse"
                      style={{ backgroundColor: 'var(--bg-card)' }} />
                  ))
                ) : colTickets.length === 0 ? (
                  <div className="h-20 rounded-lg border-2 border-dashed flex items-center justify-center"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      No tickets
                    </span>
                  </div>
                ) : (
                  colTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onClick={setSelectedTicket}
                      onTransition={handleTransition}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Ticket detail slide-over */}
      {selectedTicket && (
        <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}

      {/* Create ticket modal */}
      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          projects={projects}
          agents={agents}
        />
      )}
    </div>
  )
}
