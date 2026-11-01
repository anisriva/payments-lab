import type { PrismaClient, PaymentProvider, PaymentFlow } from '@/generated/prisma';
import { PaymentProviderSettingDAO } from '@/lib/common/dao/payments/payment-provider-setting-dao';
import { PROVIDER_SETTINGS } from './data/provider-settings';

export async function seedProviderSettings(prisma: PrismaClient) {
  const settingDAO = new PaymentProviderSettingDAO(prisma);

  let created = 0;
  for (const setting of PROVIDER_SETTINGS) {
    const provider = setting.provider as PaymentProvider;
    const flow = setting.flow as PaymentFlow;
    // Do not overwrite Catalog edits — create only when the row is missing.
    if (await settingDAO.findByProvider(provider, flow)) continue;
    await settingDAO.upsert(provider, flow, {
      isEnabled: setting.isEnabled,
      receiverCountries: [...setting.receiverCountries],
      payerCountries: [...setting.payerCountries],
      currencies: [...setting.currencies],
    });
    created++;
  }

  console.log(`✅ Seeded ${created} payment provider settings (${PROVIDER_SETTINGS.length - created} already existed)`);
}
