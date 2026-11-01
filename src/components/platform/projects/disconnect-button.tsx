'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDisconnectPaymentGateway } from '@/hooks/platform/projects/use-disconnect-payment-gateway';
export function DisconnectButton({ projectId, connectionId }: { projectId: string; connectionId: string }) {
  const router = useRouter();
  const m = useDisconnectPaymentGateway(projectId);
  return <Button variant="outline" size="sm" disabled={m.isPending} onClick={() => m.mutate({ connectionId }, { onSuccess: () => router.refresh() })}>Disconnect</Button>;
}
