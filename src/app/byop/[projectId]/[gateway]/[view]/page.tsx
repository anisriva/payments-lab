import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/common/connectors/prisma';
import { ProjectService } from '@/lib/platform/services/projects/project-service';
import { PaymentConnectionService } from '@/lib/project/services/payments/payment-connection-service';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import { listProviders, countryAllowed } from '@/lib/common/payments/core/factory';
import { parsePositivePage } from '@/lib/common/helpers/url-parsers';
import { formatMoney } from '@/lib/common/helpers/money';
import { buttonVariants } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SSRPagination } from '@/components/common/navigation/pagination';
import { StatusBadge } from '@/components/common/payments/status-badge';
import { RefCell } from '@/components/common/payments/ref-cell';
import { ProjectSelect } from '@/components/platform/projects/project-select';
import { ConnectGatewayForm } from '@/components/platform/projects/connect-gateway-form';
import { CreateOfferingForm } from '@/components/platform/projects/create-offering-form';
import { DisconnectButton } from '@/components/platform/projects/disconnect-button';
import { CopyButton } from '@/components/project/payments/copy-button';
import { BuyerEmailInput } from '@/components/project/payments/buyer-email-input';
import { OfferingCard } from '@/components/project/payments/offering-card';
import { RefreshProjectOrderButton, RefreshProjectSubscriptionButton, CancelProjectSubscriptionButton } from '@/components/project/payments/row-buttons';
import { getAppBaseUrl } from '@/lib/common/services/payments/payment-config';
import { cn } from '@/lib/utils';

const VIEWS = ['setup', 'storefront', 'activity'] as const;

