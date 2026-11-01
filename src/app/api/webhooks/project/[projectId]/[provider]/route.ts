export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import { log } from '@/lib/common/utils';

const NOT_FOUND = new Set(['UnsupportedWebhookProviderError', 'ProjectNotFoundError', 'PaymentConnectionNotFoundError']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; provider: string }> }
): Promise<NextResponse> {
  const { projectId, provider } = await params;
  const rawBody = await request.text();
  const headers = Object.fromEntries([...request.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
  try {
    const service = new PaymentWebhookService(prisma);
    await service.ingest({ provider, target: { kind: 'project', projectId }, rawBody, headers });
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    log('POST /api/webhooks/project/[projectId]/[provider] error', error, 'error');
    if (error instanceof Error) {
      if (error.name === 'InvalidPaymentSignatureError') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
      if (NOT_FOUND.has(error.name)) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.name === 'PaymentValidationError') {
        return NextResponse.json({ received: true }, { status: 200 });
      }
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
