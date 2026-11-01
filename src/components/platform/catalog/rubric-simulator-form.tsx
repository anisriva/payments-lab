'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function RubricSimulatorForm({
  flow,
  mode,
  payer,
  receiver,
  currency,
  allowed,
  countries,
  currencies,
  providers,
}: {
  flow: string;
  mode: string;
  payer: string;
  receiver: string;
  currency: string;
  allowed: string[];
  countries: { code: string; name: string }[];
  currencies: string[];
  providers: { key: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = (key: string, value: string | null) => {
    const q = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') q.delete(key);
    else q.set(key, value);
    router.push(`?${q.toString()}`);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label>Flow</Label>
        <Select value={flow} onValueChange={(v) => update('flow', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="platform">platform</SelectItem>
            <SelectItem value="project">project</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Mode</Label>
        <Select value={mode} onValueChange={(v) => update('mode', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="one_time">one-time</SelectItem>
            <SelectItem value="subscription">subscription</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Payer country</Label>
        <Select value={payer} onValueChange={(v) => update('payer', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {countries.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Receiver country</Label>
        {flow === 'platform' ? (
          <Tooltip>
            <TooltipTrigger render={<span className="block" />}>
              <Select value="IN" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="IN">IN</SelectItem></SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>Folio receives in India</TooltipContent>
          </Tooltip>
        ) : (
          <Select value={receiver} onValueChange={(v) => update('receiver', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {countries.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-2">
        <Label>Currency</Label>
        <Select value={currency} onValueChange={(v) => update('currency', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {flow === 'project' && (
        <div className="space-y-2">
          <Label>Allowed providers (connected)</Label>
          <ToggleGroup
            value={allowed}
            onValueChange={(v) => update('allowed', v.length > 0 ? v.join(',') : null)}
            variant="outline"
            spacing={1}
          >
            {providers.map((p) => (
              <ToggleGroupItem key={p.key} value={p.key}>{p.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}
