'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { planPriceUpdateSchema, type PlanPriceUpdate } from '@/schemas/platform/catalog/plan-price.schema';
import { useUpdatePlanPrice } from '@/hooks/platform/catalog/use-update-plan-price';
import { useDeletePlanPrice } from '@/hooks/platform/catalog/use-delete-plan-price';
import { supports } from '@/lib/common/payments/core/contracts/features';
import { getClientAdapter } from '@/lib/common/payments/core/registry.client';
import { isProviderKey } from '@/lib/common/payments/core/registry.client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function PlanPriceActiveSwitch({ id, checked }: { id: string; checked: boolean }) {
  const router = useRouter();
  const update = useUpdatePlanPrice(id);
  return (
    <Switch
      checked={checked}
      disabled={update.isPending}
      onCheckedChange={(isActive) => update.mutate({ isActive }, { onSuccess: () => router.refresh() })}
    />
  );
}

export function PlanPriceActions({ id, displayName, providerKeys = [] }: { id: string; displayName: string; providerKeys?: string[] }) {
  const router = useRouter();
  const update = useUpdatePlanPrice(id);
  const del = useDeletePlanPrice(id);
  const [open, setOpen] = useState(false);
  const form = useForm<PlanPriceUpdate>({
    resolver: zodResolver(planPriceUpdateSchema),
    defaultValues: { displayName },
  });
  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>Rename</DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename plan price</DialogTitle><DialogDescription>Only the display name can change.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => update.mutate(data, { onSuccess: () => { setOpen(false); router.refresh(); } }))} className="space-y-3">
              <FormField control={form.control} name="displayName" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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
            <AlertDialogTitle>Delete plan price?</AlertDialogTitle>
            <AlertDialogDescription><span className="block">This removes it from Payments Lab. Any plan already created in the payment provider stays there unused — providers don&apos;t allow deleting plans.{providerKeys.filter((k) => {
                  const m = isProviderKey(k) ? getClientAdapter(k).manifest : null;
                  return m && !supports(m, 'subscription_plan.disable');
                }).map((k) => {
                  const m = getClientAdapter(k as never).manifest;
                  const step = (m.features['subscription_plan.disable'] as { manual?: { title: string; steps: string[] } }).manual;
                  return step ? (
                    <span key={k} className="mt-2 block text-sm">
                      <span className="block font-medium">{m.brand.name}: {step.title}</span>
                      <ol className="list-decimal pl-5">{step.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
                    </span>
                  ) : null;
                })}
              </span></AlertDialogDescription>
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
