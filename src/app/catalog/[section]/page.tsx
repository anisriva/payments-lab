import { redirect } from 'next/navigation';
const MAP: Record<string, string> = {
  'plan-prices': '/platform/plans?section=plan-prices',
  'credit-rates': '/platform/plans?section=credit-rates',
  providers: '/platform/providers',
  rubric: '/platform/rubric',
  countries: '/platform/providers',
};
export default async function CatalogSectionRedirect({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { section } = await params;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) { if (typeof v === 'string') q.set(k, v); }
  const target = MAP[section] ?? '/platform/plans?section=plan-prices';
  const qs = q.toString();
  redirect(qs ? `${target}&${qs}` : target);
}
