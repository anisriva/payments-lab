import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProviderEvent, PaymentProvider, Prisma } from '@/generated/prisma';
import type { ProviderEventCreateInput, ProviderEventListOptions } from './types';

const providerEventListSelect = {
  id: true,
  provider: true,
  scope: true,
  providerEventId: true,
  eventType: true,
  processedAt: true,
  note: true,
  error: true,
  receivedAt: true,
} satisfies Prisma.ProviderEventSelect;

export type ProviderEventListItem = Prisma.ProviderEventGetPayload<{
  select: typeof providerEventListSelect;
}>;

export class ProviderEventDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<ProviderEvent | null> {
    return await this.prisma.providerEvent.findUnique({
      where: { id },
    });
  }

  async findByProviderEventId(
    provider: PaymentProvider,
    scope: string,
    providerEventId: string
  ): Promise<ProviderEvent | null> {
    return await this.prisma.providerEvent.findUnique({
      where: {
        provider_scope_providerEventId: {
          provider,
          scope,
          providerEventId,
        },
      },
    });
  }

  async findLatest(provider: PaymentProvider, scope: string): Promise<{ eventType: string; receivedAt: Date } | null> {
    return await this.prisma.providerEvent.findFirst({
      where: { provider, scope },
      orderBy: { receivedAt: 'desc' },
      select: { eventType: true, receivedAt: true },
    });
  }

  async create(data: ProviderEventCreateInput): Promise<ProviderEvent> {
    try {
      return await this.prisma.providerEvent.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async markProcessed(id: string, note: string): Promise<ProviderEvent> {
    try {
      return await this.prisma.providerEvent.update({
        where: { id },
        data: {
          processedAt: new Date(),
          note,
          error: null,
        },
      });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async markFailed(id: string, error: string): Promise<ProviderEvent> {
    try {
      return await this.prisma.providerEvent.update({
        where: { id },
        data: {
          error,
        },
      });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async list(options: ProviderEventListOptions = {}): Promise<PaginationResult<ProviderEventListItem>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.ProviderEventWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
      ...(filters.scope && { scope: filters.scope }),
      ...(filters.scopes && { scope: { in: filters.scopes } }),
      ...(filters.excludeScope && { scope: { not: filters.excludeScope } }),
    };

    const orderBy: Prisma.ProviderEventOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { receivedAt: 'desc' };

    return paginate<
      ProviderEventListItem,
      Prisma.ProviderEventWhereInput,
      Prisma.ProviderEventOrderByWithRelationInput
    >(this.prisma.providerEvent, {
      where,
      orderBy,
      pagination,
      select: providerEventListSelect,
    });
  }
}
