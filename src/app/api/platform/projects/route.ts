export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { projectCreateSchema } from '@/schemas/platform/projects/project.schema';
import { ProjectService } from '@/lib/platform/services/projects/project-service';
import type { ApiResponse } from '@/types/common';

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const data = projectCreateSchema.parse(await request.json());
    const project = await new ProjectService(prisma).createProject(data);
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/projects');
  }
}
