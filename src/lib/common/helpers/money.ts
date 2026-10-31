export function formatMoney(amountMinor: number, currency: string): string {
  return Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amountMinor / 100);
}
