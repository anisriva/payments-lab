'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { CreditRateUpdate } from '@/schemas/platform/catalog/credit-rate.schema';
export function useUpdateCreditRate(id: string) {
  return useMutation<unknown, Error, CreditRateUpdate>({
    mutationFn: (data) => apiFetch(`/api/platform/catalog/credit-rates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
