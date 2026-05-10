import { Trophy, DollarSign, Zap, Clock, Medal } from 'lucide-react'
import { useAgentLeaderboard } from '../hooks/useAgents'

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] // gold, silver, bronze

function RankBadge({ rank }) {
  if (rank <= 3) {
    return (
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: `${MEDAL_COLORS[rank - 1]}30`, color: MEDAL_COLORS[rank - 1] }}>
        {rank}
      </span>
    )
  }
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
      style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
      {rank}
    </span>
  )
}

function AgentRow({ agent, rank, valueLabel, value, valueColor }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-[var(--bg-hover)]"
      style={{ borderColor: 'var(--border)' }}>
      <RankBadge rank={rank} />
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
        {(agent.display_name || agent.name || '?').charAt(0).toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {agent.display_name || agent.name}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>@{agent.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold" style={{ color: valueColor }}>{value}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{valueLabel}</p>
      </div>
    </div>
  )
}

function LeaderboardCard({ title, icon, agents, getValue, getLabel, valueColor, emptyMsg }) {
  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}>
        <span style={{ color: valueColor }}>{icon}</span>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      {agents?.length > 0 ? (
        agents.map((agent, i) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            rank={i + 1}
            value={getValue(agent)}
            valueLabel={getLabel(agent)}
            valueColor={valueColor}
          />
        ))
      ) : (
        <p className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
          {emptyMsg}
        </p>
      )}
    </div>
  )
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

export default function LeaderboardPage() {
  const { data, isLoading, isError } = useAgentLeaderboard()

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--danger)' }}>Failed to load leaderboard.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Leaderboard</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border animate-pulse h-80"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Trophy size={22} style={{ color: '#FFD700' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Leaderboard</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LeaderboardCard
          title="Most Productive"
          icon={<Medal size={16} />}
          agents={data?.top_by_tickets}
          getValue={(a) => a.tickets_completed}
          getLabel={() => 'tickets done'}
          valueColor="var(--success)"
          emptyMsg="No completed tickets yet"
        />

        <LeaderboardCard
          title="Most Cost Efficient"
          icon={<DollarSign size={16} />}
          agents={data?.top_by_cost}
          getValue={(a) => `$${(a.avg_cost || 0).toFixed(4)}`}
          getLabel={(a) => `${a.tickets_worked || 0} tickets`}
          valueColor="#10b981"
          emptyMsg="No cost data yet"
        />

        <LeaderboardCard
          title="Fastest"
          icon={<Zap size={16} />}
          agents={data?.top_by_speed}
          getValue={(a) => formatDuration(a.avg_duration_seconds)}
          getLabel={(a) => `${a.sessions_count || 0} sessions`}
          valueColor="var(--accent)"
          emptyMsg="No session data yet"
        />
      </div>
    </div>
  )
}
