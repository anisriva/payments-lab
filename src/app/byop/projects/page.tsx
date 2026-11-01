export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { prisma } from '@/lib/common/connectors/prisma';
import { ProjectService } from '@/lib/platform/services/projects/project-service';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CreateProjectForm } from '@/components/platform/projects/create-project-form';
import { LinkTabs } from '@/components/common/navigation/link-tabs';
const BYOP_TABS = [
  { href: '/byop/projects', label: 'Projects' },
  { href: '/byop/providers', label: 'Providers' },
  { href: '/byop/rubric', label: 'Rubric' },
  { href: '/byop/events', label: 'Events' },
];

export default async function ByopPage() {
  const [{ data: projects }, countries] = await Promise.all([
    new ProjectService(prisma).listProjects(),
    new CountryService(prisma).listCountries(),
  ]);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">BYOP projects</h1>
      <LinkTabs items={BYOP_TABS} />
        <p className="text-muted-foreground">Creator projects connect their own payment gateway accounts.</p>
      </div>
      <Separator />
      <div className="grid gap-6 md:grid-cols-2">
        <CreateProjectForm countries={countries} />
        <Card>
          <CardHeader><CardTitle>Projects</CardTitle><CardDescription>Pick a project to manage its gateways and offerings</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {projects.length === 0 && <p className="text-muted-foreground">No projects yet</p>}
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <Link href={`/byop/projects/${p.id}/razorpay/setup`} className="underline underline-offset-4">{p.name}</Link>
                <span className="text-muted-foreground">{p.countryCode}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
