export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/common/connectors/prisma';
import { PaymentWebhookService } from '@/lib/common/services/payments/payment-webhook-service';
import { log } from '@/lib/common/utils';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const headers = Object.fromEntries([...request.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
  try {
    const service = new PaymentWebhookService(prisma);
    await service.ingest({ provider: 'razorpay', rawBody, headers });
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    log('POST /api/webhooks/razorpay error', error, 'error');
    if (error instanceof Error && error.name === 'InvalidPaymentSignatureError') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    if (error instanceof Error && error.name === 'PaymentValidationError') {
      return NextResponse.json({ received: true }, { status: 200 }); // retrying will never succeed
    }
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }); // provider retries
  }
}
