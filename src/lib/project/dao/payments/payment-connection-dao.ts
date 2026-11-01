import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PaymentProvider, PaymentEnvironment, Prisma } from '@/generated/prisma';
import type { PaymentConnectionUpsertInput, PaymentConnectionUpdateInput, PaymentConnectionListOptions } from './types';

const paymentConnectionSafeSelect = {
  id: true,
  projectId: true,
  provider: true,
  environment: true,
  displayHint: true,
  isEnabled: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentConnectionSelect;

export type PaymentConnectionSafe = Prisma.PaymentConnectionGetPayload<{
  select: typeof paymentConnectionSafeSelect;
}>;

export class PaymentConnectionDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<PaymentConnectionSafe | null> {
    return await this.prisma.paymentConnection.findUnique({
      where: { id },
      select: paymentConnectionSafeSelect,
    });
  }

  async findByProjectAndProvider(
    projectId: string,
    provider: PaymentProvider,
    environment: PaymentEnvironment
  ): Promise<PaymentConnectionSafe | null> {
    return await this.prisma.paymentConnection.findUnique({
      where: {
        projectId_provider_environment: {
          projectId,
          provider,
          environment,
        },
      },
      select: paymentConnectionSafeSelect,
    });
  }

  async findWithCredentials(id: string): Promise<{
    id: string;
    projectId: string;
    provider: PaymentProvider;
    environment: PaymentEnvironment;
    isEnabled: boolean;
    credentialsEnc: string;
  } | null> {
    return await this.prisma.paymentConnection.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        provider: true,
        environment: true,
        isEnabled: true,
        credentialsEnc: true,
      },
    });
  }

  async upsert(data: PaymentConnectionUpsertInput): Promise<PaymentConnectionSafe> {
    try {
      return await this.prisma.paymentConnection.upsert({
        where: {
          projectId_provider_environment: {
            projectId: data.projectId,
            provider: data.provider,
            environment: data.environment,
          },
        },
        create: data,
        update: {
          credentialsEnc: data.credentialsEnc,
          displayHint: data.displayHint,
          isEnabled: data.isEnabled,
          verifiedAt: data.verifiedAt,
        },
        select: paymentConnectionSafeSelect,
      });
    } catch (error) {
      throw new DatabaseException(error, 'payment connection');
    }
  }

  async update(id: string, data: PaymentConnectionUpdateInput): Promise<PaymentConnectionSafe> {
    try {
      return await this.prisma.paymentConnection.update({
        where: { id },
        data,
        select: paymentConnectionSafeSelect,
      });
    } catch (error) {
      throw new DatabaseException(error, 'payment connection');
    }
  }

  async listByProject(projectId: string, options: PaymentConnectionListOptions = {}): Promise<PaginationResult<PaymentConnectionSafe>> {
    const { pagination, sort } = options;

    const where: Prisma.PaymentConnectionWhereInput = {
      projectId,
    };

    const orderBy: Prisma.PaymentConnectionOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      PaymentConnectionSafe,
      Prisma.PaymentConnectionWhereInput,
      Prisma.PaymentConnectionOrderByWithRelationInput
    >(this.prisma.paymentConnection, {
      where,
      orderBy,
      pagination,
      select: paymentConnectionSafeSelect,
    });
  }
}
