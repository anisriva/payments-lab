import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProjectOrder, Prisma } from '@/generated/prisma';
import type { ProjectOrderCreateInput, ProjectOrderUpdateInput, ProjectOrderListOptions } from './types';

const projectOrderListInclude = {
  projectOfferingPrice: { include: { offering: true } },
} satisfies Prisma.ProjectOrderInclude;

export type ProjectOrderWithOffering = Prisma.ProjectOrderGetPayload<{
  include: typeof projectOrderListInclude;
}>;

export class ProjectOrderDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<ProjectOrder | null> {
    return await this.prisma.projectOrder.findUnique({
      where: { id },
    });
  }

  async findByConnectionAndProviderOrderId(connectionId: string, ref: string): Promise<ProjectOrder | null> {
    return await this.prisma.projectOrder.findFirst({
      where: {
        connectionId,
        providerOrderId: ref,
      },
    });
  }

  async create(data: ProjectOrderCreateInput): Promise<ProjectOrder> {
    try {
      return await this.prisma.projectOrder.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project order');
    }
  }

  async update(id: string, data: ProjectOrderUpdateInput): Promise<ProjectOrder> {
    try {
      return await this.prisma.projectOrder.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project order');
    }
  }

  async existsForOffering(offeringId: string): Promise<boolean> {
    const count = await this.prisma.projectOrder.count({
      where: { projectOfferingPrice: { offeringId } },
    });
    return count > 0;
  }

  async existsForProject(projectId: string): Promise<boolean> {
    const count = await this.prisma.projectOrder.count({
      where: { projectId },
    });
    return count > 0;
  }

  async list(options: ProjectOrderListOptions): Promise<PaginationResult<ProjectOrderWithOffering>> {
    const { pagination, sort, filters } = options;

    const where: Prisma.ProjectOrderWhereInput = {
      projectId: filters.projectId,
      ...(filters.provider && { provider: filters.provider }),
    };

    const orderBy: Prisma.ProjectOrderOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      ProjectOrderWithOffering,
      Prisma.ProjectOrderWhereInput,
      Prisma.ProjectOrderOrderByWithRelationInput
    >(this.prisma.projectOrder, {
      where,
      orderBy,
      pagination,
      include: projectOrderListInclude,
    });
  }
}
