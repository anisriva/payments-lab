import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/common/connectors/prisma';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { getManifest, listManifests } from '@/lib/common/payments/core/registry.server';
import { supports } from '@/lib/common/payments/core/contracts/features';
import { providerKeySchema } from '@/lib/common/payments/core/contracts/manifest';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { parseEnumParam, parsePositivePage } from '@/lib/common/helpers/url-parsers';
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
import { PayingProjectSelect } from '@/components/platform/payments/paying-project-select';
import { PayerCountrySelect } from '@/components/platform/payments/payer-country-select';
import { SubscribeButton } from '@/components/platform/payments/subscribe-button';
import { FixedCreditsCard } from '@/components/platform/payments/fixed-credits-card';
import { CustomCreditsForm } from '@/components/platform/payments/custom-credits-form';
import { RefreshPurchaseButton, RefreshSubscriptionButton, CancelSubscriptionButton, RefundButton } from '@/components/platform/payments/row-buttons';
import { cn } from '@/lib/utils';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const PLATFORM_TABS = [
  { href: '/platform/checkout/auto', label: 'Checkout' },
  { href: '/platform/plans', label: 'Plans & credits' },
  { href: '/platform/providers', label: 'Providers' },
  { href: '/platform/rubric', label: 'Rubric' },
  { href: '/platform/events', label: 'Events' },
];

