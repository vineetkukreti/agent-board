import axiosInstance from './axiosInstance'

export async function getTeams() {
  const { data } = await axiosInstance.get('/teams')
  return data
}

export async function getTeam(id) {
  const { data } = await axiosInstance.get(`/teams/${id}`)
  return data
}

export async function createTeam(teamData) {
  const { data } = await axiosInstance.post('/teams', teamData)
  return data
}

export async function updateTeam(id, teamData) {
  const { data } = await axiosInstance.put(`/teams/${id}`, teamData)
  return data
}

export async function deleteTeam(id) {
  const { data } = await axiosInstance.delete(`/teams/${id}`)
  return data
}

export async function bulkDeleteTeams(data) {
  const { data: resp } = await axiosInstance.post('/teams/bulk/delete', data)
  return resp
}

export async function getTeamMembers(id) {
  const { data } = await axiosInstance.get(`/teams/${id}/members`)
  return data
}

export async function getTeamWorkload(id) {
  const { data } = await axiosInstance.get(`/teams/${id}/workload`)
  return data
}
