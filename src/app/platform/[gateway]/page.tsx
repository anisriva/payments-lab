import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/common/connectors/prisma';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { listProviders } from '@/lib/common/payments/core/factory';
import { PAYER_COUNTRIES } from '@/lib/common/services/payments/payment-constants';
import { parseEnumParam, parsePositivePage } from '@/lib/common/helpers/url-parsers';
import { formatMoney } from '@/lib/common/helpers/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SSRPagination } from '@/components/common/navigation/pagination';
import { StatusBadge } from '@/components/common/payments/status-badge';
import { PayerCountrySelect } from '@/components/platform/payments/payer-country-select';
import { SubscribeButton } from '@/components/platform/payments/subscribe-button';
import { FixedCreditsCard } from '@/components/platform/payments/fixed-credits-card';
import { CustomCreditsForm } from '@/components/platform/payments/custom-credits-form';
import { RefreshPurchaseButton, RefreshSubscriptionButton, CancelSubscriptionButton } from '@/components/platform/payments/row-buttons';

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
  if (caps && !caps.implemented) {
    return (
      <div className="space-y-4">
        <GatewayTabs gateway={gateway} payer={payer} providers={providers} />
        <Card><CardContent className="pt-6">Not implemented yet</CardContent></Card>
      </div>
    );
  }

  const service = new PlatformPaymentService(prisma);
  const [planPrices, preview, purchases, subscriptions, payments] = await Promise.all([
    service.listPlanPrices(),
    gateway === 'auto' ? service.getSelectionPreview(payer) : null,
    service.listCreditPurchases({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: ppage, limit: 10 } }),
    service.listSubscriptions({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: spage, limit: 10 } }),
    service.listPayments({ provider: gateway === 'auto' ? undefined : (gateway as 'razorpay' | 'dodo'), pagination: { page: paypage, limit: 10 } }),
  ]);

  return (
    <div className="space-y-6">
      <GatewayTabs gateway={gateway} payer={payer} providers={providers} />
      <div className="flex items-center gap-3">
        <span className="text-sm">Payer country</span>
        <PayerCountrySelect value={payer} />
      </div>
      {preview && (
        <p className="text-sm text-muted-foreground">
          One-time: {preview.oneTime.reason} · Subscription: {preview.subscription.reason}
        </p>
      )}

      <Card>
        <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {planPrices.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span>{p.displayName}</span>
              <span className="flex items-center gap-3">
                {formatMoney(p.amountMinor, p.currencyCode)}/month
                <SubscribeButton gateway={gateway} payer={payer} planPriceId={p.id} />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <FixedCreditsCard gateway={gateway} payer={payer} />
      <CustomCreditsForm gateway={gateway} payer={payer} />

      <Card>
        <CardHeader><CardTitle>Purchases</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Credits</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Order ref</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {purchases.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.kind}</TableCell><TableCell>{p.credits}</TableCell>
                  <TableCell>{formatMoney(p.amountMinor, p.currencyCode)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="font-mono text-xs">{p.providerOrderId ?? '—'}</TableCell>
                  <TableCell>{p.createdAt.toLocaleString()}</TableCell>
                  <TableCell><RefreshPurchaseButton id={p.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <SSRPagination pathname={`/platform/${gateway}`} searchParams={query} currentPage={purchases.meta.page} totalPages={purchases.meta.totalPages} pageParam="ppage" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Period end</TableHead><TableHead>Sub ref</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {subscriptions.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.platformPlanPrice.displayName}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell>{s.currentPeriodEnd?.toLocaleDateString() ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{s.providerSubscriptionId ?? '—'}</TableCell>
                  <TableCell className="flex gap-1"><RefreshSubscriptionButton id={s.id} /><CancelSubscriptionButton id={s.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <SSRPagination pathname={`/platform/${gateway}`} searchParams={query} currentPage={subscriptions.meta.page} totalPages={subscriptions.meta.totalPages} pageParam="spage" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Amount</TableHead><TableHead>Payment ref</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.kind}</TableCell>
                  <TableCell>{formatMoney(p.amountMinor, p.currencyCode)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.providerPaymentId}</TableCell>
                  <TableCell>{p.createdAt.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <SSRPagination pathname={`/platform/${gateway}`} searchParams={query} currentPage={payments.meta.page} totalPages={payments.meta.totalPages} pageParam="paypage" />
        </CardContent>
      </Card>
    </div>
  );
}

function GatewayTabs({ gateway, payer, providers }: { gateway: string; payer: string; providers: { key: string; label: string; implemented: boolean }[] }) {
  return (
    <nav className="flex gap-3 border-b">
      <Link href={`/platform/auto?payer=${payer}`} className={gateway === 'auto' ? 'border-b-2 border-primary px-2 py-2 text-sm' : 'px-2 py-2 text-sm text-muted-foreground'}>Auto</Link>
      {providers.map((p) =>
        p.implemented ? (
          <Link key={p.key} href={`/platform/${p.key}?payer=${payer}`} className={gateway === p.key ? 'border-b-2 border-primary px-2 py-2 text-sm' : 'px-2 py-2 text-sm text-muted-foreground'}>{p.label}</Link>
        ) : (
          <span key={p.key} className="px-2 py-2 text-sm text-muted-foreground">{p.label} · soon</span>
        )
      )}
    </nav>
  );
}
