'use client';
import { useRouter } from 'next/navigation';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRefreshProjectOrder } from '@/hooks/project/payments/use-refresh-project-order';
import { useRefreshProjectSubscription } from '@/hooks/project/payments/use-refresh-project-subscription';
import { useCancelProjectSubscription } from '@/hooks/project/payments/use-cancel-project-subscription';

export function RefreshProjectOrderButton({ projectId, id }: { projectId: string; id: string }) {
  const router = useRouter();
  const m = useRefreshProjectOrder(projectId);
  return (
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={m.isPending}
      onClick={() => m.mutate({ id }, { onSuccess: () => router.refresh() })}><RefreshCw /></Button>} />
    <TooltipContent>Refresh status</TooltipContent></Tooltip>
  );
}
export function RefreshProjectSubscriptionButton({ projectId, id }: { projectId: string; id: string }) {
  const router = useRouter();
  const m = useRefreshProjectSubscription(projectId);
  return (
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={m.isPending}
      onClick={() => m.mutate({ id }, { onSuccess: () => router.refresh() })}><RefreshCw /></Button>} />
    <TooltipContent>Refresh status</TooltipContent></Tooltip>
  );
}
export function CancelProjectSubscriptionButton({ projectId, id }: { projectId: string; id: string }) {
  const router = useRouter();
  const m = useCancelProjectSubscription(projectId);
  return (
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" disabled={m.isPending}
      onClick={() => m.mutate({ id, atCycleEnd: false }, { onSuccess: () => router.refresh() })}><X /></Button>} />
    <TooltipContent>Cancel immediately</TooltipContent></Tooltip>
  );
}
