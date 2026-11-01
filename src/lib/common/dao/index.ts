import type { PrismaClient } from '@/generated/prisma';

export { paginate } from './paginate';

/**
 * Type for Prisma transaction client
 * Excludes methods that are not available in transaction context
 */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
