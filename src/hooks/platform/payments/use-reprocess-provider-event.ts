'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';

export function useReprocessProviderEvent() {
  return useMutation<null, Error, { id: string }>({
    mutationFn: ({ id }) => apiFetch(`/api/platform/payments/events/${id}/reprocess`, { method: 'POST' }),
    onError: (e) => toast.error(e.message),
  });
}
