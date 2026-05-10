import { useQuery } from '@tanstack/react-query'
import { getActivity } from '../api/activity'

export function useActivity(params = {}) {
  return useQuery({
    queryKey: ['activity', params],
    queryFn: () => getActivity(params),
  })
}
