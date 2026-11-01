'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { CreditRateCreate } from '@/schemas/platform/catalog/credit-rate.schema';
export function useCreateCreditRate() {
  return useMutation<unknown, Error, CreditRateCreate>({
    mutationFn: (data) => apiFetch('/api/platform/catalog/credit-rates', { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
