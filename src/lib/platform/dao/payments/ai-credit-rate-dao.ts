import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, AiCreditRate, Prisma } from '@/generated/prisma';
import type { AiCreditRateCreateInput, AiCreditRateUpdateInput, AiCreditRateListOptions } from './types';

export class AiCreditRateDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<AiCreditRate | null> {
    return await this.prisma.aiCreditRate.findUnique({
      where: { id },
    });
  }

  async findActiveByCurrency(currencyCode: string): Promise<AiCreditRate | null> {
    return await this.prisma.aiCreditRate.findFirst({
      where: { currencyCode, isActive: true },
    });
  }

  async list(options: AiCreditRateListOptions = {}): Promise<PaginationResult<AiCreditRate>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.AiCreditRateWhereInput = {
      ...(filters.currencyCode && { currencyCode: filters.currencyCode }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    const orderBy: Prisma.AiCreditRateOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { currencyCode: 'asc' };

    return paginate<
      AiCreditRate,
      Prisma.AiCreditRateWhereInput,
      Prisma.AiCreditRateOrderByWithRelationInput
    >(this.prisma.aiCreditRate, {
      where,
      orderBy,
      pagination,
    });
  }

  async create(data: AiCreditRateCreateInput): Promise<AiCreditRate> {
    try {
      return await this.prisma.aiCreditRate.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'ai credit rate');
    }
  }

  async update(id: string, data: AiCreditRateUpdateInput): Promise<AiCreditRate> {
    try {
      return await this.prisma.aiCreditRate.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'ai credit rate');
    }
  }

  async delete(id: string): Promise<AiCreditRate> {
    try {
      return await this.prisma.aiCreditRate.delete({
        where: { id },
      });
    } catch (error) {
      throw new DatabaseException(error, 'ai credit rate');
    }
  }

  async upsertByCurrency(currencyCode: string, data: AiCreditRateCreateInput): Promise<AiCreditRate> {
    try {
      return await this.prisma.aiCreditRate.upsert({
        where: { currencyCode },
        create: { ...data, currencyCode },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'ai credit rate');
    }
  }
}
