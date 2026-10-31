import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, AiCreditPurchase, Prisma } from '@/generated/prisma';
import type { AiCreditPurchaseCreateInput, AiCreditPurchaseUpdateInput, AiCreditPurchaseListOptions } from './types';

export class AiCreditPurchaseDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<AiCreditPurchase | null> {
    return await this.prisma.aiCreditPurchase.findUnique({
      where: { id },
    });
  }

  async findByProviderOrderId(ref: string): Promise<AiCreditPurchase | null> {
    return await this.prisma.aiCreditPurchase.findUnique({
      where: { providerOrderId: ref },
    });
  }

  async create(data: AiCreditPurchaseCreateInput): Promise<AiCreditPurchase> {
    try {
      return await this.prisma.aiCreditPurchase.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'AI credit purchase');
    }
  }

  async update(id: string, data: AiCreditPurchaseUpdateInput): Promise<AiCreditPurchase> {
    try {
      return await this.prisma.aiCreditPurchase.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'AI credit purchase');
    }
  }

  async list(options: AiCreditPurchaseListOptions = {}): Promise<PaginationResult<AiCreditPurchase>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.AiCreditPurchaseWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
    };

    const orderBy: Prisma.AiCreditPurchaseOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      AiCreditPurchase,
      Prisma.AiCreditPurchaseWhereInput,
      Prisma.AiCreditPurchaseOrderByWithRelationInput
    >(this.prisma.aiCreditPurchase, {
      where,
      orderBy,
      pagination,
    });
  }
}
