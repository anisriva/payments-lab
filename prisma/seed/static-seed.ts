import 'dotenv/config';
import { PrismaClient } from '@/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedPlanPrices } from './static/plan-prices';
import { seedCountries } from './static/countries';
import { seedProviderSettings } from './static/provider-settings';
import { seedCreditRates } from './static/credit-rates';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  try {
    await seedCountries(prisma);
    await seedProviderSettings(prisma);
    await seedCreditRates(prisma);
    await seedPlanPrices(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
