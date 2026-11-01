export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/common/connectors/prisma';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import { listProviders, isProviderKey } from '@/lib/common/payments/core/factory';
import { parseOptionalString, parsePositivePage } from '@/lib/common/helpers/url-parsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SSRPagination } from '@/components/common/navigation/pagination';
import { EventFilters } from '@/components/platform/payments/event-filters';
import { EventRow } from '@/components/platform/payments/event-row';
import { EventSheetLoader } from '@/components/platform/payments/event-sheet-loader';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const PLATFORM_TABS = [
  { href: '/platform/checkout/auto', label: 'Checkout' },
  { href: '/platform/plans', label: 'Plans & credits' },
  { href: '/platform/providers', label: 'Providers' },
  { href: '/platform/rubric', label: 'Rubric' },
  { href: '/platform/events', label: 'Events' },
];

export default async function PlatformEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const providerParam = parseOptionalString(query.provider);
  const provider = providerParam && isProviderKey(providerParam) ? providerParam : undefined;
  const eventId = parseOptionalString(query.event);
  const page = parsePositivePage(query.page);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
      <LinkTabs items={PLATFORM_TABS} />
        <p className="text-muted-foreground">Webhook events received for Folio&apos;s own checkout.</p>
      </div>
      <EventFilters
        provider={provider ?? ''}
        providers={listProviders().map((p) => ({ key: p.key, label: p.label }))}
      />
      <Suspense key={`${provider}-${page}`} fallback={<Skeleton className="h-64" />}>
        <EventsTable provider={provider} page={page} query={query} />
      </Suspense>
      {eventId && (
        <Suspense fallback={null}>
          <EventSheetLoader id={eventId} />
        </Suspense>
      )}
    </div>
  );
}

async function EventsTable({
  provider,
  page,
  query,
}: {
  provider?: 'razorpay' | 'dodo' | 'stripe' | 'paypal';
  page: number;
  query: Record<string, string | string[] | undefined>;
}) {
  const service = new PaymentWebhookService(prisma);
  const events = await service.listEvents({ provider, scope: 'platform', pagination: { page, limit: 10 } });

  return (
    <Card>
      <CardHeader><CardTitle>Events</CardTitle><CardDescription>Click a row to inspect its payload</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead><TableHead>Provider</TableHead>
              <TableHead>Event type</TableHead><TableHead>Processed</TableHead><TableHead>Note / Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.data.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No events yet</TableCell></TableRow>}
            {events.data.map((e) => (
              <EventRow key={e.id} id={e.id}>
                <TableCell>{e.receivedAt.toLocaleString()}</TableCell>
                <TableCell>{e.provider}</TableCell>
                <TableCell>{e.eventType}</TableCell>
                <TableCell>{e.processedAt ? e.processedAt.toLocaleString() : '—'}</TableCell>
                <TableCell className="max-w-48 truncate">{e.note ?? e.error ?? '—'}</TableCell>
              </EventRow>
            ))}
          </TableBody>
        </Table>
        <SSRPagination pathname="/platform/events" searchParams={query} currentPage={events.meta.page} totalPages={events.meta.totalPages} pageParam="page" />
      </CardContent>
    </Card>
  );
}
