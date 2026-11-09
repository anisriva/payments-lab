'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { creditPurchaseCreateSchema, type CreditPurchaseCreate } from '@/schemas/platform/payments/credit-purchase.schema';
import { useCheckoutFlow } from '@/hooks/common/payments/use-checkout-flow';
import { useStartCreditPurchase } from '@/hooks/platform/payments/use-start-credit-purchase';
import { useConfirmCreditPurchase } from '@/hooks/platform/payments/use-confirm-credit-purchase';
import { MIN_CREDITS, MAX_CREDITS } from '@/lib/common/services/payments/payment-constants';
import { formatMoney } from '@/lib/common/helpers/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function CustomCreditsForm({ gateway, payer, projectId, rateMinor, currencyCode }: { gateway: string; payer: string; projectId: string; rateMinor: number; currencyCode: string }) {
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
      <CardHeader>
        <CardTitle>Custom amount</CardTitle>
        <CardDescription>Any credit amount between {MIN_CREDITS} and {MAX_CREDITS}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) =>
          flow.run({
            start: () => start.mutateAsync(data),
            confirm: confirm.mutateAsync,
            recordUrl: (id) => `/api/platform/payments/credit-purchases/${id}`,
          })
        )}>
          <CardContent className="space-y-3">
            <FormField control={form.control} name="credits" render={({ field }) => (
              <FormItem>
                <FormLabel>Credits</FormLabel>
                <FormControl>
                  <Input type="number" value={Number.isNaN(field.value) ? '' : field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div>
              <p className="text-2xl font-semibold">
                {Number.isInteger(credits) ? formatMoney(credits * rateMinor, currencyCode) : '—'}
              </p>
              <p className="text-sm text-muted-foreground">≈ {Number.isInteger(credits) ? credits : 0} credits</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={start.isPending}>Buy credits</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
