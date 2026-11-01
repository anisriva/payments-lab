export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { planPriceCreateSchema } from '@/schemas/platform/catalog/plan-price.schema';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const data = planPriceCreateSchema.parse(await request.json());
    const planPrice = await new PlatformPaymentService(prisma).createPlanPrice(data);
    return NextResponse.json({ success: true, data: planPrice }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/catalog/plan-prices');
  }
}
