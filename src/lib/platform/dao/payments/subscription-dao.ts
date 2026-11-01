import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, Subscription, Prisma } from '@/generated/prisma';
import type { SubscriptionCreateInput, SubscriptionUpdateInput, SubscriptionListOptions } from './types';

const subscriptionListInclude = {
  platformPlanPrice: true,
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionWithPlanPrice = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionListInclude;
}>;

export class SubscriptionDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<Subscription | null> {
    return await this.prisma.subscription.findUnique({
      where: { id },
    });
  }

  async findByIdWithPlanPrice(id: string): Promise<SubscriptionWithPlanPrice | null> {
    return await this.prisma.subscription.findUnique({
      where: { id },
      include: subscriptionListInclude,
    });
  }

  async findByProviderSubscriptionId(ref: string): Promise<Subscription | null> {
    return await this.prisma.subscription.findUnique({
      where: { providerSubscriptionId: ref },
    });
  }

  async create(data: SubscriptionCreateInput): Promise<Subscription> {
    try {
      return await this.prisma.subscription.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'subscription');
    }
  }

  async update(id: string, data: SubscriptionUpdateInput): Promise<Subscription> {
    try {
      return await this.prisma.subscription.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'subscription');
    }
  }

  async list(options: SubscriptionListOptions = {}): Promise<PaginationResult<SubscriptionWithPlanPrice>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.SubscriptionWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
    };

    const orderBy: Prisma.SubscriptionOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      SubscriptionWithPlanPrice,
      Prisma.SubscriptionWhereInput,
      Prisma.SubscriptionOrderByWithRelationInput
    >(this.prisma.subscription, {
      where,
      orderBy,
      pagination,
      include: subscriptionListInclude,
    });
  }
}
