import { prisma } from '@/lib/common/connectors/prisma';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { ProviderRulesService } from '@/lib/common/services/payments/provider-rules-service';
import { coveredValues } from '@/lib/common/payments/core/coverage';
import { supports } from '@/lib/common/payments/core/contracts/features';
import { providerKeySchema } from '@/lib/common/payments/core/contracts/manifest';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { RubricService } from '@/lib/common/services/payments/rubric-service';
import { isProviderKey, listManifests } from '@/lib/common/payments/core/registry.server';
import { PLATFORM_RECEIVER_COUNTRY } from '@/lib/common/services/payments/payment-config';
import { parseEnumParam, parseOptionalString } from '@/lib/common/helpers/url-parsers';
import { formatMoney } from '@/lib/common/helpers/money';
import {} from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SSRPagination } from '@/components/common/navigation/pagination';
import { RefCell } from '@/components/common/payments/ref-cell';
import { CreatePlanPriceForm } from '@/components/platform/catalog/create-plan-price-form';
import { PlanPriceActions, PlanPriceActiveSwitch } from '@/components/platform/catalog/plan-price-actions';
import { CreateCreditRateForm } from '@/components/platform/catalog/create-credit-rate-form';
import { CreditRateActions, CreditRateActiveSwitch } from '@/components/platform/catalog/credit-rate-actions';
import { ProviderSettingsForm } from '@/components/platform/catalog/provider-settings-form';
import { RubricSimulatorForm } from '@/components/platform/catalog/rubric-simulator-form';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CheckResult } from '@/lib/common/payments/core/selector';
import {} from '@/lib/utils';
import { PlatformProviderService } from '@/lib/platform/services/payments/platform-provider-service';
import { ValidationChecklist } from '@/components/common/payments/validation-checklist';
import { CopyButton } from '@/components/project/payments/copy-button';
import { ValidateProviderButton } from '@/components/platform/payments/validate-provider-button';
import type { ValidationReport } from '@/lib/common/payments/core/connection-checks';

