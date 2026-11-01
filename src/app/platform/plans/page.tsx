export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { parseEnumParam, parsePositivePage } from '@/lib/common/helpers/url-parsers';
import { PlanPricesSection, CreditRatesSection } from '@/components/platform/catalog/sections';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const PLATFORM_TABS = [
  { href: '/platform/checkout/auto', label: 'Checkout' },
  { href: '/platform/plans', label: 'Plans & credits' },
  { href: '/platform/providers', label: 'Providers' },
  { href: '/platform/rubric', label: 'Rubric' },
  { href: '/platform/events', label: 'Events' },
];

const SECTIONS = ['plan-prices', 'credit-rates'] as const;

export default async function PlansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const section = parseEnumParam(query.section, SECTIONS, 'plan-prices');
  const page = parsePositivePage(query.page);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Plans &amp; credits</h1>
      <LinkTabs items={PLATFORM_TABS} />
        <p className="text-muted-foreground">What Folio charges creators.</p>
      </div>
      <LinkTabs items={SECTIONS.map((s) => ({ href: `/platform/plans?section=${s}`, label: s === 'plan-prices' ? 'Plan prices' : 'Credit rates' }))} />
      <Suspense key={`${section}-${page}`} fallback={<Skeleton className="h-64" />}>
        {section === 'plan-prices' ? <PlanPricesSection page={page} /> : <CreditRatesSection page={page} />}
      </Suspense>
    </div>
  );
}
