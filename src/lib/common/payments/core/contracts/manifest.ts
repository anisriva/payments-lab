import { z } from 'zod';
import { FEATURES, featureSupportSchema, mapFeatures } from './features';

export const providerKeySchema = z.enum(['razorpay', 'dodo', 'stripe', 'paypal']);

const iso2 = z.string().regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2, uppercase');
const iso4217 = z.string().regex(/^[A-Z]{3}$/, 'ISO 4217, uppercase');

export const countryMatchSchema = z.union([
  z.literal('*'),
  z.array(iso2).min(1),
  z.object({ except: z.array(iso2).min(1) }),
]);
export const currencyMatchSchema = z.union([z.literal('*'), z.array(iso4217).min(1)]);

export type CountryMatch = z.infer<typeof countryMatchSchema>;
export type CurrencyMatch = z.infer<typeof currencyMatchSchema>;

/** One combination the provider supports. EVERY receiver × payer × currency inside a lane must work. */
export const coverageLaneSchema = z.object({
  receivers: countryMatchSchema,   // where the merchant account is based
  payers: countryMatchSchema,      // where the buyer is
  currencies: currencyMatchSchema,
  note: z.string().optional(),     // shown in the rubric, e.g. 'Needs international activation'
});

export type CoverageLane = z.infer<typeof coverageLaneSchema>;

function requiredFeaturesSupported(
  features: Record<string, { supported: boolean }>,
  ctx: z.RefinementCtx,
) {
  for (const [feature, def] of Object.entries(FEATURES)) {
    if ('required' in def && def.required && !features[feature]?.supported) {
      ctx.addIssue({
        code: 'custom',
        path: ['features', feature],
        message: `Required feature "${feature}" must be supported`,
      });
    }
  }
}

export const manifestSchema = z.object({
  key: providerKeySchema,
  brand: z.object({
    name: z.string().min(1),
    logoUrl: z.string().optional(),
    docsUrl: z.url(),
  }),
  audiences: z.array(z.enum(['platform', 'project'])).min(1), // which audiences it CAN serve
  features: mapFeatures(featureSupportSchema).strict(),       // every feature, no omissions, no extras
  facts: z.object({ merchantOfRecord: z.boolean() }),
  coverage: z.array(coverageLaneSchema).min(1),
  checkout: z.object({ kind: z.enum(['modal', 'redirect', 'embedded']) }),
  webhook: z.object({ events: z.array(z.string()).min(1) }),  // provider event names we subscribe to
}).superRefine((m, ctx) => requiredFeaturesSupported(m.features, ctx));

export type ProviderManifest = z.infer<typeof manifestSchema>;
export const defineManifest = (m: z.input<typeof manifestSchema>): ProviderManifest => manifestSchema.parse(m);
