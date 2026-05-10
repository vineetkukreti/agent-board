import { useQuery } from '@tanstack/react-query'
import { getTicketMetrics, getTrackingOverview, getTicketChanges, getTicketTrace } from '../api/tracking'

export function useTicketMetrics(ticketId) {
  return useQuery({
    queryKey: ['ticket-metrics', ticketId],
    queryFn: () => getTicketMetrics(ticketId),
    enabled: !!ticketId,
  })
}

export function useTrackingOverview() {
  return useQuery({
    queryKey: ['tracking-overview'],
    queryFn: getTrackingOverview,
    refetchInterval: 30000,
  })
}

export function useTicketChanges(ticketId) {
  return useQuery({
    queryKey: ['ticket-changes', ticketId],
    queryFn: () => getTicketChanges(ticketId),
    enabled: !!ticketId,
  })
}

export function useTicketTrace(ticketId) {
  return useQuery({
    queryKey: ['ticket-trace', ticketId],
    queryFn: () => getTicketTrace(ticketId),
    enabled: !!ticketId,
  })
}
