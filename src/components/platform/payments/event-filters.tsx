'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function EventFilters({
  provider,
  scope,
  providers,
  projects,
  projectId,
}: {
  provider: string;
  scope?: string;
  providers: { key: string; label: string }[];
  projects?: { id: string; name: string }[];
  projectId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = (key: string, value: string | null) => {
    const q = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') q.delete(key);
    else q.set(key, value);
    q.delete('page');
    router.push(`?${q.toString()}`);
  };

  return (
    <div className="flex items-end gap-4">
      <div className="space-y-2">
        <Label>Provider</Label>
        <Select value={provider || 'all'} onValueChange={(v) => update('provider', v === 'all' ? null : v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {providers.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {projects && (
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={projectId || 'all'} onValueChange={(v) => update('project', v === 'all' ? null : v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {scope !== undefined && <div className="space-y-2">
        <Label>Scope</Label>
        <Input
          className="w-64"
          placeholder="platform or connection id"
          defaultValue={scope}
          onBlur={(e) => update('scope', e.target.value.trim() || null)}
          onKeyDown={(e) => { if (e.key === 'Enter') update('scope', e.currentTarget.value.trim() || null); }}
        />
      </div>}
    </div>
  );
}
