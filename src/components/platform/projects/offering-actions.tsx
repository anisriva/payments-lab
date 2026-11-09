'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectOfferingUpdateSchema, type ProjectOfferingUpdate } from '@/schemas/platform/projects/project-offering.schema';
import { useUpdateProjectOffering } from '@/hooks/platform/projects/use-update-project-offering';
import { useDeleteProjectOffering } from '@/hooks/platform/projects/use-delete-project-offering';
import { supports } from '@/lib/common/payments/core/contracts/features';
import { getClientAdapter } from '@/lib/common/payments/core/registry.client';
import { isProviderKey } from '@/lib/common/payments/core/registry.client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function OfferingActiveSwitch({ projectId, offeringId, checked }: { projectId: string; offeringId: string; checked: boolean }) {
  const router = useRouter();
  const update = useUpdateProjectOffering(projectId, offeringId);
  return (
    <Switch
      checked={checked}
      disabled={update.isPending}
      onCheckedChange={(isActive) => update.mutate({ isActive }, { onSuccess: () => router.refresh() })}
    />
  );
}

export function OfferingActions({ projectId, offeringId, name, providerKeys = [] }: { projectId: string; offeringId: string; name: string; providerKeys?: string[] }) {
  const router = useRouter();
  const update = useUpdateProjectOffering(projectId, offeringId);
  const del = useDeleteProjectOffering(projectId, offeringId);
  const [open, setOpen] = useState(false);
  const form = useForm<ProjectOfferingUpdate>({
    resolver: zodResolver(projectOfferingUpdateSchema),
    defaultValues: { name },
  });
  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>Rename</DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename offering</DialogTitle><DialogDescription>Price, type and currency can&apos;t change.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => update.mutate(data, { onSuccess: () => { setOpen(false); router.refresh(); } }))} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (
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
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription><span className="block">Only possible while the offering has no orders or subscriptions. This removes it from Payments Lab. Any plan already created in the payment provider stays there unused — providers don&apos;t allow deleting plans.{providerKeys.filter((k) => {
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
