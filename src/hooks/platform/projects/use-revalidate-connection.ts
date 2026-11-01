'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
export function useRevalidateConnection(projectId: string) {
  return useMutation<unknown, Error, { connectionId: string }>({
    mutationFn: ({ connectionId }) => apiFetch(`/api/platform/projects/${projectId}/payments/connections/${connectionId}/revalidate`, { method: 'POST' }),
    onSuccess: () => toast('Revalidated'),
    onError: (e) => toast.error(e.message),
  });
}
