'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
export function useDeletePlanPrice(id: string) {
  return useMutation<unknown, Error, void>({
    mutationFn: () => apiFetch(`/api/platform/catalog/plan-prices/${id}`, { method: 'DELETE' }),
    onError: (e) => toast.error(e.message),
  });
}
