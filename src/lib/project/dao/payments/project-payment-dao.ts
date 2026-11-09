import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProjectPayment, PaymentKind, PaymentProvider, Prisma } from '@/generated/prisma';

export class ProjectPaymentDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByProviderPaymentId(ref: string): Promise<ProjectPayment | null> {
    return this.prisma.projectPayment.findUnique({ where: { providerPaymentId: ref } });
  }

  async existsForSubscription(subscriptionId: string): Promise<boolean> {
    return (await this.prisma.projectPayment.count({ where: { projectSubscriptionId: subscriptionId } })) > 0;
  }

  async create(data: {
    projectId: string;
    kind: PaymentKind;
    provider: PaymentProvider;
    providerPaymentId: string;
    amount: number;
    currencyCode: string;
    projectOrderId?: string | null;
    projectSubscriptionId?: string | null;
  }): Promise<ProjectPayment> {
    try {
      return await this.prisma.projectPayment.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'project payment');
    }
  }

  async list(options: { projectId: string; pagination?: { page: number; limit: number } }): Promise<PaginationResult<ProjectPayment>> {
    const where: Prisma.ProjectPaymentWhereInput = { projectId: options.projectId };
    const orderBy: Prisma.ProjectPaymentOrderByWithRelationInput = { createdAt: 'desc' };
    return paginate<ProjectPayment, Prisma.ProjectPaymentWhereInput, Prisma.ProjectPaymentOrderByWithRelationInput>(
      this.prisma.projectPayment, { where, orderBy, pagination: options.pagination },
    );
  }
}
