import type { PaymentRecordKind, PaymentReference } from './contracts/events';
import { PaymentValidationError } from './errors';

const CODES: Record<PaymentRecordKind, string> = {
  platform_subscription: 'fs',
  platform_order: 'fo',
  project_subscription: 'ps',
  project_order: 'po',
};

const KINDS = new Map(Object.entries(CODES).map(([kind, code]) => [code, kind as PaymentRecordKind]));

export function encodeReference(ref: PaymentReference): string {
  const code = CODES[ref.kind];
  if (!code) throw new PaymentValidationError(`Unknown reference kind: ${ref.kind}`);
  return `${code}:${ref.id}`;
}

export function decodeReference(value: string | undefined | null): PaymentReference | undefined {
  if (!value) return undefined;
  const i = value.indexOf(':');
  if (i <= 0) return undefined;
  const kind = KINDS.get(value.slice(0, i));
  const id = value.slice(i + 1);
  if (!kind || !id) return undefined;
  return { kind, id };
}
