import { z } from 'zod';

export const providerSettingUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  receiverCountries: z.array(z.string().min(1).max(2)).optional(),
  payerCountries: z.array(z.string().min(1).max(2)).optional(),
  currencies: z.array(z.union([z.literal('*'), z.string().length(3)])).optional(),
});

export type ProviderSettingUpdate = z.infer<typeof providerSettingUpdateSchema>;
