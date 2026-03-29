import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  getTeamWorkload,
} from '../api/teams'

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  })
}

export function useTeam(id) {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: () => getTeam(id),
    enabled: !!id,
  })
}

export function useTeamMembers(id) {
  return useQuery({
    queryKey: ['teams', id, 'members'],
    queryFn: () => getTeamMembers(id),
    enabled: !!id,
  })
}

export function useTeamWorkload(id) {
  return useQuery({
    queryKey: ['teams', id, 'workload'],
    queryFn: () => getTeamWorkload(id),
    enabled: !!id,
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export function useUpdateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateTeam(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['teams', id] })
    },
  })
}

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}
