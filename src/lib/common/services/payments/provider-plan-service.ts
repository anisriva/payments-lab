import { supports } from '@/lib/common/payments/core/contracts/features';
import type { PaymentProvider, SubscriptionPlanInput } from '@/lib/common/payments/core/contracts/provider';
import { PaymentCapabilityNotSupportedError } from '@/lib/common/payments/core/errors';
import type { Prisma } from '@/generated/prisma';

/**
 * Maps our price/offering row to the provider's subscription-plan object.
 * Refs live in the row's `providerPlanRefs` JSON column — no separate table.
 * Platform: keyed by provider. Project: keyed by connection id.
 */
export function readPlanRef(providerPlanRefs: unknown, key: string): string | null {
  if (providerPlanRefs && typeof providerPlanRefs === 'object') {
    const ref = (providerPlanRefs as Record<string, unknown>)[key];
    if (typeof ref === 'string' && ref.length > 0) return ref;
  }
  return null;
}

export async function ensurePlanRef(input: {
  providerPlanRefs: unknown;
  key: string;
  adapter: PaymentProvider;
  plan: SubscriptionPlanInput;
  persist: (refs: Prisma.InputJsonValue) => Promise<void>;
}): Promise<string> {
  const existing = readPlanRef(input.providerPlanRefs, input.key);
  if (existing) return existing;

  if (!supports(input.adapter.manifest, 'subscription_plan.create')) {
    throw new PaymentCapabilityNotSupportedError(input.adapter.manifest.brand.name, 'subscription plans');
  }
  const { providerRef } = await input.adapter.createSubscriptionPlan!(input.plan);
  const refs = {
    ...(input.providerPlanRefs && typeof input.providerPlanRefs === 'object' ? input.providerPlanRefs : {}),
    [input.key]: providerRef,
  } as Record<string, string>;
  await input.persist(refs as unknown as Prisma.InputJsonValue);
  return providerRef;
}
