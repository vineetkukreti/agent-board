import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, ChevronDown, X, AlertTriangle, User, GripVertical, Pencil, Trash2, Save, Check, GitPullRequest, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import {
  useTickets,
  useTicket,
  useCreateTicket,
  useUpdateTicket,
  useDeleteTicket,
  useBulkDelete,
  useBulkStatus,
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

const PR_STATUS_COLORS = {
  open:   { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b' },
  merged: { bg: 'rgba(16,185,129,0.2)', color: '#10b981' },
  closed: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444' },
}

function PrBadge({ metadata }) {
  let meta = {}
  try { meta = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {}) } catch { return null }
  if (!meta.pr_url) return null

  const status = meta.pr_status || 'open'
  const colors = PR_STATUS_COLORS[status] || PR_STATUS_COLORS.open

  return (
    <a
      href={meta.pr_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: colors.bg, color: colors.color }}
      title={`PR #${meta.pr_number || ''} — ${status}`}
    >
      <GitPullRequest size={10} />
      {status}
    </a>
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

function TicketCardContent({ ticket, isDragging }) {
  const shortTitle = (ticket.title || '').replace(/^\[.*?\]\s*/, '').slice(0, 80)
  const projectName = ticket.project_name || null

  return (
    <div
      className={clsx(
        'rounded-lg border p-3 transition-colors',
        isDragging ? 'shadow-xl ring-2 ring-[var(--accent)] opacity-90' : 'hover:border-[var(--accent)]'
      )}
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: isDragging ? 'var(--accent)' : 'var(--border)' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <PriorityBadge priority={ticket.priority} />
        {projectName && (
          <span className="text-[10px] px-1.5 py-0.5 rounded truncate max-w-[100px]"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
            {projectName}
          </span>
        )}
        <PrBadge metadata={ticket.metadata} />
      </div>

      <p className="text-sm font-medium leading-snug line-clamp-2 mb-2"
        style={{ color: 'var(--text-primary)' }}>
        {shortTitle}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {ticket.status === 'blocked' && (
            <AlertTriangle size={12} style={{ color: 'var(--danger)' }} className="shrink-0" />
          )}
          {ticket.assignee_name ? (
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                {ticket.assignee_name.charAt(0).toUpperCase()}
              </span>
              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {ticket.assignee_name}
              </span>
            </div>
          ) : (
            <User size={12} style={{ color: 'var(--text-secondary)' }} />
          )}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          #{ticket.id}
        </span>
      </div>
    </div>
  )
}

function DraggableTicketCard({ ticket, onClick, isSelected, onToggleSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `ticket-${ticket.id}`, data: { ticket } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="group flex gap-2 items-start">
      {/* Checkbox — always visible when selected, hover otherwise */}
      <div className={clsx(
        'pt-3 shrink-0 transition-all',
        isSelected ? 'w-6 opacity-100' : 'w-0 opacity-0 group-hover:w-6 group-hover:opacity-100'
      )}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(ticket.id) }}
          className={clsx(
            'w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-[var(--accent)] border-[var(--accent)]'
              : 'border-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]'
          )}
        >
          {isSelected && <Check size={11} className="text-white" />}
        </button>
      </div>
      {/* Card */}
      <div onClick={() => onClick(ticket)} className={clsx(
        'flex-1 min-w-0 rounded-lg transition-all',
        isSelected && 'ring-2 ring-[var(--accent)]'
      )}>
        <TicketCardContent ticket={ticket} isDragging={false} />
      </div>
    </div>
  )
}

