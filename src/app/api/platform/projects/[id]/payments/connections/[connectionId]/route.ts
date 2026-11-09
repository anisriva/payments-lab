export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { ProjectPaymentConnectionService } from '@/lib/project/services/payments/project-payment-connection-service';
import type { ApiResponse } from '@/types/common';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id, connectionId } = await params;
    await new ProjectPaymentConnectionService(prisma).disconnect(id, connectionId);
    return NextResponse.json({ success: true, data: null }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'DELETE /api/platform/projects/[id]/payments/connections/[connectionId]');
  }
}
