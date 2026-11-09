export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { providerSettingUpdateSchema } from '@/schemas/platform/catalog/provider-setting.schema';
import { ProviderRulesService } from '@/lib/common/services/payments/provider-rules-service';
import { InvalidPaymentFlowError } from '@/lib/common/services/payments/errors';
import type { ApiResponse } from '@/types/common';
import type { PaymentFlow } from '@/lib/common/payments/core/contracts/provider';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flow: string; provider: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { flow, provider } = await params;
    if (flow !== 'platform' && flow !== 'project') throw new InvalidPaymentFlowError(flow);
    const data = providerSettingUpdateSchema.parse(await request.json());
    const setting = await new ProviderRulesService(prisma).updateRule(provider, flow as PaymentFlow, data);
    return NextResponse.json({ success: true, data: setting }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'PATCH /api/platform/payments/provider-settings/[flow]/[provider]');
  }
}
