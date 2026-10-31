export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { creditPurchaseCreateSchema } from '@/schemas/platform/payments/credit-purchase.schema';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const body = await request.json();
    const data = creditPurchaseCreateSchema.parse(body);
    const service = new PlatformPaymentService(prisma);
    const result = await service.startCreditPurchase(data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/payments/credit-purchases');
  }
}
