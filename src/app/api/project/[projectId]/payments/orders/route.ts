export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { projectOrderCreateSchema } from '@/schemas/project/payments/project-order.schema';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { projectId } = await params;
    const data = projectOrderCreateSchema.parse(await request.json());
    const result = await new ProjectPaymentService(prisma).startOrder(projectId, data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/project/[projectId]/payments/orders');
  }
}
