export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { subscriptionCancelSchema } from '@/schemas/platform/payments/subscription.schema';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; subscriptionId: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { projectId, subscriptionId } = await params;
    const data = subscriptionCancelSchema.parse(await request.json());
    const sub = await new ProjectPaymentService(prisma).cancelSubscription(projectId, subscriptionId, data.atCycleEnd);
    return NextResponse.json({ success: true, data: sub }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST .../subscriptions/[subscriptionId]/cancel');
  }
}
