'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { creditRateCreateSchema, type CreditRateCreate } from '@/schemas/platform/catalog/credit-rate.schema';
import { useCreateCreditRate } from '@/hooks/platform/catalog/use-create-credit-rate';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function CreateCreditRateForm({ currencies }: { currencies: string[] }) {
  const router = useRouter();
  const create = useCreateCreditRate();
  const [open, setOpen] = useState(false);
  const form = useForm<CreditRateCreate>({
    resolver: zodResolver(creditRateCreateSchema),
    defaultValues: { currencyCode: 'INR', rateMinor: 0 },
  });
  const currencyCode = form.watch('currencyCode');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add rate</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New credit rate</DialogTitle><DialogDescription>Price of one AI credit in the chosen currency.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => create.mutate(data, { onSuccess: () => { setOpen(false); form.reset(); router.refresh(); } }))} className="space-y-3">
            <FormField control={form.control} name="currencyCode" render={({ field }) => (
              <FormItem><FormLabel>Currency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="rateMinor" render={({ field }) => (
              <FormItem><FormLabel>Rate per credit ({currencyCode})</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0.01"
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
