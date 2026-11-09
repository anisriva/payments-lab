import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProjectOfferingPrice, Prisma } from '@/generated/prisma';
import type { ProjectOfferingPriceCreateInput, ProjectOfferingPriceUpdateInput } from './types';

const include = { offering: true } satisfies Prisma.ProjectOfferingPriceInclude;
export type ProjectOfferingPriceWithOffering = Prisma.ProjectOfferingPriceGetPayload<{ include: typeof include }>;

export class ProjectOfferingPriceDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<ProjectOfferingPriceWithOffering | null> {
    return this.prisma.projectOfferingPrice.findUnique({ where: { id }, include });
  }

  async listForOffering(offeringId: string): Promise<ProjectOfferingPrice[]> {
    return this.prisma.projectOfferingPrice.findMany({ where: { offeringId, isActive: true } });
  }

  /** Default price (marketId null) or the market's own row. */
  async resolveForMarket(offeringId: string, marketId: string | null): Promise<ProjectOfferingPriceWithOffering | null> {
    const prices = await this.prisma.projectOfferingPrice.findMany({
      where: { offeringId, isActive: true, OR: [{ marketId: null }, ...(marketId ? [{ marketId }] : [])] },
      include,
    });
    return prices.find((p) => p.marketId === marketId) ?? prices.find((p) => p.marketId === null) ?? null;
  }

  async create(data: ProjectOfferingPriceCreateInput & { id?: string }): Promise<ProjectOfferingPrice> {
    try {
      return await this.prisma.projectOfferingPrice.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'project offering price');
    }
  }

  async update(id: string, data: ProjectOfferingPriceUpdateInput): Promise<ProjectOfferingPrice> {
    try {
      return await this.prisma.projectOfferingPrice.update({ where: { id }, data });
    } catch (error) {
      throw new DatabaseException(error, 'project offering price');
    }
  }
}
