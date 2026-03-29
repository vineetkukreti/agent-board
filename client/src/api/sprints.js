import axiosInstance from './axiosInstance'

export async function getSprints(params = {}) {
  const { data } = await axiosInstance.get('/sprints', { params })
  return data
}

export async function getSprint(id) {
  const { data } = await axiosInstance.get(`/sprints/${id}`)
  return data
}

export async function createSprint(sprintData) {
  const { data } = await axiosInstance.post('/sprints', sprintData)
  return data
}

export async function updateSprint(id, sprintData) {
  const { data } = await axiosInstance.put(`/sprints/${id}`, sprintData)
  return data
}

export async function activateSprint(id) {
  const { data } = await axiosInstance.post(`/sprints/${id}/activate`)
  return data
}

export async function completeSprint(id) {
  const { data } = await axiosInstance.post(`/sprints/${id}/complete`)
  return data
}

export async function getSprintBoard(id) {
  const { data } = await axiosInstance.get(`/sprints/${id}/board`)
  return data
}
