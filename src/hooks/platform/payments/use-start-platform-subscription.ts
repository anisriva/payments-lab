'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { PlatformSubscriptionCreate } from '@/schemas/platform/payments/subscription.schema';
import type { CheckoutInstruction } from '@/lib/common/payments/core/contracts/checkout';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';

interface StartResult { recordId: string; provider: ProviderKey; instruction: CheckoutInstruction }
export function useStartPlatformSubscription() {
  return useMutation<StartResult, Error, PlatformSubscriptionCreate>({
    mutationFn: (data) => apiFetch('/api/platform/payments/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
