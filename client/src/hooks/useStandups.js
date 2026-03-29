import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submitStandup, getStandups, getStandupSummary } from '../api/standups'

export function useStandups(params = {}) {
  return useQuery({
    queryKey: ['standups', params],
    queryFn: () => getStandups(params),
  })
}

export function useStandupSummary(params = {}) {
  return useQuery({
    queryKey: ['standups', 'summary', params],
    queryFn: () => getStandupSummary(params),
  })
}

export function useSubmitStandup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: submitStandup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standups'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