export default async function PlatformGatewayPage({
  params,
  searchParams,
}: {
  params: Promise<{ gateway: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gateway } = await params;
  const query = await searchParams;

  const countries = await new CountryService(prisma).listCountries();
  const payer = parseEnumParam(query.payer, countries.map((c) => c.countryCode), 'IN');
  const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } });
  const payingProjectId = (query.project as string) ?? projects[0]?.id;
  const payerCurrency = countries.find((c) => c.countryCode === payer)?.currencyCode ?? 'INR';
  const ppage = parsePositivePage(query.ppage);
  const spage = parsePositivePage(query.spage);
  const paypage = parsePositivePage(query.paypage);
  const activity = parseEnumParam(query.activity, ['purchases','subscriptions','payments'] as const, 'purchases');

  const PROVIDER_LABELS: Record<string, string> = { dodo: 'Dodo Payments', stripe: 'Stripe', paypal: 'PayPal' };
  const manifests = listManifests('platform');
  const providers = providerKeySchema.options.map((key) => {
    const manifest = manifests.find((m) => m.key === key);
    return { key, label: manifest?.brand.name ?? PROVIDER_LABELS[key] ?? key, implemented: manifest !== undefined };
  });
  if (gateway !== 'auto' && !providers.some((p) => p.key === gateway)) notFound();
  const caps = providers.find((p) => p.key === gateway);

  const tabHref = (a: string) => {
    const q = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (typeof v === 'string') q.set(k, v); });
    q.set('activity', a);
    return `/platform/checkout/${gateway}?${q.toString()}`;
  };

  const service = new PlatformPaymentService(prisma);
  const preview = gateway === 'auto' ? await service.getSelectionPreview(payer) : null;
  const [planPrices, creditRate, purchases, subscriptions, payments] = await Promise.all([
    service.listPlanPricesForPayer(payer),
    service.getCreditRateForPayer(payer),
    service.listCreditPurchases({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: ppage, limit: 10 } }),
    service.listSubscriptions({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: spage, limit: 10 } }),
    service.listPayments({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: paypage, limit: 10 } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Platform checkout</h1>
      <LinkTabs items={PLATFORM_TABS} />
          <p className="text-muted-foreground">Sell AI credit packs and subscription plans through the platform gateway.</p>
        </div>
        <PayerCountrySelect value={payer} options={countries.map((c) => ({ code: c.countryCode, name: c.name }))} />
            <PayingProjectSelect value={payingProjectId} options={projects.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
      <Separator />

      <nav className="flex gap-1">
        <Link href={`/platform/checkout/auto?payer=${payer}`} className={cn(buttonVariants({ variant: gateway === 'auto' ? 'secondary' : 'ghost', size: 'sm' }))}>Auto</Link>
        {providers.map((p) =>
          p.implemented ? (
            <Link key={p.key} href={`/platform/checkout/${p.key}?payer=${payer}`} className={cn(buttonVariants({ variant: gateway === p.key ? 'secondary' : 'ghost', size: 'sm' }))}>{p.label}</Link>
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

      {preview && (
        <Alert>
          <AlertTitle>Selector</AlertTitle>
          <AlertDescription>
            <p>One-time: {preview.oneTime.reason}</p>
            <p>Subscription: {preview.subscription.reason}</p>
          </AlertDescription>
        </Alert>
      )}

      {caps && !caps.implemented ? (
        <Alert>
          <AlertTitle>Not implemented yet</AlertTitle>
          <AlertDescription>{caps.label} is listed in the provider registry but has no adapter yet. Its capabilities and gateway tab are visible for comparison.</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Subscription plans</CardTitle>
              <CardDescription>Recurring plans provisioned on the selected gateway</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {planPrices.length === 0 && (
                <Alert>
                  <AlertTitle>No plan prices in {payerCurrency}</AlertTitle>
                  <AlertDescription><Link href="/platform/plans?section=plan-prices" className="underline underline-offset-4">Add one in Plans & credits</Link></AlertDescription>
                </Alert>
              )}
              {planPrices.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span>{p.plan.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground">{formatMoney(p.unitAmount, p.currencyCode)}/month</span>
                    <SubscribeButton gateway={gateway} payer={payer} projectId={payingProjectId} planPriceId={p.id} />
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {creditRate ? (
            <div className="grid gap-6 md:grid-cols-2">
              <FixedCreditsCard gateway={gateway} payer={payer} projectId={payingProjectId} rateMinor={creditRate.unitAmount} currencyCode={creditRate.currencyCode} />
              <CustomCreditsForm gateway={gateway} payer={payer} projectId={payingProjectId} rateMinor={creditRate.unitAmount} currencyCode={creditRate.currencyCode} />
            </div>
          ) : (
            <Alert>
              <AlertTitle>No credit rate for {payerCurrency}</AlertTitle>
              <AlertDescription><Link href="/platform/plans?section=credit-rates" className="underline underline-offset-4">Add one in Plans & credits</Link></AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Purchases, subscriptions and recorded payments</CardDescription>
            </CardHeader>
            <CardContent>
              <nav className="flex gap-1">
                {(['purchases','subscriptions','payments'] as const).map((a) => (
                  <Link key={a} href={tabHref(a)}
                    className={cn(buttonVariants({ variant: activity === a ? 'secondary' : 'ghost', size: 'sm' }))}>
                    {a === 'purchases' ? 'Purchases' : a === 'subscriptions' ? 'Subscriptions' : 'Payments'}
                  </Link>
                ))}
              </nav>

              {activity === 'purchases' && (<>
                  <Table>
                    <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Credits</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Order ref</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {purchases.data.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                      {purchases.data.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>credits</TableCell><TableCell>{p.quantity}</TableCell>
                          <TableCell>{formatMoney(p.amount, p.currencyCode)}</TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                          <TableCell><RefCell value={p.providerOrderId} /></TableCell>
                          <TableCell>{p.createdAt.toLocaleString()}</TableCell>
                          <TableCell><RefreshPurchaseButton id={p.id} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <SSRPagination pathname={`/platform/checkout/${gateway}`} searchParams={query} currentPage={purchases.meta.page} totalPages={purchases.meta.totalPages} pageParam="ppage" />
              </>)}
              {activity === 'subscriptions' && (<>
                  <Table>
                    <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Period end</TableHead><TableHead>Sub ref</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {subscriptions.data.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                      {subscriptions.data.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.platformPlanPrice?.plan.name ?? ''}</TableCell>
                          <TableCell><StatusBadge status={s.status} /></TableCell>
                          <TableCell>{s.currentPeriodEnd?.toLocaleDateString() ?? '—'}</TableCell>
                          <TableCell><RefCell value={s.providerSubscriptionId} /></TableCell>
                          <TableCell className="flex gap-1"><RefreshSubscriptionButton id={s.id} /><CancelSubscriptionButton id={s.id} canCancelAtPeriodEnd={supports(getManifest(s.provider), 'subscription.cancel_at_period_end')} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <SSRPagination pathname={`/platform/checkout/${gateway}`} searchParams={query} currentPage={subscriptions.meta.page} totalPages={subscriptions.meta.totalPages} pageParam="spage" />
              </>)}
              {activity === 'payments' && (<>
                  <Table>
                    <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Amount</TableHead><TableHead>Payment ref</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {payments.data.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                      {payments.data.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.kind}</TableCell>
                          <TableCell>{formatMoney(p.amount, p.currencyCode)}</TableCell>
                          <TableCell><RefCell value={p.providerPaymentId} /></TableCell>
                          <TableCell>{p.createdAt.toLocaleString()}</TableCell>
                          <TableCell>{supports(getManifest(p.provider), 'refund.create')
                            ? <RefundButton id={p.id} />
                            : <Tooltip><TooltipTrigger render={<span className="text-xs text-muted-foreground cursor-help underline decoration-dotted">refund unsupported</span>} />
                              <TooltipContent>{getManifest(p.provider).brand.name} has no refund API — refund from the {getManifest(p.provider).brand.name} dashboard</TooltipContent></Tooltip>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <SSRPagination pathname={`/platform/checkout/${gateway}`} searchParams={query} currentPage={payments.meta.page} totalPages={payments.meta.totalPages} pageParam="paypage" />
              </>)}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
