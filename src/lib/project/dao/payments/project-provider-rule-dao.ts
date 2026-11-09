import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProjectProviderRule, PaymentProvider, Prisma } from '@/generated/prisma';
import type { ProviderRuleUpsertInput, ProviderRuleUpdateInput, ProviderRuleListOptions } from '@/lib/common/dao/payments/types';

export class ProjectProviderRuleDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByProvider(provider: PaymentProvider): Promise<ProjectProviderRule | null> {
    return this.prisma.projectProviderRule.findUnique({ where: { provider } });
  }

  async listAll(options: ProviderRuleListOptions = {}): Promise<PaginationResult<ProjectProviderRule>> {
    const { pagination, sort } = options;
    const orderBy: Prisma.ProjectProviderRuleOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { priority: 'asc' };

    return paginate<
      ProjectProviderRule,
      Prisma.ProjectProviderRuleWhereInput,
      Prisma.ProjectProviderRuleOrderByWithRelationInput
    >(this.prisma.projectProviderRule, { where: {}, orderBy, pagination });
  }

  async upsert(provider: PaymentProvider, data: ProviderRuleUpsertInput): Promise<ProjectProviderRule> {
    try {
      return await this.prisma.projectProviderRule.upsert({
        where: { provider },
        create: { provider, ...data },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project provider rule');
    }
  }

  async update(provider: PaymentProvider, data: ProviderRuleUpdateInput): Promise<ProjectProviderRule> {
    try {
      return await this.prisma.projectProviderRule.update({ where: { provider }, data });
    } catch (error) {
      throw new DatabaseException(error, 'project provider rule');
    }
  }
}
