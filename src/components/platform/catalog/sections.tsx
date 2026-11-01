import { prisma } from '@/lib/common/connectors/prisma';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import { ProviderSettingsService } from '@/lib/common/services/payments/provider-settings-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { RubricService } from '@/lib/common/services/payments/rubric-service';
import { isProviderKey, listProviders } from '@/lib/common/payments/core/factory';
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
import {} from '@/lib/common/payments/core/factory';
import { PlatformProviderService } from '@/lib/platform/services/payments/platform-provider-service';
import {} from '@/lib/common/services/payments/webhook-registration-service';
import { ValidationChecklist } from '@/components/common/payments/validation-checklist';
import { CopyButton } from '@/components/project/payments/copy-button';
import { ValidateProviderButton } from '@/components/platform/payments/validate-provider-button';
import type { ValidationReport } from '@/lib/common/payments/core/types';

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
                <TableCell className="font-mono text-xs">{p.planKey}</TableCell>
                <TableCell>{p.displayName}</TableCell>
                <TableCell>{p.interval}</TableCell>
                <TableCell>{formatMoney(p.amountMinor, p.currencyCode)}</TableCell>
                <TableCell>{p.currencyCode}</TableCell>
                <TableCell>
                  {p.providerRefs.length === 0
                    ? <span className="text-muted-foreground">—</span>
                    : p.providerRefs.map((r) => (
                        <div key={r.provider} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{r.provider}</span>
                          <RefCell value={r.providerRef} />
                        </div>
                      ))}
                </TableCell>
                <TableCell><PlanPriceActiveSwitch id={p.id} checked={p.isActive} /></TableCell>
                <TableCell><PlanPriceActions id={p.id} displayName={p.displayName} /></TableCell>
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
            <TableRow><TableHead>Currency</TableHead><TableHead>Rate per credit</TableHead><TableHead>Active</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {rates.data.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No credit rates yet</TableCell></TableRow>}
            {rates.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.currencyCode}</TableCell>
                <TableCell>{formatMoney(r.rateMinor, r.currencyCode)}</TableCell>
                <TableCell><CreditRateActiveSwitch id={r.id} checked={r.isActive} /></TableCell>
                <TableCell><CreditRateActions id={r.id} rateMinor={r.rateMinor} /></TableCell>
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
  const providerSettingsService = new ProviderSettingsService(prisma);
  const countryService = new CountryService(prisma);
  const [settings, countries, currencies] = await Promise.all([
    providerSettingsService.listSettingsForCatalog(flow),
    countryService.listCountries(),
    countryService.listCurrencies(),
  ]);
  const platformService = new PlatformProviderService(prisma);
  const statuses = flow === 'platform'
    ? new Map(await Promise.all(settings.map(async (s) => [s.provider, s.code.implemented ? await platformService.getStatus(s.provider) : null] as const)))
    : null;

  return (
    <div className="space-y-4">
      {settings.map((s) => (
        <Card key={s.provider}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{s.code.label}</CardTitle>
              <Badge variant={s.code.implemented ? 'secondary' : 'outline'}>{s.code.implemented ? 'implemented' : 'not implemented'}</Badge>
              {s.code.flows.map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
              {s.code.supportsSubscriptions && <Badge variant="outline">subscriptions</Badge>}
              {s.code.supportsCustomAmount && <Badge variant="outline">custom amount</Badge>}
            </div>
            <CardDescription>{s.hasRow ? 'Custom rules stored in the Catalog' : 'Using code defaults — saving creates a Catalog row'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Capabilities</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {[
                      ['Subscriptions', s.code.supportsSubscriptions],
                      ['Custom amounts', s.code.supportsCustomAmount],
                      ['Automatic webhook registration', s.profile.webhook.autoRegister],
                      ['Webhook disable', s.profile.webhook.canDeactivate],
                      ['Webhook delete', s.profile.webhook.canDelete],
                      ['Plan edit', s.profile.catalog.plansEditable],
                      ['Plan delete', s.profile.catalog.plansDeletable],
                    ].map(([label, ok]) => (
                      <li key={String(label)}>{ok ? '✓' : '✗'} {String(label)}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Constraints</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {s.profile.constraints.map((c) => <li key={c}>· {c}</li>)}
                  </ul>
                </div>
              </div>
            )}
            {s.profile && flow === 'project' && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Onboarding preview</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  {s.profile.onboarding.map((o) => (
                    <li key={o.title}>{o.title}{o.docsUrl ? ` — ${o.docsUrl}` : ''}</li>
                  ))}
                </ol>
              </div>
            )}
            {flow === 'platform' && s.code.implemented && statuses?.get(s.provider) && (
              <PlatformWebhookBlock provider={s.provider} status={statuses.get(s.provider)!} />
            )}
            {s.code.implemented ? (
              <ProviderSettingsForm
                provider={s.provider}
                flow={flow}
                initial={{
                  isEnabled: s.effective.enabled !== false,
                  receiverCountries: s.effective.receiverCountries,
                  payerCountries: s.effective.payerCountries,
                  currencies: s.effective.currencies,
                }}
                countries={countries}
                currencies={currencies}
              />
            ) : (
              <Alert><AlertTitle>Not implemented yet</AlertTitle><AlertDescription>{s.code.label} has no adapter, so its rules can&apos;t be edited.</AlertDescription></Alert>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const CHECK_COLUMNS = ['allowed', 'implemented', 'enabled', 'receiver', 'payer', 'currency', 'subscriptions'] as const;

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
  const countryCodes = countries.map((c) => c.code);

  const flow = lockedFlow ?? parseEnumParam(query.flow, ['platform', 'project'] as const, 'platform');
  const mode = parseEnumParam(query.mode, ['one_time', 'subscription'] as const, 'one_time');
  const payer = parseEnumParam(query.payer, countryCodes, 'IN');
  const receiver = parseEnumParam(query.receiver, countryCodes, 'IN');
  const currencyParam = parseOptionalString(query.currency);
  const currency = currencyParam && /^[A-Z]{3}$/.test(currencyParam) ? currencyParam : undefined;
  const allowedParam = parseOptionalString(query.allowed);
  const allowed = allowedParam
    ? allowedParam.split(',').filter((k): k is import('@/lib/common/payments/core/types').ProviderKey => isProviderKey(k))
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
            countries={countries}
            currencies={currencies}
            providers={listProviders('project').map((p) => ({ key: p.key, label: p.label }))}
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
