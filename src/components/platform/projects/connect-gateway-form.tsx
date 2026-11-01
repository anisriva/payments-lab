'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConnectPaymentGateway } from '@/hooks/platform/projects/use-connect-payment-gateway';
import { ValidationChecklist } from '@/components/common/payments/validation-checklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/project/payments/copy-button';
import type { CredentialField, OnboardingStep, ProviderProfile, ValidationReport } from '@/lib/common/payments/core/types';

export function ConnectGatewayForm({
  projectId,
  provider,
  profile,
  webhookUrl,
}: {
  projectId: string;
  provider: string;
  profile: ProviderProfile;
  webhookUrl: string;
}) {
  const router = useRouter();
  const connect = useConnectPaymentGateway(projectId);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const set = (key: string, v: string) => setValues((p) => ({ ...p, [key]: v }));

  const submit = () => {
    connect.mutate(
      { provider, credentials: values },
      {
        onSuccess: (data) => {
          const d = data as { saved: boolean; report: ValidationReport };
          if (d.saved) router.refresh();
          else setReport(d.report);
        },
      }
    );
  };

  const steps = profile.onboarding;
  const lastIdx = steps.length - 1;

  return (
    <div className="space-y-4">
      {steps.map((s: OnboardingStep, i: number) => (
        <div key={i} className="space-y-2">
          <p className="text-sm font-medium">{i + 1}. {s.title}</p>
          {i < lastIdx && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{s.body}</p>
              {s.docsUrl && <a href={s.docsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">{s.docsUrl}</a>}
            </div>
          )}
        </div>
      ))}

      <div className="space-y-3">
        {profile.credentialFields.map((f: CredentialField) => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            <Input
              type={f.secret ? 'password' : 'text'}
              placeholder={f.placeholder}
              autoComplete="off"
              value={values[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
            />
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
      </div>

      {!profile.webhook.autoRegister && (
        <Alert>
          <AlertTitle>Register the webhook yourself</AlertTitle>
          <AlertDescription className="space-y-2">
            <div className="flex items-center gap-2"><span className="font-mono text-xs">{webhookUrl}</span><CopyButton value={webhookUrl} /></div>
            <p className="text-xs">Events: {profile.webhook.events.join(', ')}</p>
          </AlertDescription>
        </Alert>
      )}

      <Button onClick={submit} disabled={connect.isPending}>Connect</Button>

      {report && (
        <Alert variant="destructive">
          <AlertTitle>Not saved — fix the failed checks</AlertTitle>
          <AlertDescription><ValidationChecklist report={report} /></AlertDescription>
        </Alert>
      )}
    </div>
  );
}
