'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useReprocessProviderEvent } from '@/hooks/platform/payments/use-reprocess-provider-event';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

export function EventSheet({
  event,
}: {
  event: {
    id: string;
    provider: string;
    scope: string;
    providerEventId: string;
    eventType: string;
    headers: unknown;
    rawBody: string;
    processedAt: string | null;
    note: string | null;
    error: string | null;
    receivedAt: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reprocess = useReprocessProviderEvent();

  const close = () => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete('event');
    router.push(`?${q.toString()}`);
  };

  const prettyJson = (value: unknown): string => {
    if (typeof value === 'string') {
      try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
    }
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {event.eventType}
            <Badge variant="secondary">{event.provider}</Badge>
          </SheetTitle>
          <SheetDescription>
            {event.providerEventId} · scope {event.scope === 'platform' ? 'platform' : `${event.scope.slice(0, 8)}…`} · received {new Date(event.receivedAt).toLocaleString()}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4">
          {event.note && (
            <div>
              <p className="text-sm font-medium">Note</p>
              <p className="text-sm text-muted-foreground">{event.note}</p>
            </div>
          )}
          {event.error && (
            <div>
              <p className="text-sm font-medium">Error</p>
              <p className="text-sm text-destructive">{event.error}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium">Headers</p>
            <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">{prettyJson(event.headers)}</pre>
          </div>
          <div>
            <p className="text-sm font-medium">Raw body</p>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{prettyJson(event.rawBody)}</pre>
          </div>
          <Button
            onClick={() => reprocess.mutate({ id: event.id }, { onSuccess: () => router.refresh() })}
            disabled={reprocess.isPending}
          >
            Reprocess
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
