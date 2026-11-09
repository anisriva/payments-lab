import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PaymentProvider, PaymentEnvironment, Prisma } from '@/generated/prisma';
import type { ProjectPaymentConnectionUpsertInput, ProjectPaymentConnectionUpdateInput, ProjectPaymentConnectionListOptions } from './types';

const projectPaymentConnectionSafeSelect = {
  id: true,
  projectId: true,
  provider: true,
  environment: true,
  displayHint: true,
  isEnabled: true,
  verifiedAt: true,
  webhookRef: true,
  webhookActive: true,
  webhookRegisteredAt: true,
  webhookError: true,
  validationReport: true,
  validatedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectPaymentConnectionSelect;

export type ProjectPaymentConnectionSafe = Prisma.ProjectPaymentConnectionGetPayload<{
  select: typeof projectPaymentConnectionSafeSelect;
}>;

export class ProjectPaymentConnectionDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<ProjectPaymentConnectionSafe | null> {
    return await this.prisma.projectPaymentConnection.findUnique({
      where: { id },
      select: projectPaymentConnectionSafeSelect,
    });
  }

  async findByProjectAndProvider(
    projectId: string,
    provider: PaymentProvider,
    environment: PaymentEnvironment
  ): Promise<ProjectPaymentConnectionSafe | null> {
    return await this.prisma.projectPaymentConnection.findUnique({
      where: {
        projectId_provider_environment: {
          projectId,
          provider,
          environment,
        },
      },
      select: projectPaymentConnectionSafeSelect,
    });
  }

  async findWithCredentials(id: string): Promise<{
    id: string;
    projectId: string;
    provider: PaymentProvider;
    environment: PaymentEnvironment;
    isEnabled: boolean;
    credentialsEnc: string;
  } | null> {
    return await this.prisma.projectPaymentConnection.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        provider: true,
        environment: true,
        isEnabled: true,
        credentialsEnc: true,
      },
    });
  }

  async upsert(data: ProjectPaymentConnectionUpsertInput): Promise<ProjectPaymentConnectionSafe> {
    try {
      return await this.prisma.projectPaymentConnection.upsert({
        where: {
          projectId_provider_environment: {
            projectId: data.projectId,
            provider: data.provider,
            environment: data.environment,
          },
        },
        create: data,
        update: {
          credentialsEnc: data.credentialsEnc,
          displayHint: data.displayHint,
          isEnabled: data.isEnabled,
          verifiedAt: data.verifiedAt,
        },
        select: projectPaymentConnectionSafeSelect,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project payment connection');
    }
  }

  async update(id: string, data: ProjectPaymentConnectionUpdateInput): Promise<ProjectPaymentConnectionSafe> {
    try {
      return await this.prisma.projectPaymentConnection.update({
        where: { id },
        data,
        select: projectPaymentConnectionSafeSelect,
      });
    } catch (error) {
      throw new DatabaseException(error, 'project payment connection');
    }
  }

  async existsForProject(projectId: string): Promise<boolean> {
    const count = await this.prisma.projectPaymentConnection.count({
      where: { projectId },
    });
    return count > 0;
  }

  async listEnabledByProject(projectId: string): Promise<ProjectPaymentConnectionSafe[]> {
    return await this.prisma.projectPaymentConnection.findMany({
      where: { projectId, isEnabled: true },
      select: projectPaymentConnectionSafeSelect,
    });
  }

  async listByProject(projectId: string, options: ProjectPaymentConnectionListOptions = {}): Promise<PaginationResult<ProjectPaymentConnectionSafe>> {
    const { pagination, sort } = options;

    const where: Prisma.ProjectPaymentConnectionWhereInput = {
      projectId,
    };

    const orderBy: Prisma.ProjectPaymentConnectionOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { createdAt: 'desc' };

    return paginate<
      ProjectPaymentConnectionSafe,
      Prisma.ProjectPaymentConnectionWhereInput,
      Prisma.ProjectPaymentConnectionOrderByWithRelationInput
    >(this.prisma.projectPaymentConnection, {
      where,
      orderBy,
      pagination,
      select: projectPaymentConnectionSafeSelect,
    });
  }
}
