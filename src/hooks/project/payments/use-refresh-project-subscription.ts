'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
export function useRefreshProjectSubscription(projectId: string) {
  return useMutation<unknown, Error, { id: string }>({
    mutationFn: ({ id }) => apiFetch(`/api/project/${projectId}/payments/subscriptions/${id}/refresh`, { method: 'POST' }),
    onSuccess: () => toast('Status refreshed'),
    onError: (e) => toast.error(e.message),
  });
}
