export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; orderId: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { projectId, orderId } = await params;
    const order = await new ProjectPaymentService(prisma).refreshOrder(projectId, orderId);
    return NextResponse.json({ success: true, data: order }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST .../orders/[orderId]/refresh');
  }
}
