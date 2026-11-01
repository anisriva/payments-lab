import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, Country, Prisma } from '@/generated/prisma';
import type { CountryUpsertInput, CountryListOptions } from './types';

export class CountryDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByCode(code: string): Promise<Country | null> {
    return await this.prisma.country.findUnique({
      where: { code },
    });
  }

  async listAll(options: CountryListOptions = {}): Promise<PaginationResult<Country>> {
    const orderBy: Prisma.CountryOrderByWithRelationInput = { name: 'asc' };

    return paginate<
      Country,
      Prisma.CountryWhereInput,
      Prisma.CountryOrderByWithRelationInput
    >(this.prisma.country, {
      where: {},
      orderBy,
      pagination: options.pagination ?? { page: 1, limit: 100 },
    });
  }

  async upsert(code: string, data: CountryUpsertInput): Promise<Country> {
    try {
      return await this.prisma.country.upsert({
        where: { code },
        create: { code, ...data },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'country');
    }
  }
}
