import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformProviderEvent, PaymentProvider, Prisma } from '@/generated/prisma';
import type { ProviderEventCreateInput, ProviderEventListOptions } from '@/lib/common/dao/payments/types';

const providerEventListSelect = {
  id: true,
  provider: true,
  providerEventId: true,
  eventType: true,
  processedAt: true,
  note: true,
  error: true,
  receivedAt: true,
} satisfies Prisma.PlatformProviderEventSelect;

export type PlatformProviderEventListItem = Prisma.PlatformProviderEventGetPayload<{
  select: typeof providerEventListSelect;
}>;

export class PlatformProviderEventDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<PlatformProviderEvent | null> {
    return this.prisma.platformProviderEvent.findUnique({ where: { id } });
  }

  async findByProviderEventId(provider: PaymentProvider, providerEventId: string): Promise<PlatformProviderEvent | null> {
    return this.prisma.platformProviderEvent.findUnique({
      where: { provider_providerEventId: { provider, providerEventId } },
    });
  }

  async findLatest(provider: PaymentProvider): Promise<{ eventType: string; receivedAt: Date } | null> {
    return this.prisma.platformProviderEvent.findFirst({
      where: { provider },
      orderBy: { receivedAt: 'desc' },
      select: { eventType: true, receivedAt: true },
    });
  }

  async create(data: ProviderEventCreateInput): Promise<PlatformProviderEvent> {
    try {
      const { connectionId, ...rest } = data;
      void connectionId;
      return await this.prisma.platformProviderEvent.create({ data: rest });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async markProcessed(id: string, note: string): Promise<PlatformProviderEvent> {
    try {
      return await this.prisma.platformProviderEvent.update({
        where: { id },
        data: { processedAt: new Date(), note, error: null },
      });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async markFailed(id: string, error: string): Promise<PlatformProviderEvent> {
    try {
      return await this.prisma.platformProviderEvent.update({ where: { id }, data: { error } });
    } catch (error) {
      throw new DatabaseException(error, 'provider event');
    }
  }

  async list(options: ProviderEventListOptions = {}): Promise<PaginationResult<PlatformProviderEventListItem>> {
    const { pagination, sort, filters = {} } = options;
    const where: Prisma.PlatformProviderEventWhereInput = {
      ...(filters.provider && { provider: filters.provider }),
    };
    const orderBy: Prisma.PlatformProviderEventOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { receivedAt: 'desc' };

    return paginate<
      PlatformProviderEventListItem,
      Prisma.PlatformProviderEventWhereInput,
      Prisma.PlatformProviderEventOrderByWithRelationInput
    >(this.prisma.platformProviderEvent, { where, orderBy, pagination, select: providerEventListSelect });
  }
}
