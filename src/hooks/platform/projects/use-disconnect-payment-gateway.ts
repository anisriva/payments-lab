'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
export function useDisconnectPaymentGateway(projectId: string) {
  return useMutation<null, Error, { connectionId: string }>({
    mutationFn: ({ connectionId }) => apiFetch(`/api/platform/projects/${projectId}/payments/connections/${connectionId}`, { method: 'DELETE' }),
    onSuccess: () => toast('Gateway disconnected'),
    onError: (e) => toast.error(e.message),
  });
}
