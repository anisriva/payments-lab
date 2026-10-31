'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { PaymentConnectionCreate } from '@/schemas/platform/projects/payment-connection.schema';
export function useConnectPaymentGateway(projectId: string) {
  return useMutation<unknown, Error, PaymentConnectionCreate>({
    mutationFn: (data) => apiFetch(`/api/platform/projects/${projectId}/payments/connections`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => toast('Gateway connected'),
    onError: (e) => toast.error(e.message),
  });
}
