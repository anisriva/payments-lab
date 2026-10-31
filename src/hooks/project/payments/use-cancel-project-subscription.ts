'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { SubscriptionCancel } from '@/schemas/platform/payments/subscription.schema';
export function useCancelProjectSubscription(projectId: string) {
  return useMutation<unknown, Error, { id: string } & SubscriptionCancel>({
    mutationFn: ({ id, ...data }) => apiFetch(`/api/project/${projectId}/payments/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => toast('Subscription cancelled'),
    onError: (e) => toast.error(e.message),
  });
}
