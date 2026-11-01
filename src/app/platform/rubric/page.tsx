export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { RubricSection } from '@/components/platform/catalog/sections';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const PLATFORM_TABS = [
  { href: '/platform/checkout/auto', label: 'Checkout' },
  { href: '/platform/plans', label: 'Plans & credits' },
  { href: '/platform/providers', label: 'Providers' },
  { href: '/platform/rubric', label: 'Rubric' },
  { href: '/platform/events', label: 'Events' },
];

export default async function PlatformRubricPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rubric</h1>
      <LinkTabs items={PLATFORM_TABS} />
        <p className="text-muted-foreground">How Folio picks a provider for each purchase.</p>
      </div>
      <Suspense key={JSON.stringify(query)} fallback={<Skeleton className="h-64" />}>
        <RubricSection query={query} lockedFlow="platform" showProjectMap={false} />
      </Suspense>
    </div>
  );
}
