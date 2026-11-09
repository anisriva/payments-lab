export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { ProjectPaymentConnectionService } from '@/lib/project/services/payments/project-payment-connection-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id, connectionId } = await params;
    const report = await new ProjectPaymentConnectionService(prisma).revalidate(id, connectionId);
    return NextResponse.json({ success: true, data: report }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/projects/[id]/payments/connections/[connectionId]/revalidate');
  }
}
