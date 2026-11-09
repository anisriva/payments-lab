'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function PayingProjectSelect({ value, options }: { value?: string; options: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  return (
    <div className="space-y-1">
      <Label>Paying for project</Label>
      <Select value={value} onValueChange={(v) => {
        const q = new URLSearchParams(params?.toString() ?? '');
        q.set('project', v ?? '');
        router.push(`${pathname ?? '/'}?${q.toString()}`);
      }}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
