import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { ProviderProductDAO } from '@/lib/common/dao/payments/provider-product-dao';
import { UniqueConstraintException } from '@/lib/common/exceptions';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import type { EnsureProductInput } from '@/lib/common/payments/core/types';
import type { PaymentProvider as DbProvider, PaymentEnvironment as DbEnvironment, ProviderProductRefType as DbRefType } from '@/generated/prisma';

export class ProviderProductService {
  private providerProductDAO: ProviderProductDAO;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.providerProductDAO = new ProviderProductDAO(prisma);
  }

  async ensure(input: {
    scope: string;
    provider: DbProvider;
    environment: DbEnvironment;
    refType: DbRefType;
    refId: string;
    adapter: PaymentProvider;
    product: EnsureProductInput;
  }): Promise<string> {
    // 1. Find existing mapping
    const existing = await this.providerProductDAO.findByRef(
      input.scope, input.provider, input.environment, input.refType, input.refId
    );
    if (existing) return existing.providerRef;

    // 2. External call — never inside a transaction
    const { providerRef } = await input.adapter.ensureProduct(input.product);

    // 3. Create the row
    try {
      await this.providerProductDAO.create({
        scope: input.scope,
        provider: input.provider,
        environment: input.environment,
        refType: input.refType,
        refId: input.refId,
        providerRef,
      });
      return providerRef;
    } catch (e) {
      // 4. Concurrent creator won — re-read and return theirs
      if (e instanceof UniqueConstraintException) {
        const row = await this.providerProductDAO.findByRef(
          input.scope, input.provider, input.environment, input.refType, input.refId
        );
        if (row) return row.providerRef;
      }
      throw e;
    }
  }
}
