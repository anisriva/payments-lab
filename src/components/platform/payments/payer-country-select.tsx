'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function PayerCountrySelect({ value, options }: { value: string; options: { code: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground">Simulate payer country</Label>
      <Select value={value} onValueChange={(v) => {
        if (!v) return;
        const q = new URLSearchParams(searchParams.toString());
        q.set('payer', v);
        router.push(`?${q.toString()}`);
      }}>
        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
