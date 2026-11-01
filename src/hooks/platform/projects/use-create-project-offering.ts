'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { ProjectOfferingCreate } from '@/schemas/platform/projects/project-offering.schema';
export function useCreateProjectOffering(projectId: string) {
  return useMutation<unknown, Error, ProjectOfferingCreate>({
    mutationFn: (data) => apiFetch(`/api/platform/projects/${projectId}/payments/offerings`, { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
