import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const PROVIDERS = new Set(['razorpay', 'dodo']);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!PROVIDERS.has(provider)) return new Response(null, { status: 404 });

  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  await prisma.webhookEvent.create({ data: { provider, rawBody, headers } });
  return new Response(null, { status: 200 });
}