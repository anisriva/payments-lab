'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ReactMarkdown from 'react-markdown';
import { useConnectPaymentGateway } from '@/hooks/platform/projects/use-connect-payment-gateway';
import { ValidationChecklist } from '@/components/common/payments/validation-checklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CopyButton } from '@/components/project/payments/copy-button';
import { getClientAdapter } from '@/lib/common/payments/core/registry.client';
import type { ValidationReport } from '@/lib/common/payments/core/connection-checks';
import type { z } from 'zod';

export function ConnectGatewayForm({
  projectId,
  provider,
  webhookUrl,
}: {
  projectId: string;
  provider: string;
  webhookUrl: string;
}) {
  const adapter = getClientAdapter(provider as never);
  const router = useRouter();
  const connect = useConnectPaymentGateway(projectId);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const form = useForm<z.infer<typeof adapter.credentials.input>>({
    resolver: zodResolver(adapter.credentials.input),
    mode: 'onBlur',
  });

  const manual = (Object.entries(adapter.manifest.features) as [string, { supported: boolean; manual?: { title: string; steps: string[]; shows?: string[] } }][])
    .map(([, f]) => f.manual)
    .filter((m): m is NonNullable<typeof m> => !!m);

  const submit = form.handleSubmit((values) => {
    connect.mutate(
      { provider, credentials: values as Record<string, string> },
      {
        onSuccess: (data) => {
          const d = data as { saved: boolean; report: ValidationReport };
          if (d.saved) router.refresh();
          else setReport(d.report);
        },
      }
    );
  });

  return (
    <div className="space-y-4">
      <Dialog>
        <DialogTrigger render={<Button variant="outline" size="sm">Setup guide</Button>} />
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{adapter.manifest.brand.name} — setup guide</DialogTitle></DialogHeader>
          <div className="prose prose-sm max-w-none"><ReactMarkdown>{adapter.onboarding}</ReactMarkdown></div>
        </DialogContent>
      </Dialog>

      <Form {...form}>
        <form onSubmit={submit} className="space-y-3">
          {adapter.credentials.inputFields.map((f) => (
            <FormField key={f.key} control={form.control} name={f.key} render={({ field }) => (
              <FormItem>
                <FormLabel>{f.label}</FormLabel>
                <FormControl><Input type={f.secret ? 'password' : 'text'} placeholder={f.placeholder} autoComplete="off" {...field} value={field.value != null ? String(field.value) : ''} /></FormControl>
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                <FormMessage />
              </FormItem>
            )} />
          ))}
          <Button type="submit" disabled={connect.isPending}>Connect</Button>
        </form>
      </Form>

      {manual.map((m, i) => (
        <Alert key={`${m.title}-${i}`}>
          <AlertTitle>Manual step — {m.title}</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal pl-5 text-sm space-y-1">
              {m.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <div className="mt-2 space-y-2">
              {(m.shows ?? []).includes('webhookUrl') && (
                <div className="flex items-center gap-2"><span className="font-mono text-xs">{webhookUrl}</span><CopyButton value={webhookUrl} /></div>
              )}
              {(m.shows ?? []).includes('webhookEvents') && (
                <p className="text-xs text-muted-foreground">Events: {adapter.manifest.webhook.events.join(', ')}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}

      {report && (
        <Alert variant="destructive">
          <AlertTitle>Not saved — fix the failed checks</AlertTitle>
          <AlertDescription><ValidationChecklist report={report} /></AlertDescription>
        </Alert>
      )}
    </div>
  );
}