function DroppableColumn({ id, col, tickets, isLoading, isOver, onClick, selected, onToggleSelect, onSelectAllColumn }) {
  const { setNodeRef } = useDroppable({ id })

  const allSelected = tickets.length > 0 && tickets.every((t) => selected?.has(t.id))
  const someSelected = tickets.some((t) => selected?.has(t.id))

  return (
    <div key={col.key} className="flex flex-col gap-2 min-h-0">
      <div className="flex items-center gap-2 px-1 group/header">
        {/* Column select-all checkbox */}
        {tickets.length > 0 && (
          <button
            onClick={() => onSelectAllColumn(tickets.map((t) => t.id), !allSelected)}
            className={clsx(
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
              allSelected
                ? 'bg-[var(--accent)] border-[var(--accent)]'
                : someSelected
                  ? 'border-[var(--accent)] bg-transparent'
                  : 'border-transparent group-hover/header:border-[var(--text-secondary)]'
            )}
            title={allSelected ? `Deselect all ${col.label}` : `Select all ${col.label}`}
          >
            {allSelected && <Check size={10} className="text-white" />}
            {someSelected && !allSelected && <span className="w-1.5 h-1.5 rounded-sm bg-[var(--accent)]" />}
          </button>
        )}
        <span className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: col.color }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {col.label}
        </span>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
          {isLoading ? '…' : tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 overflow-y-auto space-y-2 pr-1 rounded-lg p-1 transition-colors min-h-[80px]',
          isOver && 'ring-2 ring-[var(--accent)] ring-dashed bg-[var(--accent)]/5'
        )}
      >
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--bg-card)' }} />
          ))
        ) : tickets.length === 0 ? (
          <div className={clsx(
            'h-20 rounded-lg border-2 border-dashed flex items-center justify-center',
            isOver ? 'border-[var(--accent)]' : ''
          )}
            style={{ borderColor: isOver ? undefined : 'var(--border)' }}>
            <span className="text-xs" style={{ color: isOver ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {isOver ? 'Drop here' : 'No tickets'}
            </span>
          </div>
        ) : (
          tickets.map((ticket) => (
            <DraggableTicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={onClick}
              isSelected={selected?.has(ticket.id)}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-1"
        style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{children}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    todo: { bg: 'rgba(107,114,128,0.2)', color: '#94a3b8' },
    in_progress: { bg: 'rgba(59,130,246,0.2)', color: 'var(--accent)' },
    review: { bg: 'rgba(245,158,11,0.2)', color: 'var(--warning)' },
    done: { bg: 'rgba(16,185,129,0.2)', color: 'var(--success)' },
    blocked: { bg: 'rgba(239,68,68,0.2)', color: 'var(--danger)' },
    cancelled: { bg: 'rgba(107,114,128,0.2)', color: '#6b7280' },
  }
  const s = colors[status] || colors.todo
  return (
    <span className="text-xs px-2 py-1 rounded-md font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {(status || '').replace('_', ' ')}
    </span>
  )
}

function TicketDetailModal({ ticket: baseTicket, onClose, agents: allAgents, projects: allProjects }) {
  if (!baseTicket) return null

  const { data: fullTicket } = useTicket(baseTicket.id)
  const ticket = fullTicket ?? baseTicket
  const updateTicket = useUpdateTicket()
  const deleteTicket = useDeleteTicket()

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState(null)

  function startEdit() {
    setForm({
      title: ticket.title || '',
      description: ticket.description || '',
      priority: ticket.priority || 'p2',
      status: ticket.status || 'todo',
      assignee_id: ticket.assignee_id ?? '',
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setForm(null)
  }

  async function saveEdit() {
    if (!form) return
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        status: form.status,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : undefined,
      })
      toast.success('Ticket updated')
      setEditing(false)
      setForm(null)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Update failed')
    }
  }

  async function handleDelete() {
    try {
      await deleteTicket.mutateAsync(ticket.id)
      toast.success('Ticket deleted')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Delete failed')
    }
  }

  const cleanTitle = (ticket.title || '').replace(/^\[.*?\]\s*/, '')
  const agentTag = (ticket.title || '').match(/^\[(.+?)\]/)?.[1]
  const createdDate = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—'
  const closedDate = ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : null

  let tags = []
  try { tags = JSON.parse(ticket.tags || '[]') } catch {}

  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }
  const inputClass = 'w-full px-3 py-2 rounded-md text-sm outline-none'

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-lg border-l shadow-2xl overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                  #{ticket.id}
                </span>
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </div>
              {editing ? (
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  style={inputStyle}
                />
              ) : (
                <h2 className="text-base font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {cleanTitle}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!editing ? (
                <>
                  <button onClick={startEdit}
                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-secondary)' }} title="Edit">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setConfirmDelete(true)}
                    className="p-1.5 rounded-md transition-colors hover:bg-[rgba(239,68,68,0.15)]"
                    style={{ color: 'var(--danger)' }} title="Delete">
                    <Trash2 size={15} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={saveEdit} disabled={updateTicket.isPending}
                    className="p-1.5 rounded-md transition-colors hover:bg-[rgba(16,185,129,0.15)]"
                    style={{ color: 'var(--success)' }} title="Save">
                    <Save size={15} />
                  </button>
                  <button onClick={cancelEdit}
                    className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: 'var(--text-secondary)' }} title="Cancel">
                    <X size={15} />
                  </button>
                </>
              )}
              <button onClick={onClose} className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)] ml-1"
                style={{ color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="mx-5 mt-4 p-3 rounded-lg border flex items-center justify-between"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <span className="text-sm" style={{ color: 'var(--danger)' }}>
              Delete this ticket permanently?
            </span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-md border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteTicket.isPending}
                className="text-xs px-3 py-1.5 rounded-md font-medium text-white"
                style={{ backgroundColor: 'var(--danger)' }}>
                {deleteTicket.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* Editable fields */}
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className={inputClass} style={inputStyle}>
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className={inputClass} style={inputStyle}>
                    <option value="p0">P0 — Critical</option>
                    <option value="p1">P1 — High</option>
                    <option value="p2">P2 — Medium</option>
                    <option value="p3">P3 — Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}>Assignee</label>
                <select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                  className={inputClass} style={inputStyle}>
                  <option value="">Unassigned</option>
                  {(allAgents || []).map((a) => (
                    <option key={a.id} value={a.id}>{a.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={clsx(inputClass, 'resize-none')} style={inputStyle} rows={5}
                  placeholder="Describe the task..." />
              </div>
            </div>
          ) : (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Assignee">
                  {ticket.assignee_name ? (
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                        {ticket.assignee_name.charAt(0).toUpperCase()}
                      </span>
                      {ticket.assignee_name}
                    </div>
                  ) : '—'}
                </DetailRow>
                <DetailRow label="Project">
                  {ticket.project_name ?? `#${ticket.project_id}`}
                </DetailRow>
                <DetailRow label="Created">
                  {createdDate}
                </DetailRow>
                <DetailRow label={closedDate ? 'Closed' : 'Sprint'}>
                  {closedDate ?? (ticket.sprint_id ? `Sprint #${ticket.sprint_id}` : '—')}
                </DetailRow>
              </div>

              {agentTag && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Agent:</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{agentTag}</span>
                </div>
              )}

              {/* GitHub PR link */}
              {(() => {
                let meta = {}
                try { meta = typeof ticket.metadata === 'string' ? JSON.parse(ticket.metadata) : (ticket.metadata || {}) } catch {}
                if (!meta.pr_url) return null
                const status = meta.pr_status || 'open'
                const colors = PR_STATUS_COLORS[status] || PR_STATUS_COLORS.open
                return (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                    <GitPullRequest size={16} style={{ color: colors.color }} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          Pull Request #{meta.pr_number || ''}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: colors.bg, color: colors.color }}>
                          {status}
                        </span>
                      </div>
                      {meta.pr_repo && (
                        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                          {meta.pr_repo}
                        </span>
                      )}
                    </div>
                    <a href={meta.pr_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--accent)' }}
                      title="Open PR on GitHub">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )
              })()}

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 rounded-md"
                      style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {ticket.description && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-2"
                    style={{ color: 'var(--text-secondary)' }}>Description</p>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed rounded-lg p-3"
                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                    {ticket.description}
                  </div>
                </div>
              )}

              {ticket.close_summary && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-2"
                    style={{ color: 'var(--success)' }}>Completion Summary</p>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed rounded-lg p-3 border"
                    style={{ backgroundColor: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)', color: 'var(--text-primary)' }}>
                    {ticket.close_summary}
                  </div>
                </div>
              )}

              {ticket.comments?.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-2"
                    style={{ color: 'var(--text-secondary)' }}>
                    Comments ({ticket.comments.length})
                  </p>
                  <div className="space-y-2">
                    {ticket.comments.map((c) => (
                      <div key={c.id} className="rounded-lg p-3 border"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                            {c.author_name ?? `Agent #${c.author_id}`}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                            {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                          {c.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
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
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    project_id: searchParams.get('project_id') ?? '',
    sprint_id: searchParams.get('sprint_id') ?? '',
    assignee_id: searchParams.get('assignee_id') ?? '',
    priority: searchParams.get('priority') ?? '',
  }
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTicket, setActiveTicket] = useState(null)
  const [overColumn, setOverColumn] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const ticketParams = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '')
  )

  const { data: ticketData, isLoading } = useTickets(ticketParams)
  const { data: projectData } = useProjects()
  const { data: agentData } = useAgents({ per_page: 200 })
  const { data: sprintData } = useSprints(
    filters.project_id ? { project_id: filters.project_id } : {}
  )

  const updateTicket = useUpdateTicket()
  const startTicket = useStartTicket()
  const reviewTicket = useReviewTicket()
  const doneTicket = useDoneTicket()
  const bulkDeleteMut = useBulkDelete()
  const bulkStatusMut = useBulkStatus()

  function toggleSelect(ticketId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ticketId)) next.delete(ticketId)
      else next.add(ticketId)
      return next
    })
  }

  function selectAllColumn(ticketIds, add) {
    setSelected((prev) => {
      const next = new Set(prev)
      ticketIds.forEach((id) => add ? next.add(id) : next.delete(id))
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(tickets.map((t) => t.id)))
  }

  function clearSelection() {
    setSelected(new Set())
    setConfirmBulkDelete(false)
  }

  async function handleBulkDelete() {
    try {
      await bulkDeleteMut.mutateAsync({ ticket_ids: [...selected] })
      toast.success(`Deleted ${selected.size} tickets`)
      clearSelection()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Bulk delete failed')
    }
  }

  async function handleBulkStatus(status) {
    try {
      await bulkStatusMut.mutateAsync({ ticket_ids: [...selected], status })
      toast.success(`Moved ${selected.size} tickets to ${status.replace('_', ' ')}`)
      clearSelection()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Bulk update failed')
    }
  }

  const tickets = ticketData?.data ?? []
  const projects = projectData?.data ?? []
  const agents = agentData?.data ?? []
  const sprints = sprintData?.data ?? []

  // DnD sensors — require 8px of movement before activating (so clicks still work)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function setFilter(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === '') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      return next
    }, { replace: true })
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveTicket(null)
    setOverColumn(null)

    if (!over) return

    const ticket = active.data.current?.ticket
    if (!ticket) return

    // The "over" id is the column status key (e.g., "todo", "in_progress")
    const targetStatus = over.id
    if (ticket.status === targetStatus) return

    // Optimistic — the query will refetch
    try {
      if (targetStatus === 'in_progress') {
        await startTicket.mutateAsync(ticket.id)
      } else if (targetStatus === 'review') {
        await reviewTicket.mutateAsync(ticket.id)
      } else if (targetStatus === 'done') {
        await doneTicket.mutateAsync({ id: ticket.id })
      } else {
        // For "todo" or other statuses, use the generic update
        await updateTicket.mutateAsync({ id: ticket.id, status: targetStatus })
      }
      toast.success(`Moved to ${targetStatus.replace('_', ' ')}`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to move ticket')
    }
  }

  function handleDragStart(event) {
    const ticket = event.active.data.current?.ticket
    setActiveTicket(ticket || null)
  }

  function handleDragOver(event) {
    const { over } = event
    setOverColumn(over?.id || null)
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {selected.size} selected
          </span>
          <div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />

          {/* Move to status */}
          {['todo', 'in_progress', 'review', 'done'].map((s) => (
            <button key={s} onClick={() => handleBulkStatus(s)}
              className="text-xs px-2.5 py-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}>
              → {s.replace('_', ' ')}
            </button>
          ))}

          <div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />

          {/* Delete */}
          {!confirmBulkDelete ? (
            <button onClick={() => setConfirmBulkDelete(true)}
              className="text-xs px-2.5 py-1.5 rounded-md transition-colors hover:bg-[rgba(239,68,68,0.15)]"
              style={{ color: 'var(--danger)' }}>
              <Trash2 size={13} className="inline mr-1" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--danger)' }}>Delete {selected.size} tickets?</span>
              <button onClick={handleBulkDelete} disabled={bulkDeleteMut.isPending}
                className="text-xs px-2.5 py-1.5 rounded-md font-medium text-white"
                style={{ backgroundColor: 'var(--danger)' }}>
                {bulkDeleteMut.isPending ? '...' : 'Confirm'}
              </button>
              <button onClick={() => setConfirmBulkDelete(false)}
                className="text-xs px-2.5 py-1.5 rounded-md"
                style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={selectAll}
              className="text-xs px-2.5 py-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}>
              Select all
            </button>
            <button onClick={clearSelection}
              className="text-xs px-2.5 py-1.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-secondary)' }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4 flex-1 overflow-hidden">
          {COLUMNS.map((col) => (
            <DroppableColumn
              key={col.key}
              id={col.key}
              col={col}
              tickets={columnTickets(col.key)}
              isLoading={isLoading}
              isOver={overColumn === col.key}
              onClick={setSelectedTicket}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSelectAllColumn={selectAllColumn}
            />
          ))}
        </div>

        {/* Drag overlay — the floating card while dragging */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeTicket ? (
            <div style={{ width: 280 }}>
              <TicketCardContent ticket={activeTicket} isDragging={true} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Ticket detail slide-over */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          agents={agents}
          projects={projects}
        />
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
