'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function BuyerEmailInput({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground">Buyer email</Label>
      <Input className="w-56" defaultValue={value}
        onBlur={(e) => {
          const q = new URLSearchParams(searchParams.toString());
          q.set('buyer', e.target.value);
          router.push(`?${q.toString()}`);
        }} />
    </div>
  );
}
