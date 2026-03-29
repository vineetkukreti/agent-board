import { create } from 'zustand'

const useBoardStore = create((set) => ({
  sidebarOpen: true,
  activeProject: null,
  activeFilters: {},
  viewMode: 'kanban',

  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }))
  },

  setSidebarOpen(open) {
    set({ sidebarOpen: open })
  },

  setActiveProject(projectId) {
    set({ activeProject: projectId })
  },

  setActiveFilters(filters) {
    set({ activeFilters: filters })
  },

  updateFilter(key, value) {
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
    }))
  },

  clearFilters() {
    set({ activeFilters: {} })
  },

  setViewMode(mode) {
    set({ viewMode: mode })
  },
}))

export default useBoardStore
