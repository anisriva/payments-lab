'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { planPriceCreateSchema, type PlanPriceCreate } from '@/schemas/platform/catalog/plan-price.schema';
import { useCreatePlanPrice } from '@/hooks/platform/catalog/use-create-plan-price';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function CreatePlanPriceForm({ currencies }: { currencies: string[] }) {
  const router = useRouter();
  const create = useCreatePlanPrice();
  const [open, setOpen] = useState(false);
  const form = useForm<PlanPriceCreate>({
    resolver: zodResolver(planPriceCreateSchema),
    defaultValues: { planKey: '', displayName: '', interval: 'monthly', amountMinor: 0, currencyCode: 'INR' },
  });
  const currencyCode = form.watch('currencyCode');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add plan price</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New plan price</DialogTitle><DialogDescription>A plan is provisioned eagerly at every capable provider.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => create.mutate(data, { onSuccess: () => { setOpen(false); form.reset(); router.refresh(); } }))} className="space-y-3">
            <FormField control={form.control} name="planKey" render={({ field }) => (
              <FormItem><FormLabel>Plan key</FormLabel><FormControl><Input placeholder="premium" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="displayName" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Premium Monthly" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="interval" render={({ field }) => (
              <FormItem><FormLabel>Interval</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="currencyCode" render={({ field }) => (
              <FormItem><FormLabel>Currency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="amountMinor" render={({ field }) => (
              <FormItem><FormLabel>Price ({currencyCode})</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="1"
                    value={Number.isNaN(field.value) ? '' : field.value / 100}
                    onChange={(e) => field.onChange(Number.isNaN(e.target.valueAsNumber) ? NaN : Math.round(e.target.valueAsNumber * 100))} />
                </FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
