'use client';
import { useRouter } from 'next/navigation';
import { Clock, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRefreshCreditPurchase } from '@/hooks/platform/payments/use-refresh-credit-purchase';
import { useRefreshPlatformSubscription } from '@/hooks/platform/payments/use-refresh-platform-subscription';
import { useCancelPlatformSubscription } from '@/hooks/platform/payments/use-cancel-platform-subscription';

export function RefreshPurchaseButton({ id }: { id: string }) {
  const router = useRouter();
  const m = useRefreshCreditPurchase();
  return (
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={m.isPending}
      onClick={() => m.mutate({ id }, { onSuccess: () => router.refresh() })}><RefreshCw /></Button>} />
    <TooltipContent>Refresh status</TooltipContent></Tooltip>
  );
}
export function RefreshSubscriptionButton({ id }: { id: string }) {
  const router = useRouter();
  const m = useRefreshPlatformSubscription();
  return (
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={m.isPending}
      onClick={() => m.mutate({ id }, { onSuccess: () => router.refresh() })}><RefreshCw /></Button>} />
    <TooltipContent>Refresh status</TooltipContent></Tooltip>
  );
}
export function CancelSubscriptionButton({ id, canCancelAtPeriodEnd = true }: { id: string; canCancelAtPeriodEnd?: boolean }) {
  const router = useRouter();
  const m = useCancelPlatformSubscription();
  return (
    <span className="flex gap-1">
      <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={m.isPending}
        onClick={() => m.mutate({ id, atCycleEnd: false }, { onSuccess: () => router.refresh() })}><X /></Button>} />
      <TooltipContent>Cancel immediately</TooltipContent></Tooltip>
      {canCancelAtPeriodEnd && (
        <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={m.isPending}
          onClick={() => m.mutate({ id, atCycleEnd: true }, { onSuccess: () => router.refresh() })}><Clock /></Button>} />
        <TooltipContent>Cancel at period end</TooltipContent></Tooltip>
      )}
    </span>
  );
}

export function RefundButton({ id }: { id: string }) {
  // Rendered only when the row's provider manifest declares refund.create.
  return (
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon"><RefreshCw /></Button>} />
    <TooltipContent>Refund payment {id}</TooltipContent></Tooltip>
  );
}
