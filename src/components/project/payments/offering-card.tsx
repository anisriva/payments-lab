'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectOrderCreateSchema, type ProjectOrderCreate } from '@/schemas/project/payments/project-order.schema';
import { useCheckoutFlow } from '@/hooks/common/payments/use-checkout-flow';
import { useStartProjectOrder } from '@/hooks/project/payments/use-start-project-order';
import { useConfirmProjectOrder } from '@/hooks/project/payments/use-confirm-project-order';
import { useStartProjectSubscription } from '@/hooks/project/payments/use-start-project-subscription';
import { useConfirmProjectSubscription } from '@/hooks/project/payments/use-confirm-project-subscription';
import { formatMoney } from '@/lib/common/helpers/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import type { ProjectOffering } from '@/generated/prisma';

export function OfferingCard({ projectId, offering, buyer }: { projectId: string; offering: ProjectOffering; buyer: string }) {
  const startOrder = useStartProjectOrder(projectId);
  const confirmOrder = useConfirmProjectOrder(projectId);
  const startSub = useStartProjectSubscription(projectId);
  const confirmSub = useConfirmProjectSubscription(projectId);
  const flow = useCheckoutFlow();
  const form = useForm<ProjectOrderCreate>({
    resolver: zodResolver(projectOrderCreateSchema),
    defaultValues: { provider: 'razorpay', offeringId: offering.id, buyerEmail: buyer, amountMinor: offering.amountMinor },
  });

  if (offering.priceType === 'recurring') {
    return (
      <Card>
        <CardHeader><CardTitle>{offering.name}</CardTitle><CardDescription>Subscription</CardDescription></CardHeader>
        <CardContent><p className="text-2xl font-semibold">{formatMoney(offering.amountMinor, offering.currencyCode)}<span className="text-sm font-normal text-muted-foreground"> / {offering.interval}</span></p></CardContent>
        <CardFooter>
          <Button disabled={startSub.isPending} onClick={() =>
            flow.run({
              start: () => startSub.mutateAsync({ provider: 'razorpay', offeringId: offering.id, buyerEmail: buyer }),
              confirm: confirmSub.mutateAsync,
              recordUrl: (id) => `/api/project/${projectId}/payments/subscriptions/${id}`,
            })
          }>Subscribe</Button>
        </CardFooter>
      </Card>
    );
  }

  if (offering.priceType === 'custom') {
    return (
      <Card>
        <CardHeader><CardTitle>{offering.name}</CardTitle><CardDescription>Pay what you want</CardDescription></CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) =>
            flow.run({
              start: () => startOrder.mutateAsync(data),
              confirm: confirmOrder.mutateAsync,
              recordUrl: (id) => `/api/project/${projectId}/payments/orders/${id}`,
            })
          )}>
            <CardContent className="space-y-3">
              <FormField control={form.control} name="amountMinor" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input type="number" step="0.01" min={offering.amountMinor / 100}
                      value={Number.isNaN(field.value) ? '' : (field.value ?? 0) / 100}
                      onChange={(e) => field.onChange(Number.isNaN(e.target.valueAsNumber) ? undefined : Math.round(e.target.valueAsNumber * 100))} />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">min {formatMoney(offering.amountMinor, offering.currencyCode)}</p>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
            <CardFooter><Button type="submit" disabled={startOrder.isPending}>Pay</Button></CardFooter>
          </form>
        </Form>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>{offering.name}</CardTitle><CardDescription>One-time</CardDescription></CardHeader>
      <CardContent><p className="text-2xl font-semibold">{formatMoney(offering.amountMinor, offering.currencyCode)}</p></CardContent>
      <CardFooter>
        <Button disabled={startOrder.isPending} onClick={() =>
          flow.run({
            start: () => startOrder.mutateAsync({ provider: 'razorpay', offeringId: offering.id, buyerEmail: buyer }),
            confirm: confirmOrder.mutateAsync,
            recordUrl: (id) => `/api/project/${projectId}/payments/orders/${id}`,
          })
        }>Buy</Button>
      </CardFooter>
    </Card>
  );
}
