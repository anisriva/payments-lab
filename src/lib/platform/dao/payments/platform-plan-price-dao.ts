import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformPlanPrice, BillingInterval, Prisma } from '@/generated/prisma';
import type { PlatformPlanPriceCreateInput, PlatformPlanPriceUpdateInput, PlatformPlanPriceListOptions } from './types';

export class PlatformPlanPriceDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<PlatformPlanPrice | null> {
    return await this.prisma.platformPlanPrice.findUnique({
      where: { id },
    });
  }

  async listActive(options: {
    pagination?: { page: number; limit: number };
  } = {}): Promise<PaginationResult<PlatformPlanPrice>> {
    const where: Prisma.PlatformPlanPriceWhereInput = {
      isActive: true,
    };

    const orderBy: Prisma.PlatformPlanPriceOrderByWithRelationInput = {
      amountMinor: 'asc',
    };

    return paginate<
      PlatformPlanPrice,
      Prisma.PlatformPlanPriceWhereInput,
      Prisma.PlatformPlanPriceOrderByWithRelationInput
    >(this.prisma.platformPlanPrice, {
      where,
      orderBy,
      pagination: options.pagination,
    });
  }

  async create(data: PlatformPlanPriceCreateInput & { id?: string }): Promise<PlatformPlanPrice> {
    try {
      return await this.prisma.platformPlanPrice.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }

  async update(id: string, data: PlatformPlanPriceUpdateInput): Promise<PlatformPlanPrice> {
    try {
      return await this.prisma.platformPlanPrice.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }

  async delete(id: string): Promise<PlatformPlanPrice> {
    try {
      return await this.prisma.platformPlanPrice.delete({
        where: { id },
      });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }

  async list(options: PlatformPlanPriceListOptions = {}): Promise<PaginationResult<PlatformPlanPrice>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.PlatformPlanPriceWhereInput = {
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.currencyCode && { currencyCode: filters.currencyCode }),
    };

    const orderBy: Prisma.PlatformPlanPriceOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      PlatformPlanPrice,
      Prisma.PlatformPlanPriceWhereInput,
      Prisma.PlatformPlanPriceOrderByWithRelationInput
    >(this.prisma.platformPlanPrice, {
      where,
      orderBy,
      pagination,
    });
  }

  async listActiveByCurrency(currencyCode: string, options: PlatformPlanPriceListOptions = {}): Promise<PaginationResult<PlatformPlanPrice>> {
    return this.list({
      ...options,
      filters: { ...options.filters, isActive: true, currencyCode },
    });
  }

  async upsertByKey(
    planKey: string,
    interval: BillingInterval,
    currencyCode: string,
    data: PlatformPlanPriceCreateInput
  ): Promise<PlatformPlanPrice> {
    try {
      return await this.prisma.platformPlanPrice.upsert({
        where: {
          planKey_interval_currencyCode: {
            planKey,
            interval,
            currencyCode,
          },
        },
        create: {
          ...data,
          planKey,
          interval,
          currencyCode,
        },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'platform plan price');
    }
  }
}
