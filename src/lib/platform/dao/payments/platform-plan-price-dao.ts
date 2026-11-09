import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformPlanPrice, BillingMode, Prisma } from '@/generated/prisma';
import type { PlatformPlanPriceCreateInput, PlatformPlanPriceUpdateInput, PlatformPlanPriceListOptions } from './types';

const include = { plan: true, market: true } satisfies Prisma.PlatformPlanPriceInclude;
export type PlatformPlanPriceWithRefs = Prisma.PlatformPlanPriceGetPayload<{ include: typeof include }>;

export class PlatformPlanPriceDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<PlatformPlanPriceWithRefs | null> {
    return this.prisma.platformPlanPrice.findUnique({ where: { id }, include });
  }

  async listActive(options: { pagination?: { page: number; limit: number } } = {}): Promise<PaginationResult<PlatformPlanPriceWithRefs>> {
    return paginate<PlatformPlanPriceWithRefs, Prisma.PlatformPlanPriceWhereInput, Prisma.PlatformPlanPriceOrderByWithRelationInput>(
      this.prisma.platformPlanPrice,
      { where: { isActive: true }, orderBy: { unitAmount: 'asc' }, pagination: options.pagination, include },
    );
  }

  async create(data: PlatformPlanPriceCreateInput & { id?: string }): Promise<PlatformPlanPrice> {
    try {
      return await this.prisma.platformPlanPrice.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }

  async update(id: string, data: PlatformPlanPriceUpdateInput): Promise<PlatformPlanPrice> {
    try {
      return await this.prisma.platformPlanPrice.update({ where: { id }, data });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.platformPlanPrice.delete({ where: { id } });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }

  async list(options: PlatformPlanPriceListOptions = {}): Promise<PaginationResult<PlatformPlanPriceWithRefs>> {
    const { pagination, sort, filters = {} } = options;
    const where: Prisma.PlatformPlanPriceWhereInput = {
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.currencyCode && { currencyCode: filters.currencyCode }),
      ...(filters.marketId && { marketId: filters.marketId }),
    };
    const orderBy: Prisma.PlatformPlanPriceOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };
    return paginate<PlatformPlanPriceWithRefs, Prisma.PlatformPlanPriceWhereInput, Prisma.PlatformPlanPriceOrderByWithRelationInput>(
      this.prisma.platformPlanPrice, { where, orderBy, pagination, include },
    );
  }

  async listActiveByMarket(marketId: string, options: PlatformPlanPriceListOptions = {}): Promise<PaginationResult<PlatformPlanPriceWithRefs>> {
    return this.list({ ...options, filters: { ...options.filters, isActive: true, marketId } });
  }

  async upsertByKey(
    planId: string, marketId: string, billingMode: BillingMode, data: Omit<PlatformPlanPriceCreateInput, 'planId' | 'marketId' | 'billingMode'>,
  ): Promise<PlatformPlanPrice> {
    try {
      return await this.prisma.platformPlanPrice.upsert({
        where: { planId_marketId_billingMode: { planId, marketId, billingMode } },
        create: { ...data, planId, marketId, billingMode },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }
}
