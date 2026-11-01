'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
export function useDeleteProjectOffering(projectId: string, offeringId: string) {
  return useMutation<unknown, Error, void>({
    mutationFn: () => apiFetch(`/api/platform/projects/${projectId}/payments/offerings/${offeringId}`, { method: 'DELETE' }),
    onError: (e) => toast.error(e.message),
  });
}
