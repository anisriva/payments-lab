import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProjectOffering, Prisma } from '@/generated/prisma';
import type { ProjectOfferingCreateInput, ProjectOfferingUpdateInput, ProjectOfferingListOptions } from './types';

export class ProjectOfferingDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<ProjectOffering | null> {
    return await this.prisma.projectOffering.findUnique({
      where: { id },
    });
  }

  async create(data: ProjectOfferingCreateInput): Promise<ProjectOffering> {
    try {
      return await this.prisma.projectOffering.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project offering');
    }
  }

  async update(id: string, data: ProjectOfferingUpdateInput): Promise<ProjectOffering> {
    try {
      return await this.prisma.projectOffering.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project offering');
    }
  }

  async delete(id: string): Promise<ProjectOffering> {
    try {
      return await this.prisma.projectOffering.delete({
        where: { id },
      });
    } catch (error) {
      throw new DatabaseException(error, 'project offering');
    }
  }

  async existsForProject(projectId: string): Promise<boolean> {
    const count = await this.prisma.projectOffering.count({
      where: { projectId },
    });
    return count > 0;
  }

  async listActiveByProject(projectId: string, options: ProjectOfferingListOptions = {}): Promise<PaginationResult<ProjectOffering>> {
    return this.listByProject(projectId, {
      ...options,
      filters: { ...options.filters, isActive: true },
    });
  }

  async listByProject(projectId: string, options: ProjectOfferingListOptions = {}): Promise<PaginationResult<ProjectOffering>> {
    const { pagination, sort, filters = {} } = options;

    const where: Prisma.ProjectOfferingWhereInput = {
      projectId,
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    const orderBy: Prisma.ProjectOfferingOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'asc' };

    return paginate<
      ProjectOffering,
      Prisma.ProjectOfferingWhereInput,
      Prisma.ProjectOfferingOrderByWithRelationInput
    >(this.prisma.projectOffering, {
      where,
      orderBy,
      pagination,
      include: { prices: true },
    });
  }
}
