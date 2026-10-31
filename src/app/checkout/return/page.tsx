'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePaymentRecordStatus } from '@/hooks/common/payments/use-payment-record-status';
import { StatusBadge } from '@/components/common/payments/status-badge';

function ReturnContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url');
  const back = searchParams.get('back') ?? '/platform';
  const { data } = usePaymentRecordStatus(url);

  return (
    <div className="space-y-4">
      {data?.status === 'pending' || !data ? (
        <p>Confirming payment…</p>
      ) : (
        <StatusBadge status={data.status} />
      )}
      {data?.status === 'pending' && (
        <p className="text-sm text-muted-foreground">Still pending — the webhook or the ↻ button will update it later</p>
      )}
      <Link href={back} className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted">Back</Link>
    </div>
  );
}

export default function CheckoutReturnPage() {
  return <Suspense fallback={<p>Confirming payment…</p>}><ReturnContent /></Suspense>;
}
