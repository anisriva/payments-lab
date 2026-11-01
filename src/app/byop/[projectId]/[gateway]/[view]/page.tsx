import { redirect } from 'next/navigation';
export default async function LegacyByopView({ params, searchParams }: { params: Promise<{ projectId: string; gateway: string; view: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId, gateway, view } = await params;
  const q = new URLSearchParams();
  const query = await searchParams;
  for (const [k, v] of Object.entries(query)) { if (typeof v === 'string') q.set(k, v); }
  const qs = q.toString();
  redirect(`/byop/projects/${projectId}/${gateway}/${view}${qs ? `?${qs}` : ''}`);
}
