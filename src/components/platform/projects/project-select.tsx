'use client';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ProjectSelect({ projects, value, gateway, view, buyer }: {
  projects: { id: string; name: string }[]; value: string; gateway: string; view: string; buyer: string;
}) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(v) => v && router.push(`/byop/${v}/${gateway}/${view}?buyer=${encodeURIComponent(buyer)}`)}>
      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
      <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
