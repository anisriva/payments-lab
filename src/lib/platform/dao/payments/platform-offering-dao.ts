import { PrismaTransaction } from '@/lib/common/dao';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PlatformOffering, PlatformOfferingPrice } from '@/generated/prisma';
import type { PlatformOfferingCreateInput, PlatformOfferingPriceCreateInput } from './types';

export class PlatformOfferingDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByKey(key: string): Promise<PlatformOffering | null> {
    return this.prisma.platformOffering.findUnique({ where: { key } });
  }

  async upsertByKey(key: string, data: Omit<PlatformOfferingCreateInput, 'key'>): Promise<PlatformOffering> {
    try {
      return await this.prisma.platformOffering.upsert({ where: { key }, create: { key, ...data }, update: data });
    } catch (error) {
      throw new DatabaseException(error, 'platform offering');
    }
  }
}

export class PlatformOfferingPriceDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findById(id: string): Promise<PlatformOfferingPrice | null> {
    return this.prisma.platformOfferingPrice.findUnique({ where: { id } });
  }

  async findActive(offeringKey: string, marketId: string, priceType: 'one_time' | 'recurring'): Promise<PlatformOfferingPrice | null> {
    return this.prisma.platformOfferingPrice.findFirst({
      where: { isActive: true, priceType, marketId, offering: { key: offeringKey, isActive: true } },
    });
  }

  async listForOffering(offeringId: string): Promise<PlatformOfferingPrice[]> {
    return this.prisma.platformOfferingPrice.findMany({ where: { offeringId }, orderBy: { createdAt: 'asc' } });
  }

  async create(data: PlatformOfferingPriceCreateInput & { id?: string }): Promise<PlatformOfferingPrice> {
    try {
      return await this.prisma.platformOfferingPrice.create({ data });
    } catch (error) {
      throw new DatabaseException(error, 'platform offering price');
    }
  }

  async update(id: string, data: Partial<PlatformOfferingPriceCreateInput>): Promise<PlatformOfferingPrice> {
    try {
      return await this.prisma.platformOfferingPrice.update({ where: { id }, data });
    } catch (error) {
      throw new DatabaseException(error, 'platform offering price');
    }
  }

  async upsert(offeringId: string, marketId: string, priceType: 'one_time' | 'recurring', billingMode: string | null, data: Omit<PlatformOfferingPriceCreateInput, 'offeringId' | 'marketId' | 'priceType' | 'billingMode'>): Promise<PlatformOfferingPrice> {
    try {
      const existing = await this.prisma.platformOfferingPrice.findFirst({ where: { offeringId, marketId, priceType, billingMode: billingMode as import('@/generated/prisma').BillingMode | null } });
      if (existing) return await this.prisma.platformOfferingPrice.update({ where: { id: existing.id }, data });
      return await this.prisma.platformOfferingPrice.create({ data: { ...data, offeringId, marketId, priceType, billingMode: billingMode as import('@/generated/prisma').BillingMode | null } });
    } catch (error) {
      throw new DatabaseException(error, 'platform offering price');
    }
  }
}
