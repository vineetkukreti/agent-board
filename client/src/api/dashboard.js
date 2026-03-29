import axiosInstance from './axiosInstance'

export async function getDashboard() {
  const { data } = await axiosInstance.get('/dashboard')
  return data
}
