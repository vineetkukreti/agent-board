import axiosInstance from './axiosInstance'

export async function getAgents(params = {}) {
  const { data } = await axiosInstance.get('/agents', { params })
  return data
}

export async function getAgent(id) {
  const { data } = await axiosInstance.get(`/agents/${id}`)
  return data
}

export async function registerAgent(agentData) {
  const { data } = await axiosInstance.post('/agents', agentData)
  return data
}

export async function updateAgent(id, agentData) {
  const { data } = await axiosInstance.put(`/agents/${id}`, agentData)
  return data
}

export async function heartbeat(id) {
  const { data } = await axiosInstance.post(`/agents/${id}/heartbeat`)
  return data
}

export async function rotateKey(id) {
  const { data } = await axiosInstance.post(`/agents/${id}/rotate-key`)
  return data
}
