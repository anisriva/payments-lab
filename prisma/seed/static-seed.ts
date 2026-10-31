import 'dotenv/config';
import { PrismaClient } from '@/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedPlanPrices } from './static/plan-prices';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  try {
    await seedPlanPrices(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
