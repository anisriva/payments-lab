import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProjectProviderEvent, PaymentProvider, Prisma } from '@/generated/prisma';
import type { ProviderEventCreateInput, ProviderEventListOptions } from '@/lib/common/dao/payments/types';

const providerEventListSelect = {
  id: true,
  provider: true,
  connectionId: true,
  providerEventId: true,
  eventType: true,
  processedAt: true,
  note: true,
  error: true,
  receivedAt: true,
} satisfies Prisma.ProjectProviderEventSelect;

export type ProjectProviderEventListItem = Prisma.ProjectProviderEventGetPayload<{
  select: typeof providerEventListSelect;
}>;

export class ProjectProviderEventDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<ProjectProviderEvent | null> {
    return this.prisma.projectProviderEvent.findUnique({ where: { id } });
  }

  async findByProviderEventId(
    provider: PaymentProvider,
    connectionId: string,
    providerEventId: string,
  ): Promise<ProjectProviderEvent | null> {
    return this.prisma.projectProviderEvent.findUnique({
      where: { provider_connectionId_providerEventId: { provider, connectionId, providerEventId } },
    });
  }

  async findLatest(provider: PaymentProvider, connectionId: string): Promise<{ eventType: string; receivedAt: Date } | null> {
    return this.prisma.projectProviderEvent.findFirst({
      where: { provider, connectionId },
      orderBy: { receivedAt: 'desc' },
      select: { eventType: true, receivedAt: true },
    });
  }

  async create(data: ProviderEventCreateInput & { connectionId: string }): Promise<ProjectProviderEvent> {
    try {
      return await this.prisma.projectProviderEvent.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async markProcessed(id: string, note: string): Promise<ProjectProviderEvent> {
    try {
      return await this.prisma.projectProviderEvent.update({
        where: { id },
        data: { processedAt: new Date(), note, error: null },
      });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async markFailed(id: string, error: string): Promise<ProjectProviderEvent> {
    try {
      return await this.prisma.projectProviderEvent.update({ where: { id }, data: { error } });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async list(options: ProviderEventListOptions = {}): Promise<PaginationResult<ProjectProviderEventListItem>> {
    const { pagination, sort, filters = {} } = options;
    const where: Prisma.ProjectProviderEventWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
      ...(filters.connectionId && { connectionId: filters.connectionId }),
      ...(filters.connectionIds && { connectionId: { in: filters.connectionIds } }),
    };
    const orderBy: Prisma.ProjectProviderEventOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { receivedAt: 'desc' };

    return paginate<
      ProjectProviderEventListItem,
      Prisma.ProjectProviderEventWhereInput,
      Prisma.ProjectProviderEventOrderByWithRelationInput
    >(this.prisma.projectProviderEvent, { where, orderBy, pagination, select: providerEventListSelect });
  }
}
