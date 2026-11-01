export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { handleRouteError } from '@/lib/common/utils/api-error-handler';
import { PlatformProviderService } from '@/lib/platform/services/payments/platform-provider-service';
import type { ApiResponse } from '@/types/common';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { provider } = await params;
    const report = await new PlatformProviderService(prisma).validate(provider);
    return NextResponse.json({ success: true, data: report }, { status: 200 });
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/platform/payments/providers/[provider]/validate');
  }
}
