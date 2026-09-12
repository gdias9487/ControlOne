import { useQuery } from '@tanstack/react-query';
import { unwrapApi } from '@/utils';

export function useAccessStatus() {
  return useQuery({
    queryKey: ['access-status'],
    queryFn: async () => unwrapApi(await window.cleideApi.access.status()),
  });
}
