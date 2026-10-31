import type { PrismaClient } from '@/generated/prisma';
import { PlatformPlanPriceDAO } from '@/lib/platform/dao/payments/platform-plan-price-dao';
import { PLAN_PRICES } from './data/plan-prices';

export async function seedPlanPrices(prisma: PrismaClient) {
  const platformPlanPriceDAO = new PlatformPlanPriceDAO(prisma);

  for (const plan of PLAN_PRICES) {
    await platformPlanPriceDAO.upsertByKey(plan.planKey, plan.interval, plan.currencyCode, plan);
  }

  console.log(`✅ Seeded ${PLAN_PRICES.length} platform plan prices`);
}
