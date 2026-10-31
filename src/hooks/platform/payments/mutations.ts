'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { CreditPurchaseCreate } from '@/schemas/platform/payments/credit-purchase.schema';
import type { PlatformSubscriptionCreate, SubscriptionCancel } from '@/schemas/platform/payments/subscription.schema';
import type { PaymentConfirmation } from '@/schemas/common/payments/payment-confirmation.schema';
import type { CheckoutInstruction } from '@/lib/common/payments/core/types';

interface StartResult { recordId: string; instruction: CheckoutInstruction }

export function useStartCreditPurchase() {
  return useMutation<StartResult, Error, CreditPurchaseCreate>({
    mutationFn: (data) => apiFetch('/api/platform/payments/credit-purchases', { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}

export function useStartPlatformSubscription() {
  return useMutation<StartResult, Error, PlatformSubscriptionCreate>({
    mutationFn: (data) => apiFetch('/api/platform/payments/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}

export function useConfirmCreditPurchase() {
  return useMutation<unknown, Error, { id: string } & PaymentConfirmation>({
    mutationFn: ({ id, ...data }) => apiFetch(`/api/platform/payments/credit-purchases/${id}/confirm`, { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}

export function useConfirmPlatformSubscription() {
  return useMutation<unknown, Error, { id: string } & PaymentConfirmation>({
    mutationFn: ({ id, ...data }) => apiFetch(`/api/platform/payments/subscriptions/${id}/confirm`, { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}

export function useRefreshCreditPurchase() {
  return useMutation<unknown, Error, { id: string }>({
    mutationFn: ({ id }) => apiFetch(`/api/platform/payments/credit-purchases/${id}/refresh`, { method: 'POST' }),
    onSuccess: () => toast('Status refreshed'),
    onError: (e) => toast.error(e.message),
  });
}

export function useRefreshPlatformSubscription() {
  return useMutation<unknown, Error, { id: string }>({
    mutationFn: ({ id }) => apiFetch(`/api/platform/payments/subscriptions/${id}/refresh`, { method: 'POST' }),
    onSuccess: () => toast('Status refreshed'),
    onError: (e) => toast.error(e.message),
  });
}

export function useCancelPlatformSubscription() {
  return useMutation<unknown, Error, { id: string } & SubscriptionCancel>({
    mutationFn: ({ id, ...data }) => apiFetch(`/api/platform/payments/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => toast('Subscription cancelled'),
    onError: (e) => toast.error(e.message),
  });
}

export function useReprocessProviderEvent() {
  return useMutation<null, Error, { id: string }>({
    mutationFn: ({ id }) => apiFetch(`/api/platform/payments/events/${id}/reprocess`, { method: 'POST' }),
    onError: (e) => toast.error(e.message),
  });
}
