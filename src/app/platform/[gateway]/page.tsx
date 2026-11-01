import { redirect } from 'next/navigation';
export default async function LegacyGateway({ params }: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await params;
  redirect(`/platform/checkout/${gateway}`);
}
