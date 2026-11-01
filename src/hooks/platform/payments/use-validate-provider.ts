'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
export function useValidateProvider(provider: string) {
  return useMutation<unknown, Error, void>({
    mutationFn: () => apiFetch(`/api/platform/payments/providers/${provider}/validate`, { method: 'POST' }),
    onSuccess: () => toast('Provider validated'),
    onError: (e) => toast.error(e.message),
  });
}
