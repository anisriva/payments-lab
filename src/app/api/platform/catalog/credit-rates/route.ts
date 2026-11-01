export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { creditRateCreateSchema } from '@/schemas/platform/catalog/credit-rate.schema';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const data = creditRateCreateSchema.parse(await request.json());
    const rate = await new PlatformPaymentService(prisma).createCreditRate(data);
    return NextResponse.json({ success: true, data: rate }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/catalog/credit-rates');
  }
}
