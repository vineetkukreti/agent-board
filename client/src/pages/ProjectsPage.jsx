import { useState } from 'react'
import { format } from 'date-fns'
import { Folder, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjects, useCreateProject, useProjectStats } from '../hooks/useProjects'

// ─── helpers ──────────────────────────────────────────────────────────────────

const PROJECT_STATUS = {
  active:   { color: 'var(--success)',        label: 'Active',   bg: 'rgba(16,185,129,0.15)' },
  paused:   { color: 'var(--warning)',        label: 'Paused',   bg: 'rgba(245,158,11,0.15)' },
  archived: { color: 'var(--text-secondary)', label: 'Archived', bg: 'rgba(148,163,184,0.1)' },
}

function safeFormat(dateStr) {
  if (!dateStr) return '—'
  try { return format(new Date(dateStr), 'MMM d, yyyy') } catch { return '—' }
}

// ─── Stats Expansion ──────────────────────────────────────────────────────────

function ProjectStatsPanel({ projectId }) {
  const { data, isLoading } = useProjectStats(projectId)

  if (isLoading) return (
    <div className="p-4 grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 rounded animate-pulse"
          style={{ backgroundColor: 'var(--bg-hover)' }} />
      ))}
    </div>
  )

  if (!data) return null

  const total = Object.values(data.tickets_by_status ?? {}).reduce((a, b) => a + b, 0)

  const statusItems = [
    { key: 'todo',        label: 'Todo',        color: 'var(--text-secondary)' },
    { key: 'in_progress', label: 'In Progress', color: 'var(--accent)' },
    { key: 'review',      label: 'Review',      color: 'var(--warning)' },
    { key: 'done',        label: 'Done',        color: 'var(--success)' },
    { key: 'blocked',     label: 'Blocked',     color: 'var(--danger)' },
  ]

  const priorityItems = [
    { key: 'p0', label: 'P0', color: 'var(--danger)' },
    { key: 'p1', label: 'P1', color: 'var(--warning)' },
    { key: 'p2', label: 'P2', color: 'var(--accent)' },
    { key: 'p3', label: 'P3', color: '#6b7280' },
  ]

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          By Status
        </p>
        <div className="space-y-1.5">
          {statusItems.map((s) => {
            const val = data.tickets_by_status?.[s.key] ?? 0
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className="text-xs w-20" style={{ color: 'var(--text-secondary)' }}>
                  {s.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-hover)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: total > 0 ? `${Math.min(100, (val / total) * 100)}%` : '0%',
                      backgroundColor: s.color,
                    }} />
                </div>
                <span className="text-xs w-6 text-right" style={{ color: 'var(--text-primary)' }}>
                  {val}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          By Priority
        </p>
        <div className="space-y-1.5">
          {priorityItems.map((p) => {
            const val = data.tickets_by_priority?.[p.key] ?? 0
            return (
              <div key={p.key} className="flex items-center gap-2">
                <span className="text-xs w-6" style={{ color: p.color }}>{p.label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-hover)' }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: total > 0 ? `${Math.min(100, (val / total) * 100)}%` : '0%',
                      backgroundColor: p.color,
                    }} />
                </div>
                <span className="text-xs w-6 text-right" style={{ color: 'var(--text-primary)' }}>
                  {val}
                </span>
              </div>
            )
          })}
        </div>
        {data.active_blockers > 0 && (
          <div className="mt-3 flex items-center gap-1 text-xs"
            style={{ color: 'var(--danger)' }}>
            <span className="font-medium">{data.active_blockers}</span>
            &nbsp;active blocker{data.active_blockers !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project }) {
  const [expanded, setExpanded] = useState(false)
  const ps = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.active

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {project.name}
              </h3>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: ps.bg, color: ps.color }}>
                {ps.label}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>@{project.slug}</p>
            {project.description && (
              <p className="text-sm mt-1.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {project.description}
              </p>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-md transition-colors shrink-0"
            style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs"
          style={{ color: 'var(--text-secondary)' }}>
          <span>{project.ticket_count ?? 0} ticket{project.ticket_count !== 1 ? 's' : ''}</span>
          <span>Created {safeFormat(project.created_at)}</span>
        </div>
      </div>
      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          <ProjectStatsPanel projectId={project.id} />
        </div>
      )}
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateProjectModal({ onClose }) {
  const create = useCreateProject()
  const [form, setForm] = useState({ name: '', slug: '', description: '', status: 'active' })

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) return
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
      })
      toast.success('Project created')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to create project')
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
              New Project
            </h2>
            <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-primary)' }}>
                  Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    set('name', e.target.value)
                    if (!form.slug) {
                      set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                    }
                  }}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="My Project"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-primary)' }}>
                  Slug <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="my-project"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}>
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className={`${inputClass} resize-none`}
                style={inputStyle}
                rows={3}
                placeholder="What is this project about?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}>
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
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
                {create.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, isError } = useProjects()
  const projects = data?.data ?? []

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {isLoading ? '...' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={15} />
          New Project
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>Failed to load projects.</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Folder size={40} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No projects yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm underline"
            style={{ color: 'var(--accent)' }}
          >
            Create the first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
