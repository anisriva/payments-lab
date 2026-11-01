'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { TableRow } from '@/components/ui/table';

export function EventRow({ id, children }: { id: string; children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => {
        const q = new URLSearchParams(searchParams.toString());
        q.set('event', id);
        router.push(`?${q.toString()}`);
      }}
    >
      {children}
    </TableRow>
  );
}
