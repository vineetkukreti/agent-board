import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAgentTypes,
  createAgentType,
  updateAgentType,
  deleteAgentType,
} from '../api/agentTypes'

export function useAgentTypes() {
  return useQuery({
    queryKey: ['agentTypes'],
    queryFn: getAgentTypes,
  })
}

export function useCreateAgentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAgentType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentTypes'] })
    },
  })
}

export function useUpdateAgentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateAgentType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentTypes'] })
    },
  })
}

export function useDeleteAgentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAgentType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentTypes'] })
    },
  })
}
