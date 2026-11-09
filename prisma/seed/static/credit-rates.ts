import type { PrismaClient } from '@/generated/prisma';
import { PlatformOfferingDAO, PlatformOfferingPriceDAO } from '@/lib/platform/dao/payments/platform-offering-dao';

// ai_credits offering: one price per market (unitAmount = price of one credit)
const CREDIT_PRICES = [
  { market: 'TIER_1', unitAmount: 1, currencyCode: 'USD' },
  { market: 'TIER_2', unitAmount: 1, currencyCode: 'EUR' },
  { market: 'TIER_3', unitAmount: 50, currencyCode: 'INR' },
] as const;

export async function seedCreditRates(prisma: PrismaClient) {
  const offeringDAO = new PlatformOfferingDAO(prisma);
  const priceDAO = new PlatformOfferingPriceDAO(prisma);

  const offering = await offeringDAO.upsertByKey('ai_credits', {
    name: 'AI credits', unitLabel: 'credit', minQuantity: 100, maxQuantity: 100000,
    quantityStep: 1, quickPicks: [100, 250, 500, 1000], isActive: true,
  });

  for (const p of CREDIT_PRICES) {
    const market = await prisma.market.findUnique({ where: { key: p.market } });
    await priceDAO.upsert(offering.id, market!.id, 'one_time', null, {
      unitAmount: p.unitAmount, currencyCode: p.currencyCode, isActive: true,
    });
  }

  console.log(`✅ Seeded ai_credits offering with ${CREDIT_PRICES.length} market prices`);
}
