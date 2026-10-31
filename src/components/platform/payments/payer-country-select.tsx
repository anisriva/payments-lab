'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PAYER_COUNTRIES } from '@/lib/common/services/payments/payment-constants';

export function PayerCountrySelect({ value }: { value: string }) {
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
          {PAYER_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
