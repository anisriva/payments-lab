'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAYER_COUNTRIES } from '@/lib/common/services/payments/payment-constants';

export function PayerCountrySelect({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <Select value={value} onValueChange={(v) => {
      if (!v) return;
      const q = new URLSearchParams(searchParams.toString());
      q.set('payer', v);
      router.push(`?${q.toString()}`);
    }}>
      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
      <SelectContent>
        {PAYER_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
