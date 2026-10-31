export function parsePositivePage(value: string | string[] | undefined): number {
  const parsed = Array.isArray(value) ? value[0] : value;
  const num = parseInt(parsed ?? '1', 10);
  return Number.isInteger(num) && num >= 1 ? num : 1;
}

export function parseEnumParam<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const parsed = Array.isArray(value) ? value[0] : value;
  if (!parsed) return fallback;
  return allowed.includes(parsed as T) ? (parsed as T) : fallback;
}

export function parseOptionalString(value: string | string[] | undefined): string | undefined {
  const parsed = Array.isArray(value) ? value[0] : value;
  if (!parsed) return undefined;
  const trimmed = parsed.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
