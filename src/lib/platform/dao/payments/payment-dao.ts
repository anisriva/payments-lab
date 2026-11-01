import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, Payment, Prisma } from '@/generated/prisma';
import type { PaymentCreateInput, PaymentListOptions } from './types';

export class PaymentDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByProviderPaymentId(ref: string): Promise<Payment | null> {
    return await this.prisma.payment.findUnique({
      where: { providerPaymentId: ref },
    });
  }

  async existsForSubscription(subscriptionId: string): Promise<boolean> {
    const count = await this.prisma.payment.count({
      where: { subscriptionId },
    });
    return count > 0;
  }

  async create(data: PaymentCreateInput): Promise<Payment> {
    try {
      return await this.prisma.payment.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'payment');
    }
  }

  async list(options: PaymentListOptions = {}): Promise<PaginationResult<Payment>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.PaymentWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
    };

    const orderBy: Prisma.PaymentOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      Payment,
      Prisma.PaymentWhereInput,
      Prisma.PaymentOrderByWithRelationInput
    >(this.prisma.payment, {
      where,
      orderBy,
      pagination,
    });
  }
}
