import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, ChevronDown, LogOut, User } from 'lucide-react'
import clsx from 'clsx'
import Sidebar from './Sidebar'
import useBoardStore from '../../stores/boardStore'
import useAuthStore from '../../stores/authStore'
import { useProjects } from '../../hooks/useProjects'

function ProjectSelector() {
  const [open, setOpen] = useState(false)
  const { data: projects } = useProjects()
  const activeProject = useBoardStore((s) => s.activeProject)
  const setActiveProject = useBoardStore((s) => s.setActiveProject)

  const projectList = projects?.items ?? projects ?? []
  const active = projectList.find((p) => p.id === activeProject)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
          'bg-[var(--bg-card)] border border-[var(--border)]',
          'text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-32 truncate">
          {active ? active.name : 'All Projects'}
        </span>
        <ChevronDown size={14} className="shrink-0 text-[var(--text-secondary)]" />
      </button>

      {open && (
        <div
          className={clsx(
            'absolute top-full mt-1 left-0 z-50 min-w-40 rounded-md shadow-lg',
            'bg-[var(--bg-card)] border border-[var(--border)] py-1'
          )}
          role="listbox"
        >
          <button
            role="option"
            aria-selected={activeProject === null}
            onClick={() => { setActiveProject(null); setOpen(false) }}
            className={clsx(
              'w-full text-left px-3 py-2 text-sm transition-colors',
              activeProject === null
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            )}
          >
            All Projects
          </button>
          {projectList.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={activeProject === p.id}
              onClick={() => { setActiveProject(p.id); setOpen(false) }}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm transition-colors truncate',
                activeProject === p.id
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const logoutStore = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  function handleLogout() {
    logoutStore()
    navigate('/login')
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm',
          'hover:bg-[var(--bg-hover)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
        )}
      >
        <span
          className={clsx(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold',
            'bg-[var(--accent)] text-white'
          )}
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="text-[var(--text-primary)] hidden sm:block max-w-24 truncate">
          {user?.username ?? 'User'}
        </span>
        <ChevronDown size={14} className="text-[var(--text-secondary)] hidden sm:block" />
      </button>

      {open && (
        <div
          className={clsx(
            'absolute top-full mt-1 right-0 z-50 w-44 rounded-md shadow-lg',
            'bg-[var(--bg-card)] border border-[var(--border)] py-1'
          )}
          role="menu"
        >
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-xs text-[var(--text-secondary)]">Signed in as</p>
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {user?.username}
            </p>
          </div>
          <button
            role="menuitem"
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm',
              'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
              'transition-colors'
            )}
          >
            <User size={14} />
            Profile
          </button>
          <button
            role="menuitem"
            onClick={handleLogout}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm',
              'text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors'
            )}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppShell() {
  const sidebarOpen = useBoardStore((s) => s.sidebarOpen)
  const toggleSidebar = useBoardStore((s) => s.toggleSidebar)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top bar */}
        <header
          className={clsx(
            'flex items-center justify-between h-14 px-4 shrink-0',
            'bg-[var(--bg-secondary)] border-b border-[var(--border)]'
          )}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              className={clsx(
                'p-1.5 rounded-md text-[var(--text-secondary)]',
                'hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
                'transition-colors focus-visible:outline-none',
                'focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                'sm:hidden'
              )}
            >
              <Menu size={18} />
            </button>

            <span className="text-base font-semibold text-[var(--text-primary)] sm:hidden">
              Agent Board
            </span>

            <ProjectSelector />
          </div>

          <UserMenu />
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
