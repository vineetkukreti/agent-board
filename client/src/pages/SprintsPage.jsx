import { useState } from 'react'
import { format } from 'date-fns'
import { Zap, Plus, X, Play, CheckCircle, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useSprints,
  useCreateSprint,
  useActivateSprint,
  useCompleteSprint,
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

function SprintCard({ sprint, onActivate, onComplete }) {
  const ss = SPRINT_STATUS[sprint.status] ?? SPRINT_STATUS.planning
  const isActive = sprint.status === 'active'
  const isPlanning = sprint.status === 'planning'

  return (
    <div
      className="rounded-xl border p-4 transition-all"
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
              onClick={() => onActivate(sprint.id)}
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
              onClick={() => onComplete(sprint.id)}
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
  )
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
  const [projectFilter, setProjectFilter] = useState('')

  const { data: sprintData, isLoading } = useSprints(
    projectFilter ? { project_id: projectFilter } : {}
  )
  const { data: projectData } = useProjects()

  const activateSprint = useActivateSprint()
  const completeSprint = useCompleteSprint()

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
            onChange={(e) => setProjectFilter(e.target.value)}
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
    </div>
  )
}
