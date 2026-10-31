export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { PlatformPaymentService } from '@/lib/platform/services/payments/platform-payment-service';
import type { ApiResponse } from '@/types/common';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params;
    const service = new PlatformPaymentService(prisma);
    const subscription = await service.syncSubscription(id);
    return NextResponse.json({ success: true, data: subscription }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'GET /api/platform/payments/subscriptions/[id]');
  }
}
