import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformProviderRule, PaymentProvider, Prisma } from '@/generated/prisma';
import type { ProviderRuleUpsertInput, ProviderRuleUpdateInput, ProviderRuleListOptions } from '@/lib/common/dao/payments/types';

export class PlatformProviderRuleDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByProvider(provider: PaymentProvider): Promise<PlatformProviderRule | null> {
    return this.prisma.platformProviderRule.findUnique({ where: { provider } });
  }

  async listAll(options: ProviderRuleListOptions = {}): Promise<PaginationResult<PlatformProviderRule>> {
    const { pagination, sort } = options;
    const orderBy: Prisma.PlatformProviderRuleOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { priority: 'asc' };

    return paginate<
      PlatformProviderRule,
      Prisma.PlatformProviderRuleWhereInput,
      Prisma.PlatformProviderRuleOrderByWithRelationInput
    >(this.prisma.platformProviderRule, { where: {}, orderBy, pagination });
  }

  async upsert(provider: PaymentProvider, data: ProviderRuleUpsertInput): Promise<PlatformProviderRule> {
    try {
      return await this.prisma.platformProviderRule.upsert({
        where: { provider },
        create: { provider, ...data },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'platform provider rule');
    }
  }

  async update(provider: PaymentProvider, data: ProviderRuleUpdateInput): Promise<PlatformProviderRule> {
    try {
      return await this.prisma.platformProviderRule.update({ where: { provider }, data });
    } catch (error) {
      throw new DatabaseException(error, 'platform provider rule');
    }
  }
}
