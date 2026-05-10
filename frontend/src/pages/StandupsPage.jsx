import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar, MessageSquare, AlertTriangle, CheckSquare } from 'lucide-react'
import { useStandupSummary } from '../hooks/useStandups'

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

function displayDate(isoDate) {
  try {
    return format(new Date(isoDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')
  } catch {
    return isoDate
  }
}

// ─── Standup Entry ────────────────────────────────────────────────────────────

function StandupEntry({ entry }) {
  const initial = entry.agent_name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {entry.agent_name}
          </p>
          {entry.project_name && (
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {entry.project_name}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {entry.yesterday && (
          <div className="flex gap-2">
            <CheckSquare size={14} className="mt-0.5 shrink-0"
              style={{ color: 'var(--text-secondary)' }} />
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                Yesterday
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{entry.yesterday}</p>
            </div>
          </div>
        )}
        {entry.today && (
          <div className="flex gap-2">
            <MessageSquare size={14} className="mt-0.5 shrink-0"
              style={{ color: 'var(--accent)' }} />
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
                Today
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{entry.today}</p>
            </div>
          </div>
        )}
        {entry.blockers && (
          <div className="flex gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0"
              style={{ color: 'var(--danger)' }} />
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--danger)' }}>
                Blockers
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{entry.blockers}</p>
            </div>
          </div>
        )}
        {!entry.yesterday && !entry.today && !entry.blockers && (
          <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
            No details provided
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Team Group ───────────────────────────────────────────────────────────────

function TeamGroup({ group }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {group.team_name}
        </h2>
        <span className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
          {group.entries.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {group.entries.map((entry) => (
          <StandupEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function StandupsPage() {
  const [selectedDate, setSelectedDate] = useState(() => todayIso())

  const { data, isLoading, isError } = useStandupSummary({ date: selectedDate })

  const teams = data?.teams ?? []
  const totalEntries = data?.total_entries ?? 0

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Standups
          </h1>
          {!isLoading && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {displayDate(selectedDate)} &middot; {totalEntries} entr{totalEntries !== 1 ? 'ies' : 'y'}
            </p>
          )}
        </div>

        {/* Date controls */}
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {selectedDate !== todayIso() && (
            <button
              onClick={() => setSelectedDate(todayIso())}
              className="text-xs px-2.5 py-1.5 rounded-md"
              style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: 'var(--accent)' }}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-32 rounded mb-3 animate-pulse"
                style={{ backgroundColor: 'var(--bg-card)' }} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-36 rounded-xl animate-pulse"
                    style={{ backgroundColor: 'var(--bg-card)' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>Failed to load standups.</p>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <Calendar size={40} style={{ color: 'var(--text-secondary)' }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              No standups for this date
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              No agents have submitted standups for {displayDate(selectedDate)}.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {teams.map((group) => (
            <TeamGroup key={group.team_name} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
