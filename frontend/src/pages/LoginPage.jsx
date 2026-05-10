import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Eye, EyeOff, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import useAuthStore from '../stores/authStore'
import { login, setup } from '../api/auth'
import axiosInstance from '../api/axiosInstance'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'setup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [probing, setProbing] = useState(false)

  const loginStore = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  // Auto-detect if admin exists by trying a dummy setup call
  useEffect(() => {
    let cancelled = false
    async function probe() {
      setProbing(true)
      try {
        // Try setup with empty body to get a quick response shape
        await axiosInstance.post('/auth/setup', { username: '__probe__', password: '__probe__' })
        // 201 means no admin existed — show setup
        if (!cancelled) setMode('setup')
      } catch (err) {
        const status = err.response?.status
        if (status === 409) {
          // "Admin already exists" — show login
          if (!cancelled) setMode('login')
        } else if (status === 422) {
          // Validation error means the route exists and admin may or may not exist
          // Try to distinguish: check detail message
          const detail = err.response?.data?.detail ?? ''
          if (typeof detail === 'string' && detail.includes('Admin already exists')) {
            if (!cancelled) setMode('login')
          } else {
            // Route reachable, no admin yet
            if (!cancelled) setMode('setup')
          }
        } else {
          // Network error or unknown — default to login
          if (!cancelled) setMode('login')
        }
      } finally {
        if (!cancelled) setProbing(false)
      }
    }
    probe()
    return () => { cancelled = true }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    try {
      const data = await login(username, password)
      const token = data.token ?? data.access_token
      const user = data.admin ?? { username }
      loginStore(user, token)
      toast.success('Signed in successfully')
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : 'Invalid username or password'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleSetup(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const data = await setup(username, password)
      const token = data.token ?? data.access_token
      const user = data.admin ?? { username }
      loginStore(user, token)
      toast.success('Admin account created')
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 409) {
        toast.error('Admin already exists. Please sign in instead.')
        setMode('login')
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Setup failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const isSetup = mode === 'setup'

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent)' }}>
            <Bot size={24} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Agent Board
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {probing
                ? 'Connecting...'
                : isSetup
                ? 'Create your admin account'
                : 'Sign in to your workspace'}
            </p>
          </div>
        </div>

        {/* Setup notice */}
        {!probing && isSetup && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg border text-sm"
            style={{
              backgroundColor: 'rgba(245,158,11,0.1)',
              borderColor: 'rgba(245,158,11,0.3)',
              color: 'var(--warning)',
            }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>No admin account found. Set one up to get started.</span>
          </div>
        )}

        {/* Form */}
        {!probing && (
          <form
            onSubmit={isSetup ? handleSetup : handleLogin}
            className="rounded-xl p-6 space-y-4 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            noValidate
          >
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}>
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                placeholder="admin"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 pr-9 rounded-md text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm password (setup only) */}
            {isSetup && (
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="block text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-9 rounded-md text-sm outline-none transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: `1px solid ${confirmPassword && confirmPassword !== password ? 'var(--danger)' : 'var(--border)'}`,
                      color: 'var(--text-primary)',
                    }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>
                    Passwords do not match
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className={clsx(
                'w-full py-2 px-4 rounded-md text-sm font-medium text-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {loading
                ? isSetup ? 'Creating account...' : 'Signing in...'
                : isSetup ? 'Create Account' : 'Sign In'}
            </button>

            {/* Toggle between login/setup */}
            {!isSetup && (
              <p className="text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                No admin account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('setup')}
                  className="underline transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  Set one up
                </button>
              </p>
            )}
            {isSetup && (
              <p className="text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="underline transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  Sign in
                </button>
              </p>
            )}
          </form>
        )}

        {probing && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>
    </div>
  )
}
