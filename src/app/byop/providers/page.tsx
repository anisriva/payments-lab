export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { ProvidersSection } from '@/components/platform/catalog/sections';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const BYOP_TABS = [
  { href: '/byop/projects', label: 'Projects' },
  { href: '/byop/providers', label: 'Providers' },
  { href: '/byop/rubric', label: 'Rubric' },
  { href: '/byop/events', label: 'Events' },
];

export default function ByopProvidersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
      <LinkTabs items={BYOP_TABS} />
        <p className="text-muted-foreground">Payment providers creators can connect to their projects.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ProvidersSection flow="project" />
      </Suspense>
    </div>
  );
}
