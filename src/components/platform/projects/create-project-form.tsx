'use client';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectCreateSchema, type ProjectCreate } from '@/schemas/platform/projects/project.schema';
import { useCreateProject } from '@/hooks/platform/projects/use-create-project';
import { PAYER_COUNTRIES } from '@/lib/common/services/payments/payment-constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function CreateProjectForm() {
  const router = useRouter();
  const create = useCreateProject();
  const form = useForm<ProjectCreate>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: { name: '', countryCode: 'IN' },
  });
  return (
    <Card>
      <CardHeader><CardTitle>New project</CardTitle><CardDescription>A creator project that brings its own payment keys</CardDescription></CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => create.mutate(data, { onSuccess: () => { form.reset(); router.refresh(); } }))}>
          <CardContent className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="countryCode" render={({ field }) => (
              <FormItem><FormLabel>Country</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{PAYER_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
          </CardContent>
          <CardFooter><Button type="submit" disabled={create.isPending}>Create project</Button></CardFooter>
        </form>
      </Form>
    </Card>
  );
}
