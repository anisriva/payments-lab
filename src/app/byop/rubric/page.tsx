export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { RubricSection } from '@/components/platform/catalog/sections';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const BYOP_TABS = [
  { href: '/byop/projects', label: 'Projects' },
  { href: '/byop/providers', label: 'Providers' },
  { href: '/byop/rubric', label: 'Rubric' },
  { href: '/byop/events', label: 'Events' },
];

export default async function ByopRubricPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rubric</h1>
      <LinkTabs items={BYOP_TABS} />
        <p className="text-muted-foreground">Which providers a creator&apos;s project can use.</p>
      </div>
      <Suspense key={JSON.stringify(query)} fallback={<Skeleton className="h-64" />}>
        <RubricSection query={query} lockedFlow="project" showPlatformMap={false} />
      </Suspense>
    </div>
  );
}
