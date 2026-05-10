import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAgents,
  getAgent,
  registerAgent,
  updateAgent,
  heartbeat,
  rotateKey,
  bulkDeleteAgents,
  getAgentPerformance,
  getAgentLeaderboard,
  getAgentSparkline,
} from '../api/agents'

export function useAgents(params = {}) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: () => getAgents(params),
  })
}

export function useAgent(id) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => getAgent(id),
    enabled: !!id,
  })
}

export function useRegisterAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: registerAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateAgent(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['agents', id] })
    },
  })
}

export function useHeartbeat() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => heartbeat(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['agents', id] })
    },
  })
}

export function useRotateKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => rotateKey(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['agents', id] })
    },
  })
}

export function useBulkDeleteAgents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkDeleteAgents,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useAgentPerformance(id) {
  return useQuery({
    queryKey: ['agents', id, 'performance'],
    queryFn: () => getAgentPerformance(id),
    enabled: !!id,
  })
}

export function useAgentLeaderboard() {
  return useQuery({
    queryKey: ['agent-leaderboard'],
    queryFn: getAgentLeaderboard,
  })
}

export function useAgentSparkline(agentId) {
  return useQuery({
    queryKey: ['agent-sparkline', agentId],
    queryFn: () => getAgentSparkline(agentId),
    enabled: !!agentId,
  })
}
