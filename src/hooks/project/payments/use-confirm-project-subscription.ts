'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { PaymentConfirmation } from '@/schemas/common/payments/payment-confirmation.schema';
export function useConfirmProjectSubscription(projectId: string) {
  return useMutation<unknown, Error, { id: string } & PaymentConfirmation>({
    mutationFn: ({ id, ...data }) => apiFetch(`/api/project/${projectId}/payments/subscriptions/${id}/confirm`, { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
