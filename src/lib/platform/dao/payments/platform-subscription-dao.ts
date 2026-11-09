import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformSubscription, Prisma } from '@/generated/prisma';
import type { PlatformSubscriptionCreateInput, PlatformSubscriptionUpdateInput, PlatformSubscriptionListOptions } from './types';

const subscriptionListInclude = {
  platformPlanPrice: { include: { plan: true } },
} satisfies Prisma.PlatformSubscriptionInclude;

export type PlatformSubscriptionWithPlanPrice = Prisma.PlatformSubscriptionGetPayload<{
  include: typeof subscriptionListInclude;
}>;

export class PlatformSubscriptionDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<PlatformSubscription | null> {
    return this.prisma.platformSubscription.findUnique({ where: { id } });
  }

  async findByIdWithPlanPrice(id: string): Promise<PlatformSubscriptionWithPlanPrice | null> {
    return this.prisma.platformSubscription.findUnique({
      where: { id },
      include: subscriptionListInclude,
    });
  }

  async findByProviderSubscriptionId(ref: string): Promise<PlatformSubscription | null> {
    return this.prisma.platformSubscription.findUnique({ where: { providerSubscriptionId: ref } });
  }

  async create(data: PlatformSubscriptionCreateInput): Promise<PlatformSubscription> {
    try {
      return await this.prisma.platformSubscription.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'platform subscription');
    }
  }

  async update(id: string, data: PlatformSubscriptionUpdateInput): Promise<PlatformSubscription> {
    try {
      return await this.prisma.platformSubscription.update({ where: { id }, data });
    } catch (error) {
      throw new DatabaseException(error, 'platform subscription');
    }
  }

  async existsForPlanPrice(planPriceId: string): Promise<boolean> {
    const count = await this.prisma.platformSubscription.count({
      where: { platformPlanPriceId: planPriceId },
    });
    return count > 0;
  }

  async list(options: PlatformSubscriptionListOptions = {}): Promise<PaginationResult<PlatformSubscriptionWithPlanPrice>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.PlatformSubscriptionWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
    };

    const orderBy: Prisma.PlatformSubscriptionOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      PlatformSubscriptionWithPlanPrice,
      Prisma.PlatformSubscriptionWhereInput,
      Prisma.PlatformSubscriptionOrderByWithRelationInput
    >(this.prisma.platformSubscription, {
      where,
      orderBy,
      pagination,
      include: subscriptionListInclude,
    });
  }
}
