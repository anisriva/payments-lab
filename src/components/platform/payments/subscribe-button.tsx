'use client';
import { Button } from '@/components/ui/button';
import { useCheckoutFlow } from '@/hooks/common/payments/use-checkout-flow';
import { useStartPlatformSubscription, useConfirmPlatformSubscription } from '@/hooks/platform/payments/mutations';

export function SubscribeButton({ gateway, payer, planPriceId }: { gateway: string; payer: string; planPriceId: string }) {
  const startSub = useStartPlatformSubscription();
  const confirmSub = useConfirmPlatformSubscription();
  const flow = useCheckoutFlow();
  return (
    <Button size="sm" disabled={startSub.isPending} onClick={() =>
      flow.run({
        start: () => startSub.mutateAsync({ gateway, payerCountry: payer, planPriceId }),
        confirm: confirmSub.mutateAsync,
        recordUrl: (id) => `/api/platform/payments/subscriptions/${id}`,
      })
    }>Subscribe</Button>
  );
}
