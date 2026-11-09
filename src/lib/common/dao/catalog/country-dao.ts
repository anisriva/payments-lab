import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, Country, Market, Prisma } from '@/generated/prisma';

export class CountryDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByCode(countryCode: string): Promise<Country | null> {
    return this.prisma.country.findUnique({ where: { countryCode } });
  }

  async listAll(options: { pagination?: { page: number; limit: number } } = {}): Promise<PaginationResult<Country>> {
    return paginate<Country, Prisma.CountryWhereInput, Prisma.CountryOrderByWithRelationInput>(
      this.prisma.country,
      { where: { isActive: true }, orderBy: { name: 'asc' }, pagination: options.pagination ?? { page: 1, limit: 100 } },
    );
  }

  async upsert(countryCode: string, data: Omit<Prisma.CountryCreateInput, 'countryCode'>): Promise<Country> {
    try {
      return await this.prisma.country.upsert({
        where: { countryCode },
        create: { countryCode, ...data },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'country');
    }
  }

  /** A project's/payer's market = its country's CountryMarketMap. */
  async marketForCountry(countryCode: string): Promise<Market | null> {
    const country = await this.prisma.country.findUnique({
      where: { countryCode },
      include: { countryMarketMaps: { include: { market: true } } },
    });
    return country?.countryMarketMaps.find((m) => m.isActive)?.market ?? null;
  }
}
