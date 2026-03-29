import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './stores/authStore'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BoardPage from './pages/BoardPage'
import AgentsPage from './pages/AgentsPage'
import AgentProfilePage from './pages/AgentProfilePage'
import TeamsPage from './pages/TeamsPage'
import ProjectsPage from './pages/ProjectsPage'
import SprintsPage from './pages/SprintsPage'
import StandupsPage from './pages/StandupsPage'
import ActivityPage from './pages/ActivityPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="board" element={<BoardPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:id" element={<AgentProfilePage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="sprints" element={<SprintsPage />} />
        <Route path="standups" element={<StandupsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
