export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { ProvidersSection } from '@/components/platform/catalog/sections';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const PLATFORM_TABS = [
  { href: '/platform/checkout/auto', label: 'Checkout' },
  { href: '/platform/plans', label: 'Plans & credits' },
  { href: '/platform/providers', label: 'Providers' },
  { href: '/platform/rubric', label: 'Rubric' },
  { href: '/platform/events', label: 'Events' },
];

export default function PlatformProvidersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
      <LinkTabs items={PLATFORM_TABS} />
        <p className="text-muted-foreground">Payment providers Folio uses for its own checkout.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ProvidersSection flow="platform" />
      </Suspense>
    </div>
  );
}
