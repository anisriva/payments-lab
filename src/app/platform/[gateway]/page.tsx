import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/common/connectors/prisma';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { listProviders } from '@/lib/common/payments/core/factory';
import { PAYER_COUNTRIES } from '@/lib/common/services/payments/payment-constants';
import { parseEnumParam, parsePositivePage } from '@/lib/common/helpers/url-parsers';
import { formatMoney } from '@/lib/common/helpers/money';
import { buttonVariants } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SSRPagination } from '@/components/common/navigation/pagination';
import { StatusBadge } from '@/components/common/payments/status-badge';
import { RefCell } from '@/components/common/payments/ref-cell';
import { PayerCountrySelect } from '@/components/platform/payments/payer-country-select';
import { SubscribeButton } from '@/components/platform/payments/subscribe-button';
import { FixedCreditsCard } from '@/components/platform/payments/fixed-credits-card';
import { CustomCreditsForm } from '@/components/platform/payments/custom-credits-form';
import { RefreshPurchaseButton, RefreshSubscriptionButton, CancelSubscriptionButton } from '@/components/platform/payments/row-buttons';
import { cn } from '@/lib/utils';

export default async function PlatformGatewayPage({
  params,
  searchParams,
}: {
  params: Promise<{ gateway: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gateway } = await params;
  const query = await searchParams;

  const payer = parseEnumParam(query.payer, PAYER_COUNTRIES, 'IN');
  const ppage = parsePositivePage(query.ppage);
  const spage = parsePositivePage(query.spage);
  const paypage = parsePositivePage(query.paypage);

  const providers = listProviders('platform');
  if (gateway !== 'auto' && !providers.some((p) => p.key === gateway)) notFound();
  const caps = providers.find((p) => p.key === gateway);

  const service = new PlatformPaymentService(prisma);
  const preview = gateway === 'auto' ? await service.getSelectionPreview(payer) : null;
  const [planPrices, purchases, subscriptions, payments] = await Promise.all([
    service.listPlanPrices(),
    service.listCreditPurchases({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: ppage, limit: 10 } }),
    service.listSubscriptions({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: spage, limit: 10 } }),
    service.listPayments({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: paypage, limit: 10 } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Platform checkout</h1>
          <p className="text-muted-foreground">Sell AI credit packs and subscription plans through the platform gateway.</p>
        </div>
        <PayerCountrySelect value={payer} />
      </div>
      <Separator />

      <nav className="flex gap-1">
        <Link href={`/platform/auto?payer=${payer}`} className={cn(buttonVariants({ variant: gateway === 'auto' ? 'secondary' : 'ghost', size: 'sm' }))}>Auto</Link>
        {providers.map((p) =>
          p.implemented ? (
            <Link key={p.key} href={`/platform/${p.key}?payer=${payer}`} className={cn(buttonVariants({ variant: gateway === p.key ? 'secondary' : 'ghost', size: 'sm' }))}>{p.label}</Link>
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
              {planPrices.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span>{p.displayName}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground">{formatMoney(p.amountMinor, p.currencyCode)}/month</span>
                    <SubscribeButton gateway={gateway} payer={payer} planPriceId={p.id} />
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <FixedCreditsCard gateway={gateway} payer={payer} />
            <CustomCreditsForm gateway={gateway} payer={payer} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Purchases, subscriptions and recorded payments</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="purchases">
                <TabsList>
                  <TabsTrigger value="purchases">Purchases</TabsTrigger>
                  <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>
                <TabsContent value="purchases">
                  <Table>
                    <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Credits</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Order ref</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {purchases.data.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                      {purchases.data.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.kind}</TableCell><TableCell>{p.credits}</TableCell>
                          <TableCell>{formatMoney(p.amountMinor, p.currencyCode)}</TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                          <TableCell><RefCell value={p.providerOrderId} /></TableCell>
                          <TableCell>{p.createdAt.toLocaleString()}</TableCell>
                          <TableCell><RefreshPurchaseButton id={p.id} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <SSRPagination pathname={`/platform/${gateway}`} searchParams={query} currentPage={purchases.meta.page} totalPages={purchases.meta.totalPages} pageParam="ppage" />
                </TabsContent>
                <TabsContent value="subscriptions">
                  <Table>
                    <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Period end</TableHead><TableHead>Sub ref</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {subscriptions.data.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                      {subscriptions.data.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.platformPlanPrice.displayName}</TableCell>
                          <TableCell><StatusBadge status={s.status} /></TableCell>
                          <TableCell>{s.currentPeriodEnd?.toLocaleDateString() ?? '—'}</TableCell>
                          <TableCell><RefCell value={s.providerSubscriptionId} /></TableCell>
                          <TableCell className="flex gap-1"><RefreshSubscriptionButton id={s.id} /><CancelSubscriptionButton id={s.id} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <SSRPagination pathname={`/platform/${gateway}`} searchParams={query} currentPage={subscriptions.meta.page} totalPages={subscriptions.meta.totalPages} pageParam="spage" />
                </TabsContent>
                <TabsContent value="payments">
                  <Table>
                    <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Amount</TableHead><TableHead>Payment ref</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {payments.data.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No records yet</TableCell></TableRow>}
                      {payments.data.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.kind}</TableCell>
                          <TableCell>{formatMoney(p.amountMinor, p.currencyCode)}</TableCell>
                          <TableCell><RefCell value={p.providerPaymentId} /></TableCell>
                          <TableCell>{p.createdAt.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <SSRPagination pathname={`/platform/${gateway}`} searchParams={query} currentPage={payments.meta.page} totalPages={payments.meta.totalPages} pageParam="paypage" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
