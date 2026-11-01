'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { PlanPriceCreate } from '@/schemas/platform/catalog/plan-price.schema';
export function useCreatePlanPrice() {
  return useMutation<unknown, Error, PlanPriceCreate>({
    mutationFn: (data) => apiFetch('/api/platform/catalog/plan-prices', { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