export default async function ByopGatewayPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; gateway: string; view: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId, gateway, view } = await params;
  const query = await searchParams;
  if (!VIEWS.includes(view as (typeof VIEWS)[number])) notFound();

  const projectService = new ProjectService(prisma);
  const connectionService = new PaymentConnectionService(prisma);
  const paymentService = new ProjectPaymentService(prisma);

  const [project, projects] = await Promise.all([
    projectService.getProject(projectId).catch(() => null),
    projectService.listProjects(),
  ]);
  if (!project) notFound();

  const buyer = typeof query.buyer === 'string' && query.buyer ? query.buyer : 'buyer@test.com';
  const opage = parsePositivePage(query.opage);
  const spage = parsePositivePage(query.spage);

  const providers = listProviders('project');
  const caps = providers.find((p) => p.key === gateway);
  if (!caps) notFound();

  const href = (v: string) => `/byop/${projectId}/${gateway}/${v}?buyer=${encodeURIComponent(buyer)}`;

  const connection = caps.implemented ? await connectionService.getForProject(projectId, gateway) : null;
  const webhookUrl = connection ? `${getAppBaseUrl()}/api/webhooks/${connection.provider}/${connection.id}` : null;

  const supported = countryAllowed(caps.receiverCountries, project.countryCode);
  const [offerings, orders, subscriptions] = supported && caps.implemented
    ? await Promise.all([
        paymentService.listOfferings(projectId),
        paymentService.listOrders({ projectId, provider: gateway as 'razorpay' | 'dodo', pagination: { page: opage, limit: 10 } }),
        paymentService.listSubscriptions({ projectId, provider: gateway as 'razorpay' | 'dodo', buyerEmail: view === 'storefront' ? buyer : undefined, pagination: { page: spage, limit: 10 } }),
      ])
    : [{ data: [] }, { data: [], meta: { page: 1, totalPages: 0 } }, { data: [], meta: { page: 1, totalPages: 0 } }];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">BYOP checkout</h1>
          <p className="text-muted-foreground">Project country: {project.countryCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectSelect projects={projects.data.map((p) => ({ id: p.id, name: p.name }))} value={projectId} gateway={gateway} view={view} buyer={buyer} />
          <Link href="/byop" className={buttonVariants({ variant: 'outline', size: 'sm' })}>+ New project</Link>
        </div>
      </div>
      <Separator />

      <nav className="flex gap-1">
        {providers.map((p) =>
          p.implemented ? (
            <Link key={p.key} href={`/byop/${projectId}/${p.key}/${view}?buyer=${encodeURIComponent(buyer)}`}
              className={cn(buttonVariants({ variant: gateway === p.key ? 'secondary' : 'ghost', size: 'sm' }))}>{p.label}</Link>
          ) : (
            <Tooltip key={p.key}>
              <TooltipTrigger render={<span className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')} />}>
                {p.label} · soon
              </TooltipTrigger>
              <TooltipContent>Not implemented yet</TooltipContent>
            </Tooltip>
          )
        )}
      </nav>
      <nav className="flex gap-1">
        {VIEWS.map((v) => (
          <Link key={v} href={href(v)} className={cn(buttonVariants({ variant: view === v ? 'secondary' : 'ghost', size: 'sm' }))}>
            {v === 'setup' ? 'Setup' : v === 'storefront' ? 'Storefront' : 'Activity'}
          </Link>
        ))}
      </nav>

      {!caps.implemented ? (
        <Alert><AlertTitle>Not implemented yet</AlertTitle>
          <AlertDescription>{caps.label} is listed in the provider registry but has no adapter yet.</AlertDescription>
        </Alert>
      ) : !supported ? (
        <Alert><AlertTitle>{caps.label} cannot receive payments for projects in {project.countryCode}</AlertTitle>
          <AlertDescription>Connect a different gateway or change the project country.</AlertDescription>
        </Alert>
      ) : view === 'setup' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{caps.label} connection</CardTitle>
              <CardDescription>Creator keys are verified, encrypted, and never returned by any read.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connection && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={connection.isEnabled ? 'verified' : 'disabled'} />
                    <span className="font-mono text-xs">{connection.displayHint}</span>
                    <DisconnectButton projectId={projectId} connectionId={connection.id} />
                  </div>
                  {webhookUrl && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{webhookUrl}</span>
                      <CopyButton value={webhookUrl} />
                    </div>
                  )}
                </div>
              )}
              <ConnectGatewayForm projectId={projectId} provider={gateway} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Offerings</CardTitle><CardDescription>Products buyers can purchase</CardDescription></div>
              <CreateOfferingForm projectId={projectId} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {offerings.data.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                  {offerings.data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.name}</TableCell>
                      <TableCell>{o.priceType}</TableCell>
                      <TableCell>
                        {o.priceType === 'custom' ? `min ${formatMoney(o.amountMinor, o.currencyCode)}`
                          : o.priceType === 'recurring' ? `${formatMoney(o.amountMinor, o.currencyCode)} / ${o.interval}`
                          : formatMoney(o.amountMinor, o.currencyCode)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : view === 'storefront' ? (
        <div className="space-y-6">
          <BuyerEmailInput value={buyer} />
          {!connection?.isEnabled ? (
            <Alert><AlertTitle>Creator hasn&apos;t connected {caps.label} yet — go to Setup</AlertTitle></Alert>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {offerings.data.filter((o) => o.isActive).map((o) => (
                <OfferingCard key={o.id} projectId={projectId} offering={o} buyer={buyer} />
              ))}
            </div>
          )}
          <Card>
            <CardHeader><CardTitle>Your subscriptions</CardTitle><CardDescription>Subscriptions for {buyer}</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Offering</TableHead><TableHead>Status</TableHead><TableHead>Period end</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {subscriptions.data.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                  {subscriptions.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.offering.name}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>{s.currentPeriodEnd?.toLocaleDateString() ?? '—'}</TableCell>
                      <TableCell><CancelProjectSubscriptionButton projectId={projectId} id={s.id} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Offering</TableHead><TableHead>Buyer</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Order ref</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {orders.data.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                  {orders.data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.offering.name}</TableCell>
                      <TableCell>{o.buyerEmail}</TableCell>
                      <TableCell>{formatMoney(o.amountMinor, o.currencyCode)}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell><RefCell value={o.providerOrderId} /></TableCell>
                      <TableCell>{o.createdAt.toLocaleString()}</TableCell>
                      <TableCell><RefreshProjectOrderButton projectId={projectId} id={o.id} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SSRPagination pathname={`/byop/${projectId}/${gateway}/${view}`} searchParams={query} currentPage={orders.meta.page} totalPages={orders.meta.totalPages} pageParam="opage" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Offering</TableHead><TableHead>Buyer</TableHead><TableHead>Status</TableHead><TableHead>Period end</TableHead><TableHead>Sub ref</TableHead><TableHead /><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {subscriptions.data.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                  {subscriptions.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.offering.name}</TableCell>
                      <TableCell>{s.buyerEmail}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>{s.currentPeriodEnd?.toLocaleDateString() ?? '—'}</TableCell>
                      <TableCell><RefCell value={s.providerSubscriptionId} /></TableCell>
                      <TableCell className="flex gap-1"><RefreshProjectSubscriptionButton projectId={projectId} id={s.id} /><CancelProjectSubscriptionButton projectId={projectId} id={s.id} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SSRPagination pathname={`/byop/${projectId}/${gateway}/${view}`} searchParams={query} currentPage={subscriptions.meta.page} totalPages={subscriptions.meta.totalPages} pageParam="spage" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
