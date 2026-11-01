'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { ProjectOfferingUpdate } from '@/schemas/platform/projects/project-offering.schema';
export function useUpdateProjectOffering(projectId: string, offeringId: string) {
  return useMutation<unknown, Error, ProjectOfferingUpdate>({
    mutationFn: (data) => apiFetch(`/api/platform/projects/${projectId}/payments/offerings/${offeringId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
