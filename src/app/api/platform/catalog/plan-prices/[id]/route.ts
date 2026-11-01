export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { planPriceUpdateSchema } from '@/schemas/platform/catalog/plan-price.schema';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import type { ApiResponse } from '@/types/common';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params;
    const data = planPriceUpdateSchema.parse(await request.json());
    const planPrice = await new PlatformPaymentService(prisma).updatePlanPrice(id, data);
    return NextResponse.json({ success: true, data: planPrice }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'PATCH /api/platform/catalog/plan-prices/[id]');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id } = await params;
    await new PlatformPaymentService(prisma).deletePlanPrice(id);
    return NextResponse.json({ success: true, data: null }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'DELETE /api/platform/catalog/plan-prices/[id]');
  }
}
