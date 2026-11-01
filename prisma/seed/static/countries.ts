import type { PrismaClient } from '@/generated/prisma';
import { CountryDAO } from '@/lib/common/dao/catalog/country-dao';
import { COUNTRIES } from './data/countries';

export async function seedCountries(prisma: PrismaClient) {
  const countryDAO = new CountryDAO(prisma);

  for (const country of COUNTRIES) {
    await countryDAO.upsert(country.code, country);
  }

  console.log(`✅ Seeded ${COUNTRIES.length} countries`);
}
