import { create } from 'zustand'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

function loadFromStorage() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const userRaw = localStorage.getItem(USER_KEY)
    const user = userRaw ? JSON.parse(userRaw) : null
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

const { token: savedToken, user: savedUser } = loadFromStorage()

const useAuthStore = create((set, get) => ({
  user: savedUser,
  token: savedToken,

  get isAuthenticated() {
    return !!get().token
  },

  login(user, token) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user, token })
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ user: null, token: null })
  },

  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },
}))

export default useAuthStore
