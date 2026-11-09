import type { PrismaClient, PaymentProvider } from '@/generated/prisma';
import { PlatformProviderRuleDAO } from '@/lib/platform/dao/payments/platform-provider-rule-dao';
import { ProjectProviderRuleDAO } from '@/lib/project/dao/payments/project-provider-rule-dao';
import { PROVIDER_SETTINGS } from './data/provider-settings';

export async function seedProviderSettings(prisma: PrismaClient) {
  const platformDAO = new PlatformProviderRuleDAO(prisma);
  const projectDAO = new ProjectProviderRuleDAO(prisma);

  let created = 0;
  for (const setting of PROVIDER_SETTINGS) {
    const provider = setting.provider as PaymentProvider;
    const dao = setting.flow === 'platform' ? platformDAO : projectDAO;
    // Do not overwrite Providers-tab edits — create only when the row is missing.
    if (await dao.findByProvider(provider)) continue;
    await dao.upsert(provider, {
      isEnabled: setting.isEnabled,
      receiverCountries: [...setting.receiverCountries],
      payerCountries: [...setting.payerCountries],
      currencies: [...setting.currencies],
    });
    created++;
  }

  console.log(`✅ Seeded ${created} provider rules (${PROVIDER_SETTINGS.length - created} already existed)`);
}
