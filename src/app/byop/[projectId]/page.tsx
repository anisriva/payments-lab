import { redirect } from 'next/navigation';
export default async function LegacyByop({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(`/byop/projects/${projectId}/razorpay/setup`);
}
