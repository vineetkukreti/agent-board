import axiosInstance from './axiosInstance'

export async function getProjects() {
  const { data } = await axiosInstance.get('/projects')
  return data
}

export async function getProject(id) {
  const { data } = await axiosInstance.get(`/projects/${id}`)
  return data
}

export async function createProject(projectData) {
  const { data } = await axiosInstance.post('/projects', projectData)
  return data
}

export async function updateProject(id, projectData) {
  const { data } = await axiosInstance.put(`/projects/${id}`, projectData)
  return data
}

export async function deleteProject(id) {
  const { data } = await axiosInstance.delete(`/projects/${id}`)
  return data
}

export async function getProjectStats(id) {
  const { data } = await axiosInstance.get(`/projects/${id}/stats`)
  return data
}
