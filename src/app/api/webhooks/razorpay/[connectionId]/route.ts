export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import { log } from '@/lib/common/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
): Promise<NextResponse> {
  const { connectionId } = await params;
  const rawBody = await request.text();
  const headers = Object.fromEntries([...request.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
  try {
    const service = new PaymentWebhookService(prisma);
    await service.ingest({ provider: 'razorpay', connectionId, rawBody, headers });
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    log('POST /api/webhooks/razorpay/[connectionId] error', error, 'error');
    if (error instanceof Error && error.name === 'InvalidPaymentSignatureError') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    if (error instanceof Error && error.name === 'PaymentConnectionNotFoundError') {
      return NextResponse.json({ error: 'Unknown connection' }, { status: 400 });
    }
    if (error instanceof Error && error.name === 'PaymentValidationError') {
      return NextResponse.json({ received: true }, { status: 200 });
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
