const trimTrailingSlash = (value) => value.replace(/\/+$/, '')

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const API_BASE_URL = trimTrailingSlash(rawApiBaseUrl)

export const API_ORIGIN = API_BASE_URL.startsWith('http')
  ? trimTrailingSlash(new URL(API_BASE_URL).origin)
  : window.location.origin

export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || API_ORIGIN
)

export const GITHUB_WEBHOOK_URL = `${API_ORIGIN}/api/v1/webhooks/github`
