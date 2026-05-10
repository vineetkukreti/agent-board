import axiosInstance from './axiosInstance'

export async function getActivity(params = {}) {
  const { data } = await axiosInstance.get('/activity', { params })
  return data
}
