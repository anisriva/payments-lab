import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformOrder, Prisma } from '@/generated/prisma';
import type { PlatformOrderCreateInput, PlatformOrderUpdateInput, PlatformOrderListOptions } from './types';

export class PlatformOrderDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<PlatformOrder | null> {
    return this.prisma.platformOrder.findUnique({ where: { id } });
  }

  async findByProviderOrderId(ref: string): Promise<PlatformOrder | null> {
    return this.prisma.platformOrder.findUnique({ where: { providerOrderId: ref } });
  }

  async create(data: PlatformOrderCreateInput): Promise<PlatformOrder> {
    try {
      return await this.prisma.platformOrder.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'platform order');
    }
  }

  async update(id: string, data: PlatformOrderUpdateInput): Promise<PlatformOrder> {
    try {
      return await this.prisma.platformOrder.update({ where: { id }, data });
    } catch (error) {
      throw new DatabaseException(error, 'platform order');
    }
  }

  async list(options: PlatformOrderListOptions = {}): Promise<PaginationResult<PlatformOrder>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.PlatformOrderWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
    };

    const orderBy: Prisma.PlatformOrderOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      PlatformOrder,
      Prisma.PlatformOrderWhereInput,
      Prisma.PlatformOrderOrderByWithRelationInput
    >(this.prisma.platformOrder, { where, orderBy, pagination });
  }
}
