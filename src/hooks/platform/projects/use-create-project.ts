'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { ProjectCreate } from '@/schemas/platform/projects/project.schema';
export function useCreateProject() {
  return useMutation<unknown, Error, ProjectCreate>({
    mutationFn: (data) => apiFetch('/api/platform/projects', { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
