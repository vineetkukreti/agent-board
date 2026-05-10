import {
  Activity,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Trophy,
  Users,
  UsersRound,
  Zap,
} from 'lucide-react'

import ActivityPage from '../pages/ActivityPage'
import AgentProfilePage from '../pages/AgentProfilePage'
import AgentsPage from '../pages/AgentsPage'
import BoardPage from '../pages/BoardPage'
import DashboardPage from '../pages/DashboardPage'
import LeaderboardPage from '../pages/LeaderboardPage'
import ProjectsPage from '../pages/ProjectsPage'
import SettingsPage from '../pages/SettingsPage'
import SprintsPage from '../pages/SprintsPage'
import StandupsPage from '../pages/StandupsPage'
import TeamsPage from '../pages/TeamsPage'

export const APP_ROUTES = [
  {
    index: true,
    path: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    element: <DashboardPage />,
    nav: true,
    end: true,
  },
  {
    path: '/board',
    label: 'Board',
    icon: Kanban,
    element: <BoardPage />,
    nav: true,
  },
  {
    path: '/agents',
    label: 'Agents',
    icon: Users,
    element: <AgentsPage />,
    nav: true,
  },
  {
    path: '/agents/:id',
    label: 'Agent Profile',
    element: <AgentProfilePage />,
  },
  {
    path: '/leaderboard',
    label: 'Leaderboard',
    icon: Trophy,
    element: <LeaderboardPage />,
    nav: true,
  },
  {
    path: '/teams',
    label: 'Teams',
    icon: UsersRound,
    element: <TeamsPage />,
    nav: true,
  },
  {
    path: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    element: <ProjectsPage />,
    nav: true,
  },
  {
    path: '/sprints',
    label: 'Sprints',
    icon: Zap,
    element: <SprintsPage />,
    nav: true,
  },
  {
    path: '/standups',
    label: 'Standups',
    icon: MessageSquare,
    element: <StandupsPage />,
    nav: true,
  },
  {
    path: '/activity',
    label: 'Activity',
    icon: Activity,
    element: <ActivityPage />,
    nav: true,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    element: <SettingsPage />,
    nav: true,
  },
]

export const NAV_ITEMS = APP_ROUTES.filter((route) => route.nav)
