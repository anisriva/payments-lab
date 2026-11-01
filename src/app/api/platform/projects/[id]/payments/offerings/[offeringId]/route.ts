export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { projectOfferingUpdateSchema } from '@/schemas/platform/projects/project-offering.schema';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import type { ApiResponse } from '@/types/common';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offeringId: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id, offeringId } = await params;
    const data = projectOfferingUpdateSchema.parse(await request.json());
    const offering = await new ProjectPaymentService(prisma).updateOffering(id, offeringId, data);
    return NextResponse.json({ success: true, data: offering }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'PATCH /api/platform/projects/[id]/payments/offerings/[offeringId]');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; offeringId: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id, offeringId } = await params;
    await new ProjectPaymentService(prisma).deleteOffering(id, offeringId);
    return NextResponse.json({ success: true, data: null }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'DELETE /api/platform/projects/[id]/payments/offerings/[offeringId]');
  }
}
