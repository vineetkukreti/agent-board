import axiosInstance from './axiosInstance'

export async function getUsers() {
  const { data } = await axiosInstance.get('/auth/users')
  return data
}

export async function createUser(userData) {
  const { data } = await axiosInstance.post('/auth/users', userData)
  return data
}

export async function updateUser(id, userData) {
  const { data } = await axiosInstance.put(`/auth/users/${id}`, userData)
  return data
}

export async function deleteUser(id) {
  const { data } = await axiosInstance.delete(`/auth/users/${id}`)
  return data
}
