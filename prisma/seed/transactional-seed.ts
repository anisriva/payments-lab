import 'dotenv/config';
import { PrismaClient } from '@/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedTestProjects } from './transactional/test-projects';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  try {
    await seedTestProjects(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
