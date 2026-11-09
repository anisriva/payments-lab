'use client';
import { Button } from '@/components/ui/button';
import { useCheckoutFlow } from '@/hooks/common/payments/use-checkout-flow';
import { useStartPlatformSubscription } from '@/hooks/platform/payments/use-start-platform-subscription';
import { useConfirmPlatformSubscription } from '@/hooks/platform/payments/use-confirm-platform-subscription';

export function SubscribeButton({ gateway, payer, projectId, planPriceId }: { gateway: string; payer: string; projectId: string; planPriceId: string }) {
  const startSub = useStartPlatformSubscription();
  const confirmSub = useConfirmPlatformSubscription();
  const flow = useCheckoutFlow();
  return (
    <Button size="sm" disabled={startSub.isPending} onClick={() =>
      flow.run({
        start: () => startSub.mutateAsync({ projectId, gateway, payerCountry: payer, planPriceId }),
        confirm: confirmSub.mutateAsync,
        recordUrl: (id) => `/api/platform/payments/subscriptions/${id}`,
      })
    }>Subscribe</Button>
  );
}
