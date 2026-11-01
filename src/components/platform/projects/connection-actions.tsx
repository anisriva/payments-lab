'use client';
import { useRouter } from 'next/navigation';
import { useRevalidateConnection } from '@/hooks/platform/projects/use-revalidate-connection';
import { useDisconnectPaymentGateway } from '@/hooks/platform/projects/use-disconnect-payment-gateway';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function RevalidateButton({ projectId, connectionId }: { projectId: string; connectionId: string }) {
  const router = useRouter();
  const m = useRevalidateConnection(projectId);
  return (
    <Button variant="outline" size="sm" disabled={m.isPending}
      onClick={() => m.mutate({ connectionId }, { onSuccess: () => router.refresh() })}>
      Revalidate
    </Button>
  );
}

export function DisconnectDialogButton({ projectId, connectionId }: { projectId: string; connectionId: string }) {
  const router = useRouter();
  const m = useDisconnectPaymentGateway(projectId);
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>Disconnect</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect this provider?</AlertDialogTitle>
          <AlertDialogDescription>
            Payments stop and the webhook is disabled. Razorpay doesn&apos;t allow deleting webhooks — delete it in your Razorpay dashboard if you won&apos;t reconnect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => m.mutate({ connectionId }, { onSuccess: () => router.refresh() })}
            disabled={m.isPending}
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
