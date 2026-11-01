export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { projectUpdateSchema } from '@/schemas/platform/projects/project.schema';
import { ProjectService } from '@/lib/platform/services/projects/project-service';
import type { ApiResponse } from '@/types/common';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { id } = await params;
    const data = projectUpdateSchema.parse(await request.json());
    const project = await new ProjectService(prisma).updateProject(id, data);
    return NextResponse.json({ success: true, data: project }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'PATCH /api/platform/projects/[id]');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id } = await params;
    await new ProjectService(prisma).deleteProject(id);
    return NextResponse.json({ success: true, data: null }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'DELETE /api/platform/projects/[id]');
  }
}
