import { Badge } from '@/components/ui/badge';

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'paid' || status === 'active'
      ? 'default'
      : status === 'pending'
        ? 'secondary'
        : status === 'failed' || status === 'halted'
          ? 'destructive'
          : 'outline';
  return <Badge variant={variant}>{status}</Badge>;
}
