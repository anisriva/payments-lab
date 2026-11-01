import type { PrismaClient, Project } from '@/generated/prisma';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import type { PaginationInput } from '@/types/common/pagination';
import { ProjectNameTakenError, ProjectNotFoundError } from './errors';
import type { ProjectCreate } from '@/schemas/platform/projects/project.schema';

export class ProjectService {
  private projectDAO: ProjectDAO;

  constructor(private readonly prisma: PrismaClient) {
    this.projectDAO = new ProjectDAO(prisma);
  }

  async listProjects(options: { pagination?: PaginationInput } = {}) {
    return this.projectDAO.list({ pagination: options.pagination });
  }

  async getProject(id: string): Promise<Project> {
    const project = await this.projectDAO.findById(id);
    if (!project) throw new ProjectNotFoundError(id);
    return project;
  }

  async createProject(data: ProjectCreate): Promise<Project> {
    const existing = await this.projectDAO.findByName(data.name);
    if (existing) throw new ProjectNameTakenError(data.name);
    try {
      return await this.projectDAO.create({ name: data.name, countryCode: data.countryCode });
    } catch (e) {
      if (e instanceof UniqueConstraintException) throw new ProjectNameTakenError(data.name);
      throw e;
    }
  }
}
