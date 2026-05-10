import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import { NAV_ITEMS } from '../../app/navigation'

export default function Sidebar({ open, onToggle }) {
  return (
    <aside
      className={clsx(
        'flex flex-col h-full transition-all duration-200 border-r shrink-0',
        'bg-[var(--bg-secondary)] border-[var(--border)]',
        open ? 'w-56' : 'w-14'
      )}
    >
      {/* Logo row */}
      <div
        className={clsx(
          'flex items-center h-14 px-3 border-b border-[var(--border)]',
          open ? 'justify-between' : 'justify-center'
        )}
      >
        {open && (
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
            Agent Board
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className={clsx(
            'p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            'hover:bg-[var(--bg-hover)] transition-colors focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            !open && 'rotate-180'
          )}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1.5">
        {NAV_ITEMS.map((item) => {
          const NavIcon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                  !open && 'justify-center px-2'
                )
              }
              title={!open ? item.label : undefined}
            >
              <NavIcon size={16} className="shrink-0" />
              {open && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
