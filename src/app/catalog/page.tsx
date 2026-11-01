import { redirect } from 'next/navigation';
export default function CatalogRedirect() {
  redirect('/platform/plans?section=plan-prices');
}
