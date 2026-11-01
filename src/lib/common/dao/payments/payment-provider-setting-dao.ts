import { paginate, PrismaTransaction } from '@/lib/common/dao';
import { PaginationResult } from '@/types/common/pagination';
import { DatabaseException } from '@/lib/common/exceptions';
import type { PrismaClient, PaymentProviderSetting, PaymentProvider, PaymentFlow, Prisma } from '@/generated/prisma';
import type { PaymentProviderSettingUpsertInput, PaymentProviderSettingUpdateInput, PaymentProviderSettingListOptions } from './types';

export class PaymentProviderSettingDAO {
  constructor(private prisma: PrismaClient | PrismaTransaction) {}

  async findByProvider(provider: PaymentProvider, flow: PaymentFlow): Promise<PaymentProviderSetting | null> {
    return await this.prisma.paymentProviderSetting.findUnique({
      where: { provider_flow: { provider, flow } },
    });
  }

  async listAll(flow: PaymentFlow, options: PaymentProviderSettingListOptions = {}): Promise<PaginationResult<PaymentProviderSetting>> {
    const { pagination, sort } = options;

    const where: Prisma.PaymentProviderSettingWhereInput = { flow };

    const orderBy: Prisma.PaymentProviderSettingOrderByWithRelationInput = sort
      ? { [sort.field]: sort.direction }
      : { provider: 'asc' };

    return paginate<
      PaymentProviderSetting,
      Prisma.PaymentProviderSettingWhereInput,
      Prisma.PaymentProviderSettingOrderByWithRelationInput
    >(this.prisma.paymentProviderSetting, {
      where,
      orderBy,
      pagination,
    });
  }

  async upsert(provider: PaymentProvider, flow: PaymentFlow, data: PaymentProviderSettingUpsertInput): Promise<PaymentProviderSetting> {
    try {
      return await this.prisma.paymentProviderSetting.upsert({
        where: { provider_flow: { provider, flow } },
        create: { provider, flow, ...data },
        update: data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'payment provider setting');
    }
  }

  async update(provider: PaymentProvider, flow: PaymentFlow, data: PaymentProviderSettingUpdateInput): Promise<PaymentProviderSetting> {
    try {
      return await this.prisma.paymentProviderSetting.update({
        where: { provider_flow: { provider, flow } },
        data,
      });
    } catch (error) {
      throw new DatabaseException(error, 'payment provider setting');
    }
  }
}
