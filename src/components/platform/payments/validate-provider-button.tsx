'use client';
import { useRouter } from 'next/navigation';
import { useValidateProvider } from '@/hooks/platform/payments/use-validate-provider';
import { Button } from '@/components/ui/button';
export function ValidateProviderButton({ provider }: { provider: string }) {
  const router = useRouter();
  const m = useValidateProvider(provider);
  return <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => router.refresh() })}>Validate &amp; register webhook</Button>;
}