export async function PlanPricesSection({ page }: { page: number }) {
  const service = new PlatformPaymentService(prisma);
  const countryService = new CountryService(prisma);
  const [planPrices, currencies] = await Promise.all([
    service.listPlanPricesForCatalog({ pagination: { page, limit: 10 } }),
    countryService.listCurrencies(),
  ]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle>Plan prices</CardTitle><CardDescription>Subscription prices offered to buyers</CardDescription></div>
        <CreatePlanPriceForm currencies={currencies} />
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan key</TableHead><TableHead>Name</TableHead><TableHead>Interval</TableHead>
              <TableHead>Price</TableHead><TableHead>Currency</TableHead><TableHead>Provider plan refs</TableHead>
              <TableHead>Active</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {planPrices.data.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No plan prices yet</TableCell></TableRow>}
            {planPrices.data.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.plan?.key}</TableCell>
                <TableCell>{p.plan?.name}</TableCell>
                <TableCell>{p.billingMode}</TableCell>
                <TableCell>{formatMoney(p.unitAmount, p.currencyCode)}</TableCell>
                <TableCell>{p.market?.key ?? p.currencyCode}</TableCell>
                <TableCell>
                  {(p.providerRefs ?? []).length === 0
                    ? <span className="text-muted-foreground">—</span>
                    : p.providerRefs.map((r) => (
                        <div key={r.provider} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{r.provider}</span>
                          <RefCell value={r.providerRef} />
                        </div>
                      ))}
                </TableCell>
                <TableCell><PlanPriceActiveSwitch id={p.id} checked={p.isActive} /></TableCell>
                <TableCell><PlanPriceActions id={p.id} displayName={p.plan?.name ?? p.id} providerKeys={Object.keys((p.providerPlanRefs ?? {}) as Record<string, string>)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">Prices can&apos;t change after creation — deactivate and create a new one.</p>
        <SSRPagination pathname="/catalog/plan-prices" searchParams={{}} currentPage={planPrices.meta.page} totalPages={planPrices.meta.totalPages} pageParam="page" />
      </CardContent>
    </Card>
  );
}

export async function CreditRatesSection({ page }: { page: number }) {
  const service = new PlatformPaymentService(prisma);
  const countryService = new CountryService(prisma);
  const [rates, currencies] = await Promise.all([
    service.listCreditRates({ pagination: { page, limit: 10 } }),
    countryService.listCurrencies(),
  ]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle>Credit rates</CardTitle><CardDescription>Price of one AI credit per currency</CardDescription></div>
        <CreateCreditRateForm currencies={currencies} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Market</TableHead><TableHead>Price per credit</TableHead><TableHead>Active</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {rates.data.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No credit rates yet</TableCell></TableRow>}
            {rates.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.marketId.slice(0,8)}</TableCell>
                <TableCell>{formatMoney(r.unitAmount, r.currencyCode)}</TableCell>
                <TableCell><CreditRateActiveSwitch id={r.id} checked={r.isActive} /></TableCell>
                <TableCell><CreditRateActions id={r.id} rateMinor={r.unitAmount} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <SSRPagination pathname="/catalog/credit-rates" searchParams={{}} currentPage={rates.meta.page} totalPages={rates.meta.totalPages} pageParam="page" />
      </CardContent>
    </Card>
  );
}

export async function ProvidersSection({ flow = 'platform' }: { flow?: 'platform' | 'project' } = {}) {
  const providerRulesService = new ProviderRulesService(prisma);
  const countryService = new CountryService(prisma);
  const [settings, countries, currencies] = await Promise.all([
    providerRulesService.listForProvidersTab(flow),
    countryService.listCountries(),
    countryService.listCurrencies(),
  ]);
  const platformService = new PlatformProviderService(prisma);
  const statuses = flow === 'platform'
    ? new Map(await Promise.all(settings.map(async (s) => [s.provider, s.implemented ? await platformService.getStatus(s.provider) : null] as const)))
    : null;

  const PROVIDER_LABELS: Record<string, string> = { dodo: 'Dodo Payments', stripe: 'Stripe', paypal: 'PayPal' };
  const FEATURE_ROWS: [string, import('@/lib/common/payments/core/contracts/features').ProviderFeature][] = [
    ['Subscriptions', 'subscription.create'],
    ['Custom amounts', 'checkout.custom_amount'],
    ['Automatic webhook registration', 'webhook.write'],
    ['Webhook disable', 'webhook.disable'],
    ['Webhook delete', 'webhook.delete'],
    ['Plan edit', 'subscription_plan.update'],
    ['Plan delete', 'subscription_plan.delete'],
  ];

  return (
    <div className="space-y-4">
      {settings.map((s) => {
        const label = s.manifest?.brand.name ?? PROVIDER_LABELS[s.provider] ?? s.provider;
        const manualSteps = s.manifest
          ? (Object.entries(s.manifest.features) as [string, { supported: boolean; manual?: { title: string; steps: string[] } }][])
              .filter(([, f]) => !f.supported && f.manual)
              .map(([name, f]) => ({ name, ...f.manual! }))
          : [];
        const defaultLists = s.manifest ? coveredValues(s.manifest) : { receivers: '*' as const, payers: '*' as const, currencies: '*' as const };
        return (
        <Card key={s.provider}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{label}</CardTitle>
              <Badge variant={s.implemented ? 'secondary' : 'outline'}>{s.implemented ? 'implemented' : 'not implemented'}</Badge>
              {(s.manifest?.audiences ?? []).map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
              {s.manifest && supports(s.manifest, 'subscription.create') && <Badge variant="outline">subscriptions</Badge>}
              {s.manifest && supports(s.manifest, 'checkout.custom_amount') && <Badge variant="outline">custom amount</Badge>}
              {s.rule !== null && s.rule.isEnabled
                ? <Badge variant="secondary">enabled · p{s.rule.priority}</Badge>
                : <Badge variant="outline">disabled</Badge>}
            </div>
            <CardDescription>{s.hasRow ? 'Rules stored in this audience\'s rules table' : 'No rules row — disabled until saved here'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.manifest && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Features</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {FEATURE_ROWS.map(([lbl, f]) => (
                      <li key={lbl}>{supports(s.manifest!, f) ? '✓' : '✗'} {lbl}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Manual steps</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {manualSteps.length === 0 && <li>—</li>}
                    {manualSteps.map((m) => (
                      <li key={m.name}>· {m.title} — {m.steps[0]}</li>
                    ))}
                    {s.manifest.coverage.filter((l) => l.note).map((l) => (
                      <li key={`note-${l.note}`}>· {l.note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {s.manifest && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Actions</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {([
                    ['Cancel at period end', 'subscription.cancel_at_period_end'],
                    ['Cancel now', 'subscription.cancel'],
                    ['Refund', 'refund.create'],
                    ['Discounts', 'discount.create'],
                    ['Disable plan', 'subscription_plan.disable'],
                    ['Webhook cleanup on disconnect', 'webhook.delete'],
                  ] as [string, import('@/lib/common/payments/core/contracts/features').ProviderFeature][]).map(([lbl, f]) => (
                    <li key={lbl}>{supports(s.manifest!, f) ? '✓' : '✗'} {lbl}</li>
                  ))}
                </ul>
              </div>
            )}
            {flow === 'platform' && s.implemented && statuses?.get(s.provider) && (
              <PlatformWebhookBlock provider={s.provider} status={statuses.get(s.provider)!} />
            )}
            {s.implemented ? (
              <ProviderSettingsForm
                provider={s.provider}
                flow={flow}
                initial={{
                  isEnabled: s.rule?.isEnabled ?? false,
                  priority: s.rule?.priority ?? 100,
                  receiverCountries: s.rule?.receiverCountries ?? defaultLists.receivers,
                  payerCountries: s.rule?.payerCountries ?? defaultLists.payers,
                  currencies: s.rule?.currencies ?? defaultLists.currencies,
                }}
                countries={countries}
                currencies={currencies}
              />
            ) : (
              <Alert><AlertTitle>Not implemented yet</AlertTitle><AlertDescription>{label} has no adapter, so its rules can&apos;t be edited.</AlertDescription></Alert>
            )}
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}

const CHECK_COLUMNS = ['allowed', 'audience', 'enabled', 'receiver', 'payer', 'currency', 'subscriptions', 'available'] as const;

export function CheckBadge({ check }: { check: CheckResult }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Badge variant={check.status === 'pass' ? 'secondary' : check.status === 'fail' ? 'destructive' : 'outline'}>
          {check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '—'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{check.detail || 'skipped'}</TooltipContent>
    </Tooltip>
  );
}

export function ResultBadge({ result }: { result: { provider: string | null; reason: string } }) {
  if (!result.provider) return <span className="text-muted-foreground">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}><Badge variant="secondary">{result.provider}</Badge></TooltipTrigger>
      <TooltipContent>{result.reason}</TooltipContent>
    </Tooltip>
  );
}

export async function RubricSection({ query, lockedFlow, showProjectMap = true, showPlatformMap = true }: { query: Record<string, string | string[] | undefined>; lockedFlow?: 'platform' | 'project'; showProjectMap?: boolean; showPlatformMap?: boolean }) {
  const rubricService = new RubricService(prisma);
  const countryService = new CountryService(prisma);

  const countries = await countryService.listCountries();
  const currencies = await countryService.listCurrencies();
  const countryCodes = countries.map((c) => c.countryCode);

  const flow = lockedFlow ?? parseEnumParam(query.flow, ['platform', 'project'] as const, 'platform');
  const mode = parseEnumParam(query.mode, ['one_time', 'subscription'] as const, 'one_time');
  const payer = parseEnumParam(query.payer, countryCodes, 'IN');
  const receiver = parseEnumParam(query.receiver, countryCodes, 'IN');
  const currencyParam = parseOptionalString(query.currency);
  const currency = currencyParam && /^[A-Z]{3}$/.test(currencyParam) ? currencyParam : undefined;
  const allowedParam = parseOptionalString(query.allowed);
  const allowed = allowedParam
    ? allowedParam.split(',').filter((k): k is import('@/lib/common/payments/core/contracts/provider').ProviderKey => isProviderKey(k))
    : undefined;

  const [simulation, platformRows, projectRows] = await Promise.all([
    rubricService.simulate({
      flow,
      mode,
      payerCountry: payer,
      receiverCountry: receiver,
      currency,
      allowed: flow === 'project' ? allowed ?? [] : allowed,
    }),
    rubricService.platformMap(),
    rubricService.projectMap(),
  ]);

  const winner = simulation.explanation.result.provider;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Simulator</CardTitle><CardDescription>Runs the same selector code as real checkouts.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <RubricSimulatorForm
            flow={flow}
            mode={mode}
            payer={payer}
            receiver={receiver}
            currency={simulation.input.currency}
            allowed={allowed ?? []}
            countries={countries.map((c) => ({ code: c.countryCode, name: c.name }))}
            currencies={currencies}
            providers={providerKeySchema.options.map((k) => ({ key: k, label: listManifests('project').find((m) => m.key === k)?.brand.name ?? k }))}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                {CHECK_COLUMNS.map((c) => <TableHead key={c} className="capitalize">{c}</TableHead>)}
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simulation.explanation.traces.map((t) => (
                <TableRow key={t.provider}>
                  <TableCell>{t.label}</TableCell>
                  {CHECK_COLUMNS.map((c) => (
                    <TableCell key={c}><CheckBadge check={t.checks.find((k) => k.check === c)!} /></TableCell>
                  ))}
                  <TableCell>
                    {t.provider === winner
                      ? <Badge>Selected</Badge>
                      : t.passed
                        ? <Badge variant="secondary">Passed</Badge>
                        : <Badge variant="outline">Failed</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {simulation.factoryCall ? (
            <Alert>
              <AlertTitle>{simulation.explanation.result.reason}</AlertTitle>
              <AlertDescription>
                <code className="font-mono text-xs">
                  createProvider(&apos;{simulation.factoryCall.provider}&apos;, {simulation.factoryCall.credentialsSource}, &apos;{simulation.factoryCall.environment}&apos;)
                </code>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>No provider</AlertTitle>
              <AlertDescription>{simulation.explanation.result.reason}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {showPlatformMap && <Card>
        <CardHeader><CardTitle>Platform map</CardTitle><CardDescription>Receiver: {PLATFORM_RECEIVER_COUNTRY} · currency: payer&apos;s</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Country</TableHead><TableHead>One-time</TableHead><TableHead>Subscription</TableHead></TableRow></TableHeader>
            <TableBody>
              {platformRows.map((r) => (
                <TableRow key={r.countryCode}>
                  <TableCell>{r.countryCode} · {r.countryName} · {r.currency}</TableCell>
                  <TableCell><ResultBadge result={r.oneTime} /></TableCell>
                  <TableCell><ResultBadge result={r.subscription} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>}

      {showProjectMap && <Card>
        <CardHeader><CardTitle>BYOP map</CardTitle><CardDescription>Assumes the buyer pays from the creator&apos;s country.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Creator country</TableHead><TableHead>Eligible providers</TableHead></TableRow></TableHeader>
            <TableBody>
              {projectRows.map((r) => (
                <TableRow key={r.countryCode}>
                  <TableCell>{r.countryCode} · {r.countryName} · {r.currency}</TableCell>
                  <TableCell>
                    {r.eligible.length === 0
                      ? <span className="text-muted-foreground">—</span>
                      : <div className="flex gap-1">
                          {r.eligible.map((e) => (
                            <Badge key={e.provider} variant="secondary">
                              {e.label}{e.supportsSubscriptions ? '' : ' · no subscriptions'}
                            </Badge>
                          ))}
                        </div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>}
    </div>
  );
}


function PlatformWebhookBlock({ provider, status }: { provider: string; status: Awaited<ReturnType<PlatformProviderService['getStatus']>> }) {
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Webhook</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{status.webhookUrl}</span>
          <CopyButton value={status.webhookUrl} />
        </div>
        <p className="text-xs text-muted-foreground">
          {status.webhookRef
            ? `Registered${status.webhookRegisteredAt ? ` · ${status.webhookRegisteredAt.toLocaleString()}` : ''}`
            : 'Not registered'}
          {status.webhookError ? ` · ${status.webhookError}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          Last event: {status.lastEvent ? `${status.lastEvent.eventType} · ${status.lastEvent.receivedAt.toLocaleString()}` : 'none'}
        </p>
      </div>
      {status.validationReport != null && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Last validation{status.validatedAt ? ` · ${status.validatedAt.toLocaleString()}` : ''}</p>
          <ValidationChecklist report={status.validationReport as unknown as ValidationReport} />
        </div>
      )}
      <ValidateProviderButton provider={provider} />
    </div>
  );
}
