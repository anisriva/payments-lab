export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params;
    const service = new PlatformPaymentService(prisma);
    const purchase = await service.refreshCreditPurchase(id);
    return NextResponse.json({ success: true, data: purchase }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/payments/credit-purchases/[id]/refresh');
  }
}
