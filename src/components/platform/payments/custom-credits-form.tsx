'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { creditPurchaseCreateSchema, type CreditPurchaseCreate } from '@/schemas/platform/payments/credit-purchase.schema';
import { useCheckoutFlow } from '@/hooks/common/payments/use-checkout-flow';
import { useStartCreditPurchase, useConfirmCreditPurchase } from '@/hooks/platform/payments/mutations';
import { CREDIT_RATE_MINOR, MIN_CREDITS, MAX_CREDITS } from '@/lib/common/services/payments/payment-constants';
import { formatMoney } from '@/lib/common/helpers/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function CustomCreditsForm({ gateway, payer }: { gateway: string; payer: string }) {
  const start = useStartCreditPurchase();
  const confirm = useConfirmCreditPurchase();
  const flow = useCheckoutFlow();
  const form = useForm<CreditPurchaseCreate>({
    resolver: zodResolver(creditPurchaseCreateSchema),
    defaultValues: { gateway, payerCountry: payer, credits: MIN_CREDITS, kind: 'custom' },
  });
  const credits = form.watch('credits');
  return (
    <Card>
      <CardHeader><CardTitle>Custom amount</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) =>
            flow.run({
              start: () => start.mutateAsync(data),
              confirm: confirm.mutateAsync,
              recordUrl: (id) => `/api/platform/payments/credit-purchases/${id}`,
            })
          )} className="space-y-3">
            <FormField control={form.control} name="credits" render={({ field }) => (
              <FormItem>
                <FormLabel>Credits ({MIN_CREDITS}–{MAX_CREDITS})</FormLabel>
                <FormControl>
                  <Input type="number" value={Number.isNaN(field.value) ? '' : field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <p className="text-sm text-muted-foreground">
              {Number.isInteger(credits) ? formatMoney(credits * CREDIT_RATE_MINOR, 'INR') : '—'}
            </p>
            <Button type="submit" disabled={start.isPending}>Buy</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
