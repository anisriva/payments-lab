export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { paymentConnectionCreateSchema } from '@/schemas/platform/projects/payment-connection.schema';
import { PaymentConnectionService } from '@/lib/project/services/payments/payment-connection-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params;
    const data = paymentConnectionCreateSchema.parse(await request.json());
    const connection = await new PaymentConnectionService(prisma).connect({ projectId: id, ...data });
    return NextResponse.json({ success: true, data: connection }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/projects/[id]/payments/connections');
  }
}
