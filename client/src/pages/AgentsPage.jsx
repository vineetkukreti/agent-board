import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Plus, X, Bot, User, Check, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAgents, useRegisterAgent, useBulkDeleteAgents } from '../hooks/useAgents'
import { useTeams } from '../hooks/useTeams'
import { useAgentTypes } from '../hooks/useAgentTypes'

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:  { color: 'var(--success)',        label: 'Active' },
  idle:    { color: 'var(--text-secondary)', label: 'Idle' },
  blocked: { color: 'var(--warning)',        label: 'Blocked' },
  offline: { color: 'var(--danger)',         label: 'Offline' },
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

// ─── Register Modal ───────────────────────────────────────────────────────────

function RegisterModal({ onClose, teams, agentTypes }) {
  const register = useRegisterAgent()
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    model: '',
    team_id: '',
    agent_type_id: '',
    is_human: false,
  })
  const [apiKey, setApiKey] = useState(null)

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.display_name.trim()) return
    try {
      const res = await register.mutateAsync({
        name: form.name.trim(),
        display_name: form.display_name.trim(),
        model: form.model || undefined,
        team_id: form.team_id ? Number(form.team_id) : undefined,
        agent_type_id: form.agent_type_id ? Number(form.agent_type_id) : undefined,
        is_human: form.is_human,
      })
      setApiKey(res.api_key)
      toast.success('Agent registered')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Registration failed')
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
              Register Agent
            </h2>
            <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>

          {apiKey ? (
            <div className="p-5 space-y-4">
              <div className="rounded-lg p-3 border"
                style={{ backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }}>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--success)' }}>
                  Agent registered successfully!
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Copy the API key below — it will only be shown once.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  API Key
                </p>
                <code className="block w-full px-3 py-2 rounded-md text-xs break-all"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--warning)' }}>
                  {apiKey}
                </code>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-md text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color: 'var(--text-primary)' }}>
                    Slug <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="my-agent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color: 'var(--text-primary)' }}>
                    Display Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => set('display_name', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="My Agent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-primary)' }}>
                  Model
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => set('model', e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="claude-sonnet-4-5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color: 'var(--text-primary)' }}>Team</label>
                  <select
                    value={form.team_id}
                    onChange={(e) => set('team_id', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">No Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5"
                    style={{ color: 'var(--text-primary)' }}>Type</label>
                  <select
                    value={form.agent_type_id}
                    onChange={(e) => set('agent_type_id', e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">No Type</option>
                    {agentTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_human}
                  onChange={(e) => set('is_human', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Human agent
                </span>
              </label>
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
                  disabled={register.isPending}
                  className="flex-1 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {register.isPending ? 'Registering...' : 'Register'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onClick, selected, onToggle }) {
  const status = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline
  const avatarBg = hashColor(agent.name)

  return (
    <div className="group flex gap-2 items-start">
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(agent.id) }}
        className={`mt-4 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${
          selected
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{
          borderColor: selected ? 'var(--accent)' : 'var(--border)',
          backgroundColor: selected ? 'var(--accent)' : 'transparent',
        }}
      >
        {selected && <Check size={12} className="text-white" />}
      </button>

      {/* Card */}
      <div
        onClick={() => onClick(agent)}
        className={`flex-1 rounded-xl border p-4 cursor-pointer transition-all hover:border-[var(--accent)] hover:-translate-y-0.5 ${
          selected ? 'ring-2 ring-[var(--accent)]' : ''
        }`}
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-semibold"
            style={{ backgroundColor: avatarBg }}>
            {agent.is_human ? <User size={16} /> : initials(agent.display_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {agent.display_name}
              </p>
              {/* Status dot */}
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: status.color }} />
            </div>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              @{agent.name}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.team_name && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              {agent.team_name}
            </span>
          )}
          {agent.agent_type_name && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: 'var(--accent)' }}>
              {agent.agent_type_name}
            </span>
          )}
          {agent.model && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              {agent.model}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs" style={{ color: status.color }}>
            {status.label}
          </span>
          {agent.is_human && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Human</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const teamFilter = searchParams.get('team_id') ?? ''
  const [showRegister, setShowRegister] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const bulkDelete = useBulkDeleteAgents()

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = (agents) => setSelected(new Set(agents.map((a) => a.id)))
  const clearSelection = () => setSelected(new Set())

  async function handleBulkDelete() {
    if (!selected.size) return
    try {
      await bulkDelete.mutateAsync({ agent_ids: [...selected] })
      toast.success(`Deleted ${selected.size} agent${selected.size !== 1 ? 's' : ''}`)
      clearSelection()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Delete failed')
    }
  }

  const { data: agentData, isLoading } = useAgents(
    Object.fromEntries([
      statusFilter ? ['status', statusFilter] : [],
      teamFilter ? ['team_id', teamFilter] : [],
    ].filter((e) => e.length))
  )
  const { data: teamData } = useTeams()
  const { data: typeData } = useAgentTypes()

  const agents = agentData?.data ?? []
  const teams = teamData?.data ?? []
  const agentTypes = typeData?.data ?? []

  const navigate = useNavigate()

  const filtered = search.trim()
    ? agents.filter((a) =>
        a.display_name.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase())
      )
    : agents

  const selectStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Agents
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {isLoading ? '...' : `${filtered.length} agent${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={15} />
          Register Agent
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (e.target.value) p.set('search', e.target.value); else p.delete('search'); return p })}
            placeholder="Search agents..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (e.target.value) p.set('status', e.target.value); else p.delete('status'); return p })}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="blocked">Blocked</option>
          <option value="offline">Offline</option>
        </select>
        <select
          value={teamFilter}
          onChange={(e) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (e.target.value) p.set('team_id', e.target.value); else p.delete('team_id'); return p })}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={selectStyle}
        >
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--accent)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {selected.size} selected
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
            className="flex items-center gap-1 text-sm font-medium hover:opacity-80 disabled:opacity-50"
            style={{ color: 'var(--danger)' }}
          >
            <Trash2 size={14} />
            {bulkDelete.isPending ? 'Deleting...' : 'Delete'}
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <button
            onClick={() => selectAll(filtered)}
            className="text-sm font-medium hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            Select all
          </button>
          <span style={{ color: 'var(--border)' }}>|</span>
          <button
            onClick={clearSelection}
            className="text-sm font-medium hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Bot size={40} style={{ color: 'var(--text-secondary)' }} className="mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {search ? 'No agents match your search' : 'No agents registered yet'}
          </p>
          {!search && (
            <button
              onClick={() => setShowRegister(true)}
              className="mt-3 text-sm underline"
              style={{ color: 'var(--accent)' }}
            >
              Register the first one
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              selected={selected.has(agent.id)}
              onToggle={toggleSelect}
              onClick={() => navigate(`/agents/${agent.id}`)}
            />
          ))}
        </div>
      )}

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          teams={teams}
          agentTypes={agentTypes}
        />
      )}
    </div>
  )
}
