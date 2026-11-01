import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, Project, Prisma } from '@/generated/prisma';
import type { ProjectCreateInput, ProjectUpdateInput, ProjectListOptions } from './types';

export class ProjectDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<Project | null> {
    return await this.prisma.project.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Project | null> {
    return await this.prisma.project.findUnique({
      where: { name },
    });
  }

  async create(data: ProjectCreateInput): Promise<Project> {
    try {
      return await this.prisma.project.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project');
    }
  }

  async update(id: string, data: ProjectUpdateInput): Promise<Project> {
    try {
      return await this.prisma.project.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project');
    }
  }

  async delete(id: string): Promise<Project> {
    try {
      return await this.prisma.project.delete({
        where: { id },
      });
    } catch (error) {
      throw new DatabaseException(error, 'project');
    }
  }

  async list(options: ProjectListOptions = {}): Promise<PaginationResult<Project>> {
    const { pagination, sort } = options;

    const orderBy: Prisma.ProjectOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'asc' };

    return paginate<
      Project,
      Prisma.ProjectWhereInput,
      Prisma.ProjectOrderByWithRelationInput
    >(this.prisma.project, {
      where: {},
      orderBy,
      pagination,
    });
  }
}
