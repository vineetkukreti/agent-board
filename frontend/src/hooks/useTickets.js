import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  startTicket,
  blockTicket,
  unblockTicket,
  reviewTicket,
  doneTicket,
  getComments,
  addComment,
  getBlockers,
  addBlocker,
  resolveBlocker,
  bulkAssign,
  bulkStatus,
  bulkDelete,
} from '../api/tickets'

export function useTickets(params = {}) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: () => getTickets(params),
  })
}

export function useTicket(id) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => getTicket(id),
    enabled: !!id,
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateTicket(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useStartTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startTicket,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
    },
  })
}

export function useBlockTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => blockTicket(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
    },
  })
}

export function useUnblockTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, blockerId }) => unblockTicket(id, blockerId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
    },
  })
}

export function useReviewTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reviewTicket,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
    },
  })
}

export function useDoneTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => doneTicket(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['tickets', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useComments(ticketId) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'comments'],
    queryFn: () => getComments(ticketId),
    enabled: !!ticketId,
  })
}

export function useAddComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => addComment(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', id, 'comments'] })
    },
  })
}

export function useBlockers(ticketId) {
  return useQuery({
    queryKey: ['tickets', ticketId, 'blockers'],
    queryFn: () => getBlockers(ticketId),
    enabled: !!ticketId,
  })
}

export function useAddBlocker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => addBlocker(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', id, 'blockers'] })
    },
  })
}

export function useResolveBlocker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, blockerId }) => resolveBlocker(ticketId, blockerId),
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId, 'blockers'] })
    },
  })
}

export function useBulkAssign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkAssign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useBulkStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useBulkDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
