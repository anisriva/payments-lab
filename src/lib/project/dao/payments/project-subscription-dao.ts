import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProjectSubscription, Prisma } from '@/generated/prisma';
import type { ProjectSubscriptionCreateInput, ProjectSubscriptionUpdateInput, ProjectSubscriptionListOptions } from './types';

const projectSubscriptionListInclude = {
  offering: true,
} satisfies Prisma.ProjectSubscriptionInclude;

export type ProjectSubscriptionWithOffering = Prisma.ProjectSubscriptionGetPayload<{
  include: typeof projectSubscriptionListInclude;
}>;

export class ProjectSubscriptionDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<ProjectSubscription | null> {
    return await this.prisma.projectSubscription.findUnique({
      where: { id },
    });
  }

  async findByConnectionAndProviderSubscriptionId(connectionId: string, ref: string): Promise<ProjectSubscription | null> {
    return await this.prisma.projectSubscription.findFirst({
      where: {
        connectionId,
        providerSubscriptionId: ref,
      },
    });
  }

  async create(data: ProjectSubscriptionCreateInput): Promise<ProjectSubscription> {
    try {
      return await this.prisma.projectSubscription.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project subscription');
    }
  }

  async update(id: string, data: ProjectSubscriptionUpdateInput): Promise<ProjectSubscription> {
    try {
      return await this.prisma.projectSubscription.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project subscription');
    }
  }

  async list(options: ProjectSubscriptionListOptions): Promise<PaginationResult<ProjectSubscriptionWithOffering>> {
    const { pagination, sort, filters } = options;

    const where: Prisma.ProjectSubscriptionWhereInput = {
      projectId: filters.projectId,
      ...(filters.provider && { provider: filters.provider }),
      ...(filters.buyerEmail && { buyerEmail: filters.buyerEmail }),
    };

    const orderBy: Prisma.ProjectSubscriptionOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      ProjectSubscriptionWithOffering,
      Prisma.ProjectSubscriptionWhereInput,
      Prisma.ProjectSubscriptionOrderByWithRelationInput
    >(this.prisma.projectSubscription, {
      where,
      orderBy,
      pagination,
      include: projectSubscriptionListInclude,
    });
  }
}
