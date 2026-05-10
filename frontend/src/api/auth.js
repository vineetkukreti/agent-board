import axiosInstance from './axiosInstance'

export async function login(username, password) {
  const { data } = await axiosInstance.post('/auth/login', { username, password })
  return data
}

export async function logout() {
  const { data } = await axiosInstance.post('/auth/logout')
  return data
}

export async function getMe() {
  const { data } = await axiosInstance.get('/auth/me')
  return data
}

export async function setup(username, password) {
  const { data } = await axiosInstance.post('/auth/setup', { username, password })
  return data
}
