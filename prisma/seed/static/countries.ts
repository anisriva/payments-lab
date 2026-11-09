import type { PrismaClient } from '@/generated/prisma';
import { CountryDAO } from '@/lib/common/dao/catalog/country-dao';
import { COUNTRIES, MARKETS } from './data/countries';

export async function seedCountries(prisma: PrismaClient) {
  const countryDAO = new CountryDAO(prisma);

  for (const m of MARKETS) {
    await prisma.market.upsert({ where: { key: m.key }, create: m, update: m });
  }
  for (const { market, ...country } of COUNTRIES) {
    const c = await countryDAO.upsert(country.countryCode, country);
    const m = await prisma.market.findUnique({ where: { key: market } });
    await prisma.countryMarketMap.upsert({
      where: { countryId: c.id },
      create: { countryId: c.id, marketId: m!.id },
      update: { marketId: m!.id },
    });
  }

  console.log(`✅ Seeded ${COUNTRIES.length} countries, ${MARKETS.length} markets`);
}
