import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from '../hooks/useTeams'
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../hooks/useProjects'
import {
  useAgentTypes,
  useCreateAgentType,
  useUpdateAgentType,
  useDeleteAgentType,
} from '../hooks/useAgentTypes'

// ─── shared primitives ────────────────────────────────────────────────────────

const inputStyle = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
}
const inputClass = "px-3 py-1.5 rounded-md text-sm outline-none"

function ConfirmDeleteModal({ label, onConfirm, onCancel }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border shadow-2xl p-5 space-y-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Delete {label}?
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-md text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2 rounded-md text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--danger)' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── inline row editor ────────────────────────────────────────────────────────

function EditableRow({ item, fields, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  function startEdit() {
    const initial = {}
    fields.forEach((f) => { initial[f.key] = item[f.key] ?? '' })
    setValues(initial)
    setEditing(true)
  }

  async function handleSave() {
    try {
      await onSave(item.id, values)
      setEditing(false)
      toast.success('Updated')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Update failed')
    }
  }

  async function handleDelete() {
    try {
      await onDelete(item.id)
      setConfirmDelete(false)
      toast.success('Deleted')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Delete failed')
    }
  }

  return (
    <>
      <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
        {fields.map((f) => (
          <td key={f.key} className="px-4 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)' }}>
            {editing ? (
              f.type === 'select' ? (
                <select
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={inputClass}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'color' ? (
                <input
                  type="color"
                  value={values[f.key] ?? '#3b82f6'}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-8 h-7 rounded cursor-pointer border-0 p-0"
                />
              ) : (
                <input
                  type="text"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={inputClass}
                  style={{ ...inputStyle, width: '100%' }}
                />
              )
            ) : (
              f.type === 'color' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item[f.key] ?? '#888' }} />
                  {item[f.key] ?? '—'}
                </span>
              ) : (
                item[f.key] ?? <span style={{ color: 'var(--text-secondary)' }}>—</span>
              )
            )}
          </td>
        ))}
        <td className="px-4 py-2.5 text-right">
          {editing ? (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={handleSave}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--success)' }}
                title="Save"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={startEdit}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--danger)' }}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </td>
      </tr>
      {confirmDelete && (
        <ConfirmDeleteModal
          label={item.name ?? item.display_name ?? `#${item.id}`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

// ─── add row form ─────────────────────────────────────────────────────────────

function AddRow({ fields, onAdd, placeholder = 'Add new...' }) {
  const [values, setValues] = useState({})
  const [open, setOpen] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    const required = fields.filter((f) => f.required)
    if (required.some((f) => !values[f.key]?.toString().trim())) {
      toast.error('Fill in all required fields')
      return
    }
    try {
      await onAdd(values)
      setValues({})
      setOpen(false)
      toast.success('Created')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Create failed')
    }
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={fields.length + 1} className="px-4 py-2">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            <Plus size={14} />
            {placeholder}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
      {fields.map((f) => (
        <td key={f.key} className="px-4 py-2">
          {f.type === 'select' ? (
            <select
              value={values[f.key] ?? f.default ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={inputClass}
              style={{ ...inputStyle, width: '100%' }}
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : f.type === 'color' ? (
            <input
              type="color"
              value={values[f.key] ?? '#3b82f6'}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-8 h-7 rounded cursor-pointer border-0 p-0"
            />
          ) : (
            <input
              type="text"
              value={values[f.key] ?? ''}
              onChange={(e) => {
                const val = e.target.value
                const updates = { [f.key]: val }
                // Auto-fill slug from name
                if (f.key === 'name' && !values.slug) {
                  updates.slug = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')
                }
                setValues((v) => ({ ...v, ...updates }))
              }}
              placeholder={f.placeholder ?? f.key}
              className={inputClass}
              style={{ ...inputStyle, width: '100%' }}
            />
          )}
        </td>
      ))}
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <button onClick={handleAdd} className="p-1.5 rounded"
            style={{ color: 'var(--success)' }}>
            <Check size={14} />
          </button>
          <button onClick={() => { setOpen(false); setValues({}) }}
            className="p-1.5 rounded" style={{ color: 'var(--text-secondary)' }}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── CRUD Table ───────────────────────────────────────────────────────────────

function CRUDTable({ title, items, fields, headers, isLoading, onAdd, onSave, onDelete, addPlaceholder }) {
  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded animate-pulse"
              style={{ backgroundColor: 'var(--bg-hover)' }} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                {headers.map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}>
                    {h}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <EditableRow
                  key={item.id}
                  item={item}
                  fields={fields}
                  onSave={onSave}
                  onDelete={onDelete}
                />
              ))}
              <AddRow fields={fields} onAdd={onAdd} placeholder={addPlaceholder} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function AgentTypesTab() {
  const { data, isLoading } = useAgentTypes()
  const create = useCreateAgentType()
  const update = useUpdateAgentType()
  const del = useDeleteAgentType()

  const items = data?.data ?? []

  const fields = [
    { key: 'name', placeholder: 'Frontend Engineer', required: true },
    { key: 'slug', placeholder: 'frontend-engineer', required: true },
    { key: 'category', placeholder: 'engineering' },
    { key: 'description', placeholder: 'Optional description' },
  ]

  return (
    <CRUDTable
      title="Agent Types"
      items={items}
      fields={fields}
      headers={['Name', 'Slug', 'Category', 'Description']}
      isLoading={isLoading}
      onAdd={(values) => create.mutateAsync({
        name: values.name,
        slug: values.slug,
        category: values.category || undefined,
        description: values.description || undefined,
      })}
      onSave={(id, values) => update.mutateAsync({ id, ...values })}
      onDelete={(id) => del.mutateAsync(id)}
      addPlaceholder="Add agent type"
    />
  )
}

function TeamsTab() {
  const { data, isLoading } = useTeams()
  const create = useCreateTeam()
  const update = useUpdateTeam()
  const del = useDeleteTeam()

  const items = data?.data ?? []

  const fields = [
    { key: 'name', placeholder: 'Frontend', required: true },
    { key: 'slug', placeholder: 'frontend', required: true },
    { key: 'description', placeholder: 'Optional description' },
    { key: 'color', type: 'color' },
  ]

  return (
    <CRUDTable
      title="Teams"
      items={items}
      fields={fields}
      headers={['Name', 'Slug', 'Description', 'Color']}
      isLoading={isLoading}
      onAdd={(values) => create.mutateAsync({
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        color: values.color || undefined,
      })}
      onSave={(id, values) => update.mutateAsync({ id, ...values })}
      onDelete={(id) => del.mutateAsync(id)}
      addPlaceholder="Add team"
    />
  )
}

function ProjectsTab() {
  const { data, isLoading } = useProjects()
  const create = useCreateProject()
  const update = useUpdateProject()
  const del = useDeleteProject()

  const items = data?.data ?? []

  const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'archived', label: 'Archived' },
  ]

  const fields = [
    { key: 'name', placeholder: 'My Project', required: true },
    { key: 'slug', placeholder: 'my-project', required: true },
    { key: 'description', placeholder: 'Optional' },
    { key: 'status', type: 'select', options: STATUS_OPTIONS, default: 'active' },
  ]

  return (
    <CRUDTable
      title="Projects"
      items={items}
      fields={fields}
      headers={['Name', 'Slug', 'Description', 'Status']}
      isLoading={isLoading}
      onAdd={(values) => create.mutateAsync({
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        status: values.status || 'active',
      })}
      onSave={(id, values) => update.mutateAsync({ id, ...values })}
      onDelete={(id) => del.mutateAsync(id)}
      addPlaceholder="Add project"
    />
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'agent-types', label: 'Agent Types' },
  { key: 'teams',       label: 'Teams' },
  { key: 'projects',    label: 'Projects' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('agent-types')

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Manage agent types, teams, and projects
        </p>
      </div>

      {/* Tab bar */}
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

      {/* Tab content */}
      {activeTab === 'agent-types' && <AgentTypesTab />}
      {activeTab === 'teams' && <TeamsTab />}
      {activeTab === 'projects' && <ProjectsTab />}
    </div>
  )
}
