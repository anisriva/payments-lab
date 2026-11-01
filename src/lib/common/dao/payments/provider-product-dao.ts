import { PrismaTransaction } from '@/lib/common/dao';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, ProviderProduct, PaymentProvider, PaymentEnvironment, ProviderProductRefType } from '@/generated/prisma';
import type { ProviderProductCreateInput } from './types';

export class ProviderProductDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByRef(
    scope: string,
    provider: PaymentProvider,
    environment: PaymentEnvironment,
    refType: ProviderProductRefType,
    refId: string
  ): Promise<ProviderProduct | null> {
    return await this.prisma.providerProduct.findUnique({
      where: {
        scope_provider_environment_refType_refId: {
          scope,
          provider,
          environment,
          refType,
          refId,
        },
      },
    });
  }

  async listByRefs(refType: ProviderProductRefType, refIds: string[]): Promise<ProviderProduct[]> {
    return await this.prisma.providerProduct.findMany({
      where: {
        refType,
        refId: { in: refIds },
      },
    });
  }

  async deleteByRef(refType: ProviderProductRefType, refId: string): Promise<void> {
    try {
      await this.prisma.providerProduct.deleteMany({
        where: { refType, refId },
      });
    } catch (error) {
      throw new DatabaseException(error, 'provider product');
    }
  }

  async create(data: ProviderProductCreateInput): Promise<ProviderProduct> {
    try {
      return await this.prisma.providerProduct.create({
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'provider product');
    }
  }
}
