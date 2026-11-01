'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { ProjectUpdate } from '@/schemas/platform/projects/project.schema';
export function useUpdateProject(id: string) {
  return useMutation<unknown, Error, ProjectUpdate>({
    mutationFn: (data) => apiFetch(`/api/platform/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
