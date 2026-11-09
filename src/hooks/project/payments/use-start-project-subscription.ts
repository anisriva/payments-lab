'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { ProjectSubscriptionCreate } from '@/schemas/project/payments/project-subscription.schema';
import type { CheckoutInstruction } from '@/lib/common/payments/core/contracts/checkout';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';
export function useStartProjectSubscription(projectId: string) {
  return useMutation<{ recordId: string; provider: ProviderKey; instruction: CheckoutInstruction }, Error, ProjectSubscriptionCreate>({
    mutationFn: (data) => apiFetch(`/api/project/${projectId}/payments/subscriptions`, { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
