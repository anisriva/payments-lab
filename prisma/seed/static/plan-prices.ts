import type { PrismaClient } from '@/generated/prisma';
import { PlatformPlanPriceDAO } from '@/lib/platform/dao/payments/platform-plan-price-dao';

const PLANS = [
  { key: 'premium', name: 'Premium Monthly', billingMode: 'monthly', unitAmount: 49900, market: 'TIER_3' },
  { key: 'pro', name: 'Pro Monthly', billingMode: 'monthly', unitAmount: 99900, market: 'TIER_3' },
] as const;

async function seedLabUser(prisma: PrismaClient) {
  await prisma.platformUser.upsert({
    where: { email: 'creator@lab.test' },
    create: { email: 'creator@lab.test', name: 'Lab Creator' },
    update: {},
  });
}

export async function seedPlanPrices(prisma: PrismaClient) {
  const priceDAO = new PlatformPlanPriceDAO(prisma);

  await seedLabUser(prisma);
  for (const p of PLANS) {
    const plan = await prisma.platformPlan.upsert({
      where: { key: p.key }, create: { key: p.key, name: p.name }, update: {},
    });
    const market = await prisma.market.findUnique({ where: { key: p.market } });
    await priceDAO.upsertByKey(plan.id, market!.id, p.billingMode, {
      unitAmount: p.unitAmount, currencyCode: market!.defaultCurrencyCode, isActive: true,
    });
  }

  console.log(`✅ Seeded ${PLANS.length} platform plan prices`);
}
