import { useState } from 'react'
import { ChevronDown, ChevronUp, Users, Plus, X, Pencil, Trash2, Check, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTeams, useTeamMembers, useCreateTeam, useUpdateTeam, useDeleteTeam, useBulkDeleteTeams } from '../hooks/useTeams'

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:  { color: 'var(--success)',        label: 'Active' },
  idle:    { color: 'var(--text-secondary)', label: 'Idle' },
  blocked: { color: 'var(--warning)',        label: 'Blocked' },
  offline: { color: 'var(--danger)',         label: 'Offline' },
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── Team Member List ────────────────────────────────────────────────────────

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

// ─── Team Card ──────────────────────────────────────────────────────────────

function TeamCard({ team, isSelected, onToggleSelect, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateTeam = useUpdateTeam()

  function startEdit() {
    setEditForm({
      name: team.name,
      description: team.description ?? '',
      color: team.color ?? '#3b82f6',
    })
    setEditing(true)
  }

  async function handleSave() {
    if (!editForm.name.trim()) return
    try {
      await updateTeam.mutateAsync({
        id: team.id,
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        color: editForm.color || null,
      })
      toast.success('Team updated')
      setEditing(false)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to update team')
    }
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete(team.id)
    setConfirmDelete(false)
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }
  const inputClass = "w-full px-2 py-1 rounded-md text-sm outline-none"

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-2">
          {/* Checkbox */}
          <div className="pt-0.5 shrink-0">
            <button
              onClick={() => onToggleSelect(team.id)}
              className="w-5 h-5 rounded border flex items-center justify-center transition-colors"
              style={{
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
              }}
            >
              {isSelected && <Check size={11} className="text-white" />}
            </button>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {editing ? (
                  <input
                    type="color"
                    value={editForm.color}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-5 h-5 rounded-full shrink-0 cursor-pointer border-0 p-0"
                    style={{ backgroundColor: 'transparent' }}
                  />
                ) : (
                  <div className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: team.color ?? 'var(--text-secondary)' }} />
                )}
                <div className="min-w-0">
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                      style={inputStyle}
                    />
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {team.name}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        @{team.slug}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {team.member_count}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>members</p>
                </div>
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={updateTeam.isPending}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ backgroundColor: 'var(--success)', color: 'white' }}
                      title="Save"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startEdit}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                      title="Edit team"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={handleDelete}
                      className="p-1.5 rounded-md transition-colors"
                      style={{
                        backgroundColor: confirmDelete ? 'var(--danger)' : 'var(--bg-hover)',
                        color: confirmDelete ? 'white' : 'var(--text-secondary)',
                      }}
                      title={confirmDelete ? 'Click again to confirm' : 'Delete team'}
                      onBlur={() => setConfirmDelete(false)}
                    >
                      <Trash2 size={14} />
                    </button>
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
                  </>
                )}
              </div>
            </div>
            {editing ? (
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className={`${inputClass} mt-2 resize-none`}
                style={inputStyle}
                rows={2}
                placeholder="Description"
              />
            ) : (
              team.description && (
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {team.description}
                </p>
              )
            )}
          </div>
        </div>
      </div>

      {/* Expandable member list */}
      {expanded && !editing && (
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
  const [slugTouched, setSlugTouched] = useState(false)

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
                    if (!slugTouched) set('slug', slugify(e.target.value))
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
                  onChange={(e) => {
                    set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))
                    setSlugTouched(true)
                  }}
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

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────

function BulkActionBar({ count, onDelete, onClear, isDeleting }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {count} selected
      </span>
      <div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }} />
      {confirmDelete ? (
        <>
          <span className="text-sm" style={{ color: 'var(--danger)' }}>Delete {count} teams?</span>
          <button
            onClick={() => { onDelete(); setConfirmDelete(false) }}
            disabled={isDeleting}
            className="px-3 py-1 rounded-md text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--danger)' }}
          >
            {isDeleting ? 'Deleting...' : 'Confirm'}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-3 py-1 rounded-md text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors"
          style={{ color: 'var(--danger)' }}
        >
          <Trash2 size={14} />
          Delete
        </button>
      )}
      <div className="flex-1" />
      <button
        onClick={onClear}
        className="p-1 rounded-md transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const { data, isLoading, isError } = useTeams()
  const deleteTeam = useDeleteTeam()
  const bulkDelete = useBulkDeleteTeams()
  const teams = data?.data ?? []

  function toggleSelect(teamId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function handleSingleDelete(teamId) {
    try {
      await deleteTeam.mutateAsync(teamId)
      toast.success('Team deleted')
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(teamId)
        return next
      })
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to delete team')
    }
  }

  async function handleBulkDelete() {
    try {
      await bulkDelete.mutateAsync({ team_ids: [...selected] })
      toast.success(`Deleted ${selected.size} team${selected.size !== 1 ? 's' : ''}`)
      clearSelection()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to delete teams')
    }
  }

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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
          isDeleting={bulkDelete.isPending}
        />
      )}

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
            <TeamCard
              key={team.id}
              team={team}
              isSelected={selected.has(team.id)}
              onToggleSelect={toggleSelect}
              onDelete={handleSingleDelete}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
