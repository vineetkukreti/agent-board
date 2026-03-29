import { useState } from 'react'
import { ChevronDown, ChevronUp, Users, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTeams, useTeamMembers, useCreateTeam } from '../hooks/useTeams'

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:  { color: 'var(--success)',        label: 'Active' },
  idle:    { color: 'var(--text-secondary)', label: 'Idle' },
  blocked: { color: 'var(--warning)',        label: 'Blocked' },
  offline: { color: 'var(--danger)',         label: 'Offline' },
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function TeamMemberList({ teamId }) {
  const { data, isLoading } = useTeamMembers(teamId)
  const members = data?.data ?? []

  if (isLoading) return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-8 rounded animate-pulse"
          style={{ backgroundColor: 'var(--bg-hover)' }} />
      ))}
    </div>
  )

  if (members.length === 0) return (
    <div className="p-4 text-center">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No members</p>
    </div>
  )

  return (
    <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {members.map((m) => {
        const status = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.offline
        return (
          <li key={m.id} className="px-4 py-2.5 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: status.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {m.display_name}
              </span>
              {m.agent_type_name && (
                <span className="ml-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {m.agent_type_name}
                </span>
              )}
            </div>
            {m.model && (
              <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
                {m.model}
              </span>
            )}
            <span className="text-xs shrink-0" style={{ color: status.color }}>
              {status.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function TeamCard({ team }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: team.color ?? 'var(--text-secondary)' }} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {team.name}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                @{team.slug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {team.member_count}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>members</p>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-md transition-colors"
              style={{
                backgroundColor: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
              }}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        {team.description && (
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {team.description}
          </p>
        )}
      </div>

      {/* Expandable member list */}
      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          <TeamMemberList teamId={team.id} />
        </div>
      )}
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateTeamModal({ onClose }) {
  const create = useCreateTeam()
  const [form, setForm] = useState({ name: '', slug: '', description: '', color: '#3b82f6' })

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) return
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        color: form.color || undefined,
      })
      toast.success('Team created')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to create team')
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
              New Team
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
                    if (!form.slug) set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
                  }}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Frontend"
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
                  onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="frontend"
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
                rows={2}
                placeholder="What does this team do?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-primary)' }}>
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => set('color', e.target.value)}
                  className="w-10 h-8 rounded cursor-pointer border-0 p-0"
                  style={{ backgroundColor: 'transparent' }}
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {form.color}
                </span>
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
                {create.isPending ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, isError } = useTeams()
  const teams = data?.data ?? []

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Teams</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {isLoading ? '...' : `${teams.length} team${teams.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={15} />
          New Team
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>Failed to load teams.</p>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Users size={40} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No teams yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm underline"
            style={{ color: 'var(--accent)' }}
          >
            Create the first team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}

      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
