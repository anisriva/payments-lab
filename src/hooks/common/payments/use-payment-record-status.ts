'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/common/utils/api-fetch';

export function usePaymentRecordStatus(url: string | null) {
  return useQuery<{ status: string } & Record<string, unknown>, Error>({
    queryKey: ['payment-record', url],
    queryFn: () => apiFetch(url!),
    enabled: !!url,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && query.state.dataUpdateCount < 15 ? 2000 : false,
  });
}
