'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCheckoutFlow } from '@/hooks/common/payments/use-checkout-flow';
import { useStartCreditPurchase } from '@/hooks/platform/payments/use-start-credit-purchase';
import { useConfirmCreditPurchase } from '@/hooks/platform/payments/use-confirm-credit-purchase';
import { CREDIT_QUICK_PICKS } from '@/lib/common/services/payments/payment-constants';
import { formatMoney } from '@/lib/common/helpers/money';

export function FixedCreditsCard({ gateway, payer, projectId, rateMinor, currencyCode }: { gateway: string; payer: string; projectId: string; rateMinor: number; currencyCode: string }) {
  const [credits, setCredits] = useState<number>(CREDIT_QUICK_PICKS[0]);
  const start = useStartCreditPurchase();
  const confirm = useConfirmCreditPurchase();
  const flow = useCheckoutFlow();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick purchase</CardTitle>
        <CardDescription>Buy a preset credit pack at {formatMoney(rateMinor, currencyCode)}/credit</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleGroup value={[String(credits)]} onValueChange={(v) => v.length > 0 && setCredits(Number(v[0]))}>
          {CREDIT_QUICK_PICKS.map((c) => (
            <ToggleGroupItem key={c} value={String(c)}>{c}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div>
          <p className="text-2xl font-semibold">{formatMoney(credits * rateMinor, currencyCode)}</p>
          <p className="text-sm text-muted-foreground">≈ {credits} credits</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button disabled={start.isPending} onClick={() =>
          flow.run({
            start: () => start.mutateAsync({ projectId, gateway, payerCountry: payer, credits, kind: 'fixed' }),
            confirm: confirm.mutateAsync,
            recordUrl: (id) => `/api/platform/payments/credit-purchases/${id}`,
          })
        }>Buy credits</Button>
      </CardFooter>
    </Card>
  );
}
