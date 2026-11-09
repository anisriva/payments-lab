export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id } = await params;
    const service = new PaymentWebhookService(prisma);
    await service.reprocessPlatformEvent(id);
    return NextResponse.json({ success: true, data: null }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/payments/events/[id]/reprocess');
  }
}
