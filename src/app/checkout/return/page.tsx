'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { getClientAdapter, isProviderKey } from '@/lib/common/payments/core/registry.client';
import { useSearchParams } from 'next/navigation';
import { usePaymentRecordStatus } from '@/hooks/common/payments/use-payment-record-status';
import { StatusBadge } from '@/components/common/payments/status-badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buttonVariants } from '@/components/ui/button';

function ReturnContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url');
  const back = searchParams.get('back') ?? '/platform';
  const { data } = usePaymentRecordStatus(url);
  const provider = searchParams.get('provider');
  const brand = provider && isProviderKey(provider) ? getClientAdapter(provider).manifest.brand.name : undefined;

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Payment status</CardTitle>
        <CardDescription>Latest state of your payment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data || data.status === 'pending' ? (
          <>
            <p className="text-sm text-muted-foreground">Confirming payment…</p>
            <Skeleton className="h-6 w-24" />
            <p className="text-sm text-muted-foreground">Still pending — the webhook or the ↻ button will update it later</p>
          </>
        ) : (
          <StatusBadge status={data.status} />
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2">
        {brand && <p className="text-xs text-muted-foreground">Powered by {brand}</p>}
        <Link href={back} className={buttonVariants({ variant: 'outline' })}>Back</Link>
      </CardFooter>
    </Card>
  );
}

export default function CheckoutReturnPage() {
  return <Suspense fallback={<Skeleton className="mx-auto h-40 max-w-md" />}><ReturnContent /></Suspense>;
}
