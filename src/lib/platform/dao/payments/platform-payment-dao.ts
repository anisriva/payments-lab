import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformPayment, Prisma } from '@/generated/prisma';
import type { PlatformPaymentCreateInput, PlatformPaymentListOptions } from './types';

export class PlatformPaymentDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByProviderPaymentId(ref: string): Promise<PlatformPayment | null> {
    return this.prisma.platformPayment.findUnique({ where: { providerPaymentId: ref } });
  }

  async existsForSubscription(subscriptionId: string): Promise<boolean> {
    const count = await this.prisma.platformPayment.count({
      where: { platformSubscriptionId: subscriptionId },
    });
    return count > 0;
  }

  async create(data: PlatformPaymentCreateInput): Promise<PlatformPayment> {
    try {
      return await this.prisma.platformPayment.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'platform payment');
    }
  }

  async list(options: PlatformPaymentListOptions = {}): Promise<PaginationResult<PlatformPayment>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.PlatformPaymentWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
      ...(filters.projectId && { projectId: filters.projectId }),
    };

    const orderBy: Prisma.PlatformPaymentOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      PlatformPayment,
      Prisma.PlatformPaymentWhereInput,
      Prisma.PlatformPaymentOrderByWithRelationInput
    >(this.prisma.platformPayment, { where, orderBy, pagination });
  }
}
