export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/common/connectors/prisma';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import { listManifests, isProviderKey } from '@/lib/common/payments/core/registry.server';
import { parseOptionalString, parsePositivePage } from '@/lib/common/helpers/url-parsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SSRPagination } from '@/components/common/navigation/pagination';
import { EventFilters } from '@/components/platform/payments/event-filters';
import { EventRow } from '@/components/platform/payments/event-row';
import { EventSheetLoader } from '@/components/platform/payments/event-sheet-loader';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Prisma } from '@/generated/prisma';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const BYOP_TABS = [
  { href: '/byop/projects', label: 'Projects' },
  { href: '/byop/providers', label: 'Providers' },
  { href: '/byop/rubric', label: 'Rubric' },
  { href: '/byop/events', label: 'Events' },
];

export default async function ByopEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const providerParam = parseOptionalString(query.provider);
  const provider = providerParam && isProviderKey(providerParam) ? providerParam : undefined;
  const projectId = parseOptionalString(query.project);
  const eventId = parseOptionalString(query.event);
  const page = parsePositivePage(query.page);

  const projects = await prisma.project.findMany({
    where: { connections: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // scope = connection id. Filter events to connections (of the selected project if given).
  const where: Prisma.ProjectPaymentConnectionWhereInput = projectId ? { projectId } : {};
  const connections = await prisma.projectPaymentConnection.findMany({ where, select: { id: true, projectId: true } });
  const projectNameByConnection = new Map(
    connections.map((c) => [c.id, projects.find((p) => p.id === c.projectId)?.name ?? c.projectId])
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
      <LinkTabs items={BYOP_TABS} />
        <p className="text-muted-foreground">Webhook events received for creator projects.</p>
      </div>
      <EventFilters
        provider={provider ?? ''}
        providers={listManifests().map((m) => ({ key: m.key, label: m.brand.name }))}
        projects={projects}
        projectId={projectId}
      />
      <Suspense key={`${provider}-${projectId}-${page}`} fallback={<Skeleton className="h-64" />}>
        <EventsTable provider={provider} connectionIds={connections.map((c) => c.id)} nameFor={projectNameByConnection} page={page} query={query} />
      </Suspense>
      {eventId && (
        <Suspense fallback={null}>
          <EventSheetLoader id={eventId} audience="project" />
        </Suspense>
      )}
    </div>
  );
}

async function EventsTable({
  provider,
  connectionIds,
  nameFor,
  page,
  query,
}: {
  provider?: 'razorpay' | 'dodo' | 'stripe' | 'paypal';
  connectionIds: string[];
  nameFor: Map<string, string>;
  page: number;
  query: Record<string, string | string[] | undefined>;
}) {
  const service = new PaymentWebhookService(prisma);
  const events = connectionIds.length === 0
    ? { data: [], meta: { page: 1, totalPages: 1 } }
    : await service.listProjectEvents({ provider, connectionIds, pagination: { page, limit: 10 } });

  return (
    <Card>
      <CardHeader><CardTitle>Events</CardTitle><CardDescription>Click a row to inspect its payload</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead><TableHead>Provider</TableHead><TableHead>Project</TableHead>
              <TableHead>Event type</TableHead><TableHead>Processed</TableHead><TableHead>Note / Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.data.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No events yet</TableCell></TableRow>}
            {events.data.map((e) => (
              <EventRow key={e.id} id={e.id}>
                <TableCell>{e.receivedAt.toLocaleString()}</TableCell>
                <TableCell>{e.provider}</TableCell>
                <TableCell>{nameFor.get(e.connectionId) ?? e.connectionId.slice(0, 8)}</TableCell>
                <TableCell>{e.eventType}</TableCell>
                <TableCell>{e.processedAt ? e.processedAt.toLocaleString() : '—'}</TableCell>
                <TableCell className="max-w-48 truncate">{e.note ?? e.error ?? '—'}</TableCell>
              </EventRow>
            ))}
          </TableBody>
        </Table>
        <SSRPagination pathname="/byop/events" searchParams={query} currentPage={events.meta.page} totalPages={events.meta.totalPages} pageParam="page" />
      </CardContent>
    </Card>
  );
}
