'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';

export function useRefreshCreditPurchase() {
  return useMutation<unknown, Error, { id: string }>({
    mutationFn: ({ id }) => apiFetch(`/api/platform/payments/credit-purchases/${id}/refresh`, { method: 'POST' }),
    onSuccess: () => toast('Status refreshed'),
    onError: (e) => toast.error(e.message),
  });
}
