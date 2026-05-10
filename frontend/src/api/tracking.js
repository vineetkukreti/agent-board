import axiosInstance from './axiosInstance'

export async function getTicketMetrics(ticketId) {
  const { data } = await axiosInstance.get(`/tracking/tickets/${ticketId}/metrics`)
  return data
}

export async function getTrackingOverview() {
  const { data } = await axiosInstance.get('/tracking/overview')
  return data
}

export async function getTicketChanges(ticketId) {
  const { data } = await axiosInstance.get(`/tracking/tickets/${ticketId}/changes`)
  return data
}

export async function getTicketTrace(ticketId) {
  const { data } = await axiosInstance.get(`/tracking/tickets/${ticketId}/trace`)
  return data
}
