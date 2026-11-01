import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PaymentValidationError } from './errors';

const VERSION = 'v1';

function assertKey(key: Buffer): void {
  if (key.length !== 32) throw new PaymentValidationError('Encryption key must be 32 bytes');
}

export function encryptJson(value: unknown, key: Buffer, aad: string): string {
  assertKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptJson<T>(payload: string, key: Buffer, aad: string): T {
  assertKey(key);
  const [version, ivB64, tagB64, ctB64] = payload.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new PaymentValidationError('Unsupported credentials format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}
