'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useRefreshCreditPurchase, useRefreshPlatformSubscription, useCancelPlatformSubscription } from '@/hooks/platform/payments/mutations';

export function RefreshPurchaseButton({ id }: { id: string }) {
  const router = useRouter();
  const m = useRefreshCreditPurchase();
  return <Button variant="ghost" size="sm" disabled={m.isPending} onClick={() => m.mutate({ id }, { onSuccess: () => router.refresh() })}>↻</Button>;
}
export function RefreshSubscriptionButton({ id }: { id: string }) {
  const router = useRouter();
  const m = useRefreshPlatformSubscription();
  return <Button variant="ghost" size="sm" disabled={m.isPending} onClick={() => m.mutate({ id }, { onSuccess: () => router.refresh() })}>↻</Button>;
}
export function CancelSubscriptionButton({ id }: { id: string }) {
  const router = useRouter();
  const m = useCancelPlatformSubscription();
  return <Button variant="ghost" size="sm" disabled={m.isPending} onClick={() => m.mutate({ id, atCycleEnd: false }, { onSuccess: () => router.refresh() })}>Cancel</Button>;
}
