'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCheckoutFlow } from '@/hooks/common/payments/use-checkout-flow';
import { useStartCreditPurchase, useConfirmCreditPurchase } from '@/hooks/platform/payments/mutations';
import { CREDIT_QUICK_PICKS, CREDIT_RATE_MINOR } from '@/lib/common/services/payments/payment-constants';
import { formatMoney } from '@/lib/common/helpers/money';

export function FixedCreditsCard({ gateway, payer }: { gateway: string; payer: string }) {
  const [credits, setCredits] = useState<number>(CREDIT_QUICK_PICKS[0]);
  const start = useStartCreditPurchase();
  const confirm = useConfirmCreditPurchase();
  const flow = useCheckoutFlow();
  return (
    <Card>
      <CardHeader><CardTitle>One-time (fixed)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {CREDIT_QUICK_PICKS.map((c) => (
            <Button key={c} type="button" variant={c === credits ? 'default' : 'outline'} size="sm" onClick={() => setCredits(c)}>{c}</Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{formatMoney(credits * CREDIT_RATE_MINOR, 'INR')}</p>
        <Button disabled={start.isPending} onClick={() =>
          flow.run({
            start: () => start.mutateAsync({ gateway, payerCountry: payer, credits, kind: 'fixed' }),
            confirm: confirm.mutateAsync,
            recordUrl: (id) => `/api/platform/payments/credit-purchases/${id}`,
          })
        }>Buy</Button>
      </CardContent>
    </Card>
  );
}
