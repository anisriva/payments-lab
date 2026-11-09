import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { ProjectPaymentConnectionDAO } from '@/lib/project/dao/payments/project-payment-connection-dao';
import { getCredentials } from '@/lib/common/payments/core/registry.server';
import { encryptJson, decryptJson } from '@/lib/common/payments/core/credentials-cipher';
import { getEncryptionKey } from '@/config/payments/env';
import { InvalidCredentialsInputError, PaymentConnectionNotFoundError } from './errors';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';

/**
 * Input is parsed with the same schema as the form; generated fields (webhook secret)
 * are created once and kept on reconnect. Writes: runtime.parse → encryptJson (AAD =
 * connection id). Reads: decryptJson → runtime.parse. Never a cast.
 */
export class ProjectCredentialStore {
  private connectionDAO: ProjectPaymentConnectionDAO;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.connectionDAO = new ProjectPaymentConnectionDAO(prisma);
  }

  /** Parse human input with the provider's input schema — unknown keys dropped. */
  parseInput(provider: ProviderKey, credentials: Record<string, string>): Record<string, string> {
    const credentialModule = getCredentials(provider);
    const result = credentialModule.input.safeParse(credentials);
    if (!result.success) {
      const first = result.error.issues[0];
      throw new InvalidCredentialsInputError(`${first.path.join('.')}: ${first.message}`);
    }
    return result.data as Record<string, string>;
  }

  /** Runtime credentials = parsed input + generated fields (created once, kept on reconnect). */
  async buildRuntime(
    provider: ProviderKey,
    connectionId: string,
    input: Record<string, string>,
  ): Promise<Record<string, string>> {
    const credentialModule = getCredentials(provider);
    const generated: Record<string, string> = {};
    const existing = await this.readOrNull(provider, connectionId);

    for (const key of credentialModule.generated) {
      const kept = existing?.[key];
      generated[key] = typeof kept === 'string' && kept.length > 0 ? kept : randomBytes(32).toString('hex');
    }
    return credentialModule.runtime.parse({ ...input, ...generated }) as Record<string, string>;
  }

  encrypt(connectionId: string, runtime: Record<string, string>): string {
    return encryptJson(runtime, getEncryptionKey(), connectionId);
  }

  async read(provider: ProviderKey, connectionId: string): Promise<Record<string, string>> {
    const creds = await this.readOrNull(provider, connectionId);
    if (!creds) throw new PaymentConnectionNotFoundError(connectionId);
    return creds;
  }

  private async readOrNull(provider: ProviderKey, connectionId: string): Promise<Record<string, string> | null> {
    const row = await this.connectionDAO.findWithCredentials(connectionId);
    if (!row) return null;
    const credentialModule = getCredentials(provider);
    return credentialModule.runtime.parse(decryptJson(row.credentialsEnc, getEncryptionKey(), row.id)) as Record<string, string>;
  }

  displayHint(provider: ProviderKey, runtime: Record<string, string>): string {
    const credentialModule = getCredentials(provider);
    return credentialModule.displayHint(credentialModule.runtime.parse(runtime));
  }
}
