import axiosInstance from './axiosInstance'

export async function getTickets(params = {}) {
  const { data } = await axiosInstance.get('/tickets', { params })
  return data
}

export async function getTicket(id) {
  const { data } = await axiosInstance.get(`/tickets/${id}`)
  return data
}

export async function createTicket(ticketData) {
  const { data } = await axiosInstance.post('/tickets', ticketData)
  return data
}

export async function updateTicket(id, ticketData) {
  const { data } = await axiosInstance.put(`/tickets/${id}`, ticketData)
  return data
}

export async function deleteTicket(id) {
  const { data } = await axiosInstance.delete(`/tickets/${id}`)
  return data
}

export async function startTicket(id) {
  const { data } = await axiosInstance.post(`/tickets/${id}/start`)
  return data
}

export async function blockTicket(id, blockData) {
  const { data } = await axiosInstance.post(`/tickets/${id}/block`, blockData)
  return data
}

export async function unblockTicket(id, blockerId) {
  const { data } = await axiosInstance.post(`/tickets/${id}/unblock/${blockerId}`)
  return data
}

export async function reviewTicket(id) {
  const { data } = await axiosInstance.post(`/tickets/${id}/review`)
  return data
}

export async function doneTicket(id, doneData = {}) {
  const { data } = await axiosInstance.post(`/tickets/${id}/done`, doneData)
  return data
}

export async function getComments(id) {
  const { data } = await axiosInstance.get(`/tickets/${id}/comments`)
  return data
}

export async function addComment(id, commentData) {
  const { data } = await axiosInstance.post(`/tickets/${id}/comments`, commentData)
  return data
}

export async function getBlockers(id) {
  const { data } = await axiosInstance.get(`/tickets/${id}/blockers`)
  return data
}

export async function addBlocker(id, blockerData) {
  const { data } = await axiosInstance.post(`/tickets/${id}/blockers`, blockerData)
  return data
}

export async function resolveBlocker(ticketId, blockerId) {
  const { data } = await axiosInstance.post(`/tickets/${ticketId}/blockers/${blockerId}/resolve`)
  return data
}

export async function bulkAssign(assignData) {
  const { data } = await axiosInstance.post('/tickets/bulk/assign', assignData)
  return data
}

export async function bulkStatus(statusData) {
  const { data } = await axiosInstance.post('/tickets/bulk/status', statusData)
  return data
}
