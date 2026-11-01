import type { PrismaClient, Project } from '@/generated/prisma';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { ProjectOfferingDAO } from '@/lib/project/dao/payments/project-offering-dao';
import { ProjectOrderDAO } from '@/lib/project/dao/payments/project-order-dao';
import { ProjectSubscriptionDAO } from '@/lib/project/dao/payments/project-subscription-dao';
import { PaymentConnectionDAO } from '@/lib/project/dao/payments/payment-connection-dao';
import { CountryService } from '@/lib/common/services/catalog/country-service';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import type { PaginationInput } from '@/types/common/pagination';
import { ProjectInUseError, ProjectNameTakenError, ProjectNotFoundError } from './errors';
import type { ProjectCreate, ProjectUpdate } from '@/schemas/platform/projects/project.schema';

export class ProjectService {
  private projectDAO: ProjectDAO;
  private offeringDAO: ProjectOfferingDAO;
  private orderDAO: ProjectOrderDAO;
  private projectSubscriptionDAO: ProjectSubscriptionDAO;
  private connectionDAO: PaymentConnectionDAO;
  private countryService: CountryService;

  constructor(private readonly prisma: PrismaClient) {
    this.projectDAO = new ProjectDAO(prisma);
    this.offeringDAO = new ProjectOfferingDAO(prisma);
    this.orderDAO = new ProjectOrderDAO(prisma);
    this.projectSubscriptionDAO = new ProjectSubscriptionDAO(prisma);
    this.connectionDAO = new PaymentConnectionDAO(prisma);
    this.countryService = new CountryService(prisma);
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

  async updateProject(id: string, data: ProjectUpdate): Promise<Project> {
    const project = await this.projectDAO.findById(id);
    if (!project) throw new ProjectNotFoundError(id);

    if (data.name && data.name !== project.name) {
      const existing = await this.projectDAO.findByName(data.name);
      if (existing) throw new ProjectNameTakenError(data.name);
    }

    if (data.countryCode && data.countryCode !== project.countryCode) {
      await this.countryService.getCountry(data.countryCode);
      if (await this.offeringDAO.existsForProject(id)) {
        throw new ProjectInUseError("Country can't change once the project has offerings");
      }
    }

    try {
      return await this.projectDAO.update(id, data);
    } catch (e) {
      if (e instanceof UniqueConstraintException) throw new ProjectNameTakenError(data.name!);
      throw e;
    }
  }

  async deleteProject(id: string): Promise<void> {
    const project = await this.projectDAO.findById(id);
    if (!project) throw new ProjectNotFoundError(id);

    if (
      (await this.connectionDAO.existsForProject(id)) ||
      (await this.offeringDAO.existsForProject(id)) ||
      (await this.orderDAO.existsForProject(id)) ||
      (await this.projectSubscriptionDAO.existsForProject(id))
    ) {
      throw new ProjectInUseError("Project has payment data and can't be deleted");
    }

    await this.projectDAO.delete(id);
  }
}
