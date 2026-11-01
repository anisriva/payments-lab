'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { creditRateUpdateSchema, type CreditRateUpdate } from '@/schemas/platform/catalog/credit-rate.schema';
import { useUpdateCreditRate } from '@/hooks/platform/catalog/use-update-credit-rate';
import { useDeleteCreditRate } from '@/hooks/platform/catalog/use-delete-credit-rate';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function CreditRateActiveSwitch({ id, checked }: { id: string; checked: boolean }) {
  const router = useRouter();
  const update = useUpdateCreditRate(id);
  return (
    <Switch
      checked={checked}
      disabled={update.isPending}
      onCheckedChange={(isActive) => update.mutate({ isActive }, { onSuccess: () => router.refresh() })}
    />
  );
}

export function CreditRateActions({ id, rateMinor }: { id: string; rateMinor: number }) {
  const router = useRouter();
  const update = useUpdateCreditRate(id);
  const del = useDeleteCreditRate(id);
  const [open, setOpen] = useState(false);
  const form = useForm<CreditRateUpdate>({
    resolver: zodResolver(creditRateUpdateSchema),
    defaultValues: { rateMinor },
  });
  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>Edit rate</DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit credit rate</DialogTitle><DialogDescription>The currency is fixed — only the rate can change.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => update.mutate(data, { onSuccess: () => { setOpen(false); router.refresh(); } }))} className="space-y-3">
              <FormField control={form.control} name="rateMinor" render={({ field }) => (
                <FormItem><FormLabel>Rate per credit</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0.01"
                      value={field.value === undefined || Number.isNaN(field.value) ? '' : field.value / 100}
                      onChange={(e) => field.onChange(Number.isNaN(e.target.valueAsNumber) ? NaN : Math.round(e.target.valueAsNumber * 100))} />
                  </FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={update.isPending}>Save</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete credit rate?</AlertDialogTitle>
            <AlertDialogDescription>Credit purchases in this currency will stop working until a new rate is added.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate(undefined, { onSuccess: () => router.refresh() })} disabled={del.isPending}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
