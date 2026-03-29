import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSprints,
  getSprint,
  createSprint,
  updateSprint,
  activateSprint,
  completeSprint,
  getSprintBoard,
} from '../api/sprints'

export function useSprints(params = {}) {
  return useQuery({
    queryKey: ['sprints', params],
    queryFn: () => getSprints(params),
  })
}

export function useSprint(id) {
  return useQuery({
    queryKey: ['sprints', id],
    queryFn: () => getSprint(id),
    enabled: !!id,
  })
}

export function useSprintBoard(id) {
  return useQuery({
    queryKey: ['sprints', id, 'board'],
    queryFn: () => getSprintBoard(id),
    enabled: !!id,
  })
}

export function useCreateSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] })
    },
  })
}

export function useUpdateSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateSprint(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] })
      queryClient.invalidateQueries({ queryKey: ['sprints', id] })
    },
  })
}

export function useActivateSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: activateSprint,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] })
      queryClient.invalidateQueries({ queryKey: ['sprints', id] })
    },
  })
}

export function useCompleteSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: completeSprint,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] })
      queryClient.invalidateQueries({ queryKey: ['sprints', id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
