'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { ProviderSettingUpdate } from '@/schemas/platform/catalog/provider-setting.schema';
export function useUpdateProviderSetting(provider: string, flow: string) {
  return useMutation<unknown, Error, ProviderSettingUpdate>({
    mutationFn: (data) => apiFetch(`/api/platform/payments/provider-settings/${flow}/${provider}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => toast('Provider settings saved'),
    onError: (e) => toast.error(e.message),
  });
}
