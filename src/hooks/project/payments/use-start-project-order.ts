'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { ProjectOrderCreate } from '@/schemas/project/payments/project-order.schema';
import type { CheckoutInstruction } from '@/lib/common/payments/core/types';
export function useStartProjectOrder(projectId: string) {
  return useMutation<{ recordId: string; instruction: CheckoutInstruction }, Error, ProjectOrderCreate>({
    mutationFn: (data) => apiFetch(`/api/project/${projectId}/payments/orders`, { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
