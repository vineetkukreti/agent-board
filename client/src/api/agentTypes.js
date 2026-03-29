import axiosInstance from './axiosInstance'

export async function getAgentTypes() {
  const { data } = await axiosInstance.get('/agent-types')
  return data
}

export async function createAgentType(typeData) {
  const { data } = await axiosInstance.post('/agent-types', typeData)
  return data
}

export async function updateAgentType(id, typeData) {
  const { data } = await axiosInstance.put(`/agent-types/${id}`, typeData)
  return data
}

export async function deleteAgentType(id) {
  const { data } = await axiosInstance.delete(`/agent-types/${id}`)
  return data
}
