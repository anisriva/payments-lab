export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { creditRateUpdateSchema } from '@/schemas/platform/catalog/credit-rate.schema';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import type { ApiResponse } from '@/types/common';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params;
    const data = creditRateUpdateSchema.parse(await request.json());
    const rate = await new PlatformPaymentService(prisma).updateCreditRate(id, data);
    return NextResponse.json({ success: true, data: rate }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'PATCH /api/platform/catalog/credit-rates/[id]');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id } = await params;
    await new PlatformPaymentService(prisma).deleteCreditRate(id);
    return NextResponse.json({ success: true, data: null }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'DELETE /api/platform/catalog/credit-rates/[id]');
  }
}
