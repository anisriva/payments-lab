'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { PlanPriceUpdate } from '@/schemas/platform/catalog/plan-price.schema';
export function useUpdatePlanPrice(id: string) {
  return useMutation<unknown, Error, PlanPriceUpdate>({
    mutationFn: (data) => apiFetch(`/api/platform/catalog/plan-prices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
