export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { providerSettingUpdateSchema } from '@/schemas/platform/catalog/provider-setting.schema';
import { ProviderSettingsService } from '@/lib/common/services/payments/provider-settings-service';
import { InvalidPaymentFlowError } from '@/lib/common/services/payments/errors';
import type { ApiResponse } from '@/types/common';
import type { PaymentFlow } from '@/generated/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flow: string; provider: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { flow, provider } = await params;
    if (flow !== 'platform' && flow !== 'project') throw new InvalidPaymentFlowError(flow);
    const data = providerSettingUpdateSchema.parse(await request.json());
    const setting = await new ProviderSettingsService(prisma).updateSetting(provider, flow as PaymentFlow, data);
    return NextResponse.json({ success: true, data: setting }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'PATCH /api/platform/payments/provider-settings/[flow]/[provider]');
  }
}
