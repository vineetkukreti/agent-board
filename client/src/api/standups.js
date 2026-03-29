import axiosInstance from './axiosInstance'

export async function submitStandup(standupData) {
  const { data } = await axiosInstance.post('/standups', standupData)
  return data
}

export async function getStandups(params = {}) {
  const { data } = await axiosInstance.get('/standups', { params })
  return data
}

export async function getStandupSummary(params = {}) {
  const { data } = await axiosInstance.get('/standups/summary', { params })
  return data
}
