export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { projectOfferingCreateSchema } from '@/schemas/platform/projects/project-offering.schema';
import { ProjectPaymentService } from '@/lib/project/services/payments/project-payment-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params;
    const data = projectOfferingCreateSchema.parse(await request.json());
    const offering = await new ProjectPaymentService(prisma).createOffering(id, data);
    return NextResponse.json({ success: true, data: offering }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/projects/[id]/payments/offerings');
  }
}
