import type { PrismaClient } from '@/generated/prisma';
import { AiCreditRateDAO } from '@/lib/platform/dao/payments/ai-credit-rate-dao';
import { CREDIT_RATES } from './data/credit-rates';

export async function seedCreditRates(prisma: PrismaClient) {
  const creditRateDAO = new AiCreditRateDAO(prisma);

  let created = 0;
  for (const rate of CREDIT_RATES) {
    // Do not overwrite Catalog edits — create only when the row is missing.
    const existing = await creditRateDAO.list({
      filters: { currencyCode: rate.currencyCode },
      pagination: { page: 1, limit: 1 },
    });
    if (existing.data.length > 0) continue;
    await creditRateDAO.upsertByCurrency(rate.currencyCode, rate);
    created++;
  }

  console.log(`✅ Seeded ${created} AI credit rates (${CREDIT_RATES.length - created} already existed)`);
}
