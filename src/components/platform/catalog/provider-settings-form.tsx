'use client';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Country } from '@/generated/prisma';
import { providerSettingUpdateSchema, type ProviderSettingUpdate } from '@/schemas/platform/catalog/provider-setting.schema';
import { useUpdateProviderSetting } from '@/hooks/platform/catalog/use-update-provider-setting';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

type CapList = string[] | '*';
const ANY = '*';

function toFormList(list: CapList): string[] {
  return list === '*' ? [ANY] : list;
}

function FieldToggleGroup({
  value,
  onChange,
  options,
}: {
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <ToggleGroup
      value={value ?? []}
      onValueChange={(v) => {
        // '*' is exclusive: selecting it clears the rest, selecting another clears it
        if (v.includes(ANY) && !(value ?? []).includes(ANY)) onChange([ANY]);
        else onChange(v.filter((x) => x !== ANY));
      }}
      variant="outline"
      spacing={1}
    >
      <ToggleGroupItem value={ANY}>Any (*)</ToggleGroupItem>
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function ProviderSettingsForm({
  provider,
  flow,
  initial,
  countries,
  currencies,
}: {
  provider: string;
  flow: string;
  initial: { isEnabled: boolean; priority: number; receiverCountries: CapList; payerCountries: CapList; currencies: CapList };
  countries: Country[];
  currencies: string[];
}) {
  const router = useRouter();
  const update = useUpdateProviderSetting(provider, flow);
  const form = useForm<ProviderSettingUpdate>({
    resolver: zodResolver(providerSettingUpdateSchema),
    defaultValues: {
      isEnabled: initial.isEnabled,
      priority: initial.priority,
      receiverCountries: toFormList(initial.receiverCountries),
      payerCountries: toFormList(initial.payerCountries),
      currencies: toFormList(initial.currencies),
    },
  });
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) =>
          update.mutate(
            {
              isEnabled: data.isEnabled,
              priority: data.priority,
              receiverCountries: data.receiverCountries,
              payerCountries: data.payerCountries,
              currencies: data.currencies,
            },
            { onSuccess: () => router.refresh() }
          )
        )}
        className="space-y-4"
      >
        <FormField control={form.control} name="isEnabled" render={({ field }) => (
          <FormItem className="flex items-center gap-3">
            <FormControl><Switch checked={field.value ?? true} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel className="mt-0!">Enabled</FormLabel>
          </FormItem>
        )} />
        <FormField control={form.control} name="receiverCountries" render={({ field }) => (
          <FormItem><FormLabel>Receiver countries</FormLabel>
            <FormControl>
              <FieldToggleGroup value={field.value} onChange={field.onChange}
                options={countries.map((c) => ({ value: c.countryCode, label: c.countryCode }))} />
            </FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="payerCountries" render={({ field }) => (
          <FormItem><FormLabel>Payer countries</FormLabel>
            <FormControl>
              <FieldToggleGroup value={field.value} onChange={field.onChange}
                options={countries.map((c) => ({ value: c.countryCode, label: c.countryCode }))} />
            </FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="priority" render={({ field }) => (
          <FormItem><FormLabel>Priority (lower wins)</FormLabel>
            <FormControl><input type="number" min={0} className="w-24 rounded-md border px-2 py-1 text-sm"
              value={field.value ?? 100} onChange={(e) => field.onChange(e.target.valueAsNumber)} /></FormControl>
            <FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="currencies" render={({ field }) => (
          <FormItem><FormLabel>Currencies</FormLabel>
            <FormControl>
              <FieldToggleGroup value={field.value} onChange={field.onChange}
                options={currencies.map((c) => ({ value: c, label: c }))} />
            </FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={update.isPending}>Save</Button>
      </form>
    </Form>
  );
}
