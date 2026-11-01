'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectOfferingCreateSchema, type ProjectOfferingCreate } from '@/schemas/platform/projects/project-offering.schema';
import { useCreateProjectOffering } from '@/hooks/platform/projects/use-create-project-offering';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function CreateOfferingForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const create = useCreateProjectOffering(projectId);
  const [open, setOpen] = useState(false);
  const form = useForm<ProjectOfferingCreate>({
    resolver: zodResolver(projectOfferingCreateSchema),
    defaultValues: { name: '', priceType: 'fixed', amountMinor: 0 },
  });
  const priceType = form.watch('priceType');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add offering</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New offering</DialogTitle><DialogDescription>Something buyers can purchase</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => create.mutate(data, { onSuccess: () => { setOpen(false); form.reset(); router.refresh(); } }))} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="priceType" render={({ field }) => (
              <FormItem><FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed price</SelectItem>
                    <SelectItem value="custom">Custom (min)</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="amountMinor" render={({ field }) => (
              <FormItem><FormLabel>{priceType === 'custom' ? 'Minimum amount (₹)' : 'Amount (₹)'}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="1"
                    value={Number.isNaN(field.value) ? '' : field.value / 100}
                    onChange={(e) => field.onChange(Number.isNaN(e.target.valueAsNumber) ? NaN : Math.round(e.target.valueAsNumber * 100))} />
                </FormControl><FormMessage /></FormItem>
            )} />
            {priceType === 'recurring' && (
              <FormField control={form.control} name="interval" render={({ field }) => (
                <FormItem><FormLabel>Interval</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || undefined)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            )}
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
