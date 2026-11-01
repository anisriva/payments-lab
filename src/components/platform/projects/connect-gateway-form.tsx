'use client';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { paymentConnectionCreateSchema, type PaymentConnectionCreate } from '@/schemas/platform/projects/payment-connection.schema';
import { useConnectPaymentGateway } from '@/hooks/platform/projects/use-connect-payment-gateway';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function ConnectGatewayForm({ projectId, provider }: { projectId: string; provider: string }) {
  const router = useRouter();
  const connect = useConnectPaymentGateway(projectId);
  const form = useForm<PaymentConnectionCreate>({
    resolver: zodResolver(paymentConnectionCreateSchema),
    defaultValues: { provider, keyId: '', keySecret: '', webhookSecret: '' },
  });
  const fields = [
    ['keyId', 'Key ID', 'text'],
    ['keySecret', 'Key secret', 'password'],
    ['webhookSecret', 'Webhook secret', 'password'],
  ] as const;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => connect.mutate(data, { onSuccess: () => { form.reset(); router.refresh(); } }))} className="space-y-3">
        {fields.map(([name, label, type]) => (
          <FormField key={name} control={form.control} name={name} render={({ field }) => (
            <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type={type} autoComplete="off" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        ))}
        <Button type="submit" disabled={connect.isPending}>Connect</Button>
      </form>
    </Form>
  );
}
