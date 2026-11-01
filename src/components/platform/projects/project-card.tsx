'use client';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectUpdateSchema, type ProjectUpdate } from '@/schemas/platform/projects/project.schema';
import { useUpdateProject } from '@/hooks/platform/projects/use-update-project';
import { useDeleteProject } from '@/hooks/platform/projects/use-delete-project';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function ProjectCard({
  project,
  countries,
}: {
  project: { id: string; name: string; countryCode: string };
  countries: { code: string; name: string }[];
}) {
  const router = useRouter();
  const update = useUpdateProject(project.id);
  const del = useDeleteProject(project.id);
  const form = useForm<ProjectUpdate>({
    resolver: zodResolver(projectUpdateSchema),
    defaultValues: { name: project.name, countryCode: project.countryCode },
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle>Project</CardTitle><CardDescription>Country locks once the project has offerings.</CardDescription></div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>Delete project</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
              <AlertDialogDescription>Only possible while the project has no connections, offerings, orders or subscriptions.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate(undefined, { onSuccess: () => router.push('/byop') })} disabled={del.isPending}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => update.mutate(data, { onSuccess: () => router.refresh() }))}>
          <CardContent className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="countryCode" render={({ field }) => (
              <FormItem><FormLabel>Country</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{countries.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
          </CardContent>
          <CardFooter><Button type="submit" disabled={update.isPending}>Save</Button></CardFooter>
        </form>
      </Form>
    </Card>
  );
}
