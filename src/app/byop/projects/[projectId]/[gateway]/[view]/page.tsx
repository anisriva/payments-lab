import { notFound } from 'next/navigation';
import type { ProjectOffering } from '@/generated/prisma';
import type { PaginationResult } from '@/types/common/pagination';
import Link from 'next/link';
import { prisma } from '@/lib/common/connectors/prisma';
import { ProjectService } from '@/lib/platform/services/projects/project-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { ProjectPaymentConnectionService } from '@/lib/project/services/payments/project-payment-connection-service';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import { getManifest, listManifests } from '@/lib/common/payments/core/registry.server';
import { supports } from '@/lib/common/payments/core/contracts/features';
import { countryAllowed, coveredValues } from '@/lib/common/payments/core/coverage';
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
import { ProjectCard } from '@/components/platform/projects/project-card';
import { OfferingActiveSwitch, OfferingActions } from '@/components/platform/projects/offering-actions';
import { ConnectGatewayForm } from '@/components/platform/projects/connect-gateway-form';
import { isProviderKey } from '@/lib/common/payments/core/registry.server';
import { getClientAdapter } from '@/lib/common/payments/core/registry.client';
import { CreateOfferingForm } from '@/components/platform/projects/create-offering-form';
import { RevalidateButton, DisconnectDialogButton } from '@/components/platform/projects/connection-actions';
import { ValidationChecklist } from '@/components/common/payments/validation-checklist';
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
  const connectionService = new ProjectPaymentConnectionService(prisma);
  const paymentService = new ProjectPaymentService(prisma);

  const countryService = new CountryService(prisma);
  const [project, projects, countries] = await Promise.all([
    projectService.getProject(projectId).catch(() => null),
    projectService.listProjects(),
    countryService.listCountries(),
  ]);
  if (!project) notFound();
  const projectCurrency = (await countryService.getCountry(project.countryCode)).currencyCode;

  const buyer = typeof query.buyer === 'string' && query.buyer ? query.buyer : 'buyer@test.com';
  const opage = parsePositivePage(query.opage);
  const spage = parsePositivePage(query.spage);

  const PROVIDER_LABELS: Record<string, string> = { dodo: 'Dodo Payments', stripe: 'Stripe', paypal: 'PayPal' };
  const manifests = listManifests('project');
  const providers = manifests.map((m) => ({ key: m.key, label: m.brand.name, implemented: true as const, manifest: m }));
  const manifest = manifests.find((m) => m.key === gateway);
  const caps = manifest
    ? { key: manifest.key, label: manifest.brand.name, implemented: true, manifest }
    : isProviderKey(gateway)
      ? { key: gateway, label: PROVIDER_LABELS[gateway] ?? gateway, implemented: false, manifest: null }
      : null;
  if (!caps) notFound();

  const href = (v: string) => `/byop/projects/${projectId}/${gateway}/${v}?buyer=${encodeURIComponent(buyer)}`;

  const connection = caps.implemented ? await connectionService.getForProject(projectId, gateway) : null;
  const webhookUrl = `${getAppBaseUrl()}/api/webhooks/project/${projectId}/${gateway}`;

  const supported = caps.manifest ? countryAllowed(coveredValues(caps.manifest).receivers, project.countryCode) : false;
  type OfferingRow = ProjectOffering & { prices?: import('@/generated/prisma').ProjectOfferingPrice[]; providerRefs?: { scope: string; provider: string; providerRef: string }[] };
  const [offerings, orders, subscriptions]: [
    PaginationResult<OfferingRow>,
    Awaited<ReturnType<typeof paymentService.listOrders>>,
    Awaited<ReturnType<typeof paymentService.listSubscriptions>>,
  ] = supported && caps.implemented
    ? await Promise.all([
        view === 'setup' ? paymentService.listOfferingsForSetup(projectId) : paymentService.listActiveOfferings(projectId),
        paymentService.listOrders({ projectId, provider: gateway as 'razorpay' | 'dodo', pagination: { page: opage, limit: 10 } }),
        paymentService.listSubscriptions({ projectId, provider: gateway as 'razorpay' | 'dodo', buyerEmail: view === 'storefront' ? buyer : undefined, pagination: { page: spage, limit: 10 } }),
      ])
    : (() => { const meta = { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false }; return [{ data: [], meta }, { data: [], meta }, { data: [], meta }]; })();

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
            <Link key={p.key} href={`/byop/projects/${projectId}/${p.key}/${view}?buyer=${encodeURIComponent(buyer)}`}
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
          <ProjectCard project={project} countries={countries.map((c) => ({ code: c.countryCode, name: c.name }))} />
          <Card>
            <CardHeader>
              <CardTitle>{caps.label} connection</CardTitle>
              <CardDescription>Creator keys are verified, encrypted, and never returned by any read.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connection ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={connection.isEnabled ? 'verified' : 'disabled'} />
                    <span className="font-mono text-xs">{connection.displayHint}</span>
                    <RevalidateButton projectId={projectId} connectionId={connection.id} />
                    <DisconnectDialogButton projectId={projectId} connectionId={connection.id} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Webhook</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{webhookUrl}</span>
                      <CopyButton value={webhookUrl} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {connection.webhookRef
                        ? `Registered${connection.webhookActive === false ? ' · disabled' : ''}${connection.webhookRegisteredAt ? ` · ${connection.webhookRegisteredAt.toLocaleString()}` : ''}`
                        : 'Not registered'}
                      {connection.webhookError ? ` · ${connection.webhookError}` : ''}
                    </p>
                  </div>
                  {connection.validationReport != null && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Last validation{connection.validatedAt ? ` · ${connection.validatedAt.toLocaleString()}` : ''}</p>
                      <ValidationChecklist report={connection.validationReport as unknown as import('@/lib/common/payments/core/connection-checks').ValidationReport} />
                    </div>
                  )}
                </div>
              ) : isProviderKey(gateway) ? (
                <ConnectGatewayForm projectId={projectId} provider={gateway} adapter={getClientAdapter(gateway)} webhookUrl={webhookUrl} />
              ) : (
                <Alert><AlertTitle>Not implemented yet</AlertTitle></Alert>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle>Offerings</CardTitle><CardDescription>Products buyers can purchase, priced in {projectCurrency}</CardDescription></div>
              <CreateOfferingForm projectId={projectId} currencyCode={projectCurrency} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Price</TableHead><TableHead>Currency</TableHead><TableHead>Plan</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {offerings.data.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                  {offerings.data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.name}</TableCell>
                      <TableCell>{o.prices?.[0]?.priceType ?? '—'}</TableCell>
                      <TableCell>
                        {o.prices?.[0] ? (o.prices[0].priceType === 'custom' ? `min ${formatMoney(o.prices[0].amount, o.prices[0].currencyCode)}`
                          : o.prices[0].priceType === 'recurring' ? `${formatMoney(o.prices[0].amount, o.prices[0].currencyCode)} / ${o.prices[0].billingMode}`
                          : formatMoney(o.prices[0].amount, o.prices[0].currencyCode)) : '—'}
                      </TableCell>
                      <TableCell>{o.prices?.[0]?.currencyCode ?? projectCurrency}</TableCell>
                      <TableCell>
                        {o.providerRefs && o.providerRefs.length > 0
                          ? o.providerRefs.map((r) => (
                              <div key={r.scope} className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">{r.provider}</span>
                                <RefCell value={r.providerRef} />
                              </div>
                            ))
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><OfferingActiveSwitch projectId={projectId} offeringId={o.id} checked={o.isActive} /></TableCell>
                      <TableCell><OfferingActions projectId={projectId} offeringId={o.id} name={o.name} providerKeys={[...new Set((o.providerRefs ?? []).map((r) => r.provider))]} /></TableCell>
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
                <OfferingCard key={o.id} projectId={projectId} offering={o} buyer={buyer} provider={gateway} />
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
                      <TableCell>{s.projectOfferingPrice.offering.name}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>{s.currentPeriodEnd?.toLocaleDateString() ?? '—'}</TableCell>
                      <TableCell><CancelProjectSubscriptionButton projectId={projectId} id={s.id} canCancelAtPeriodEnd={supports(getManifest(s.provider), 'subscription.cancel_at_period_end')} /></TableCell>
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
                      <TableCell>{o.projectOfferingPrice.offering.name}</TableCell>
                      <TableCell>{o.buyerEmail}</TableCell>
                      <TableCell>{formatMoney(o.amount, o.currencyCode)}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell><RefCell value={o.providerOrderId} /></TableCell>
                      <TableCell>{o.createdAt.toLocaleString()}</TableCell>
                      <TableCell><RefreshProjectOrderButton projectId={projectId} id={o.id} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SSRPagination pathname={`/byop/projects/${projectId}/${gateway}/${view}`} searchParams={query} currentPage={orders.meta.page} totalPages={orders.meta.totalPages} pageParam="opage" />
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
                      <TableCell>{s.projectOfferingPrice.offering.name}</TableCell>
                      <TableCell>{s.buyerEmail}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>{s.currentPeriodEnd?.toLocaleDateString() ?? '—'}</TableCell>
                      <TableCell><RefCell value={s.providerSubscriptionId} /></TableCell>
                      <TableCell className="flex gap-1"><RefreshProjectSubscriptionButton projectId={projectId} id={s.id} /><CancelProjectSubscriptionButton projectId={projectId} id={s.id} canCancelAtPeriodEnd={supports(getManifest(s.provider), 'subscription.cancel_at_period_end')} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SSRPagination pathname={`/byop/projects/${projectId}/${gateway}/${view}`} searchParams={query} currentPage={subscriptions.meta.page} totalPages={subscriptions.meta.totalPages} pageParam="spage" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
