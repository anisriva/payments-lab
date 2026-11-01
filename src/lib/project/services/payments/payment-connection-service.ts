import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma';
import type { PrismaTransaction } from '@/lib/common/dao';
import { PaymentConnectionDAO } from '@/lib/project/dao/payments/payment-connection-dao';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { createProvider, countryAllowed, getCapabilities, isProviderKey } from '@/lib/common/payments/core/factory';
import { ProviderNotImplementedError } from '@/lib/common/payments/core/errors';
import { encryptJson, decryptJson } from '@/lib/common/payments/core/credentials-cipher';
import { getAppBaseUrl, getEncryptionKey, getPaymentEnvironment } from '@/lib/common/services/payments/payment-config';
import type { PaymentProvider } from '@/lib/common/payments/core/provider';
import type { PaginationInput } from '@/types/common/pagination';
import type { ProviderKey } from '@/lib/common/payments/core/types';
import { ProjectNotFoundError } from '@/lib/platform/services/projects/errors';
import { GatewayCountryNotSupportedError, GatewayCredentialsRejectedError, PaymentConnectionDisabledError, PaymentConnectionNotFoundError } from './errors';

export class PaymentConnectionService {
  private paymentConnectionDAO: PaymentConnectionDAO;
  private projectDAO: ProjectDAO;

  constructor(private readonly prisma: PrismaClient | PrismaTransaction) {
    this.paymentConnectionDAO = new PaymentConnectionDAO(prisma);
    this.projectDAO = new ProjectDAO(prisma);
  }

  async listForProject(projectId: string, pagination?: PaginationInput) {
    const result = await this.paymentConnectionDAO.listByProject(projectId, { pagination });
    return {
      ...result,
      data: result.data.map((c) => ({
        ...c,
        webhookUrl: `${getAppBaseUrl()}/api/webhooks/${c.provider}/${c.id}`,
      })),
    };
  }

  async getForProject(projectId: string, provider: string) {
    if (!isProviderKey(provider)) return null;
    return this.paymentConnectionDAO.findByProjectAndProvider(projectId, provider, getPaymentEnvironment());
  }

  async connect(input: { projectId: string; provider: string; keyId: string; keySecret: string; webhookSecret: string }) {
    const { projectId, provider, keyId, keySecret, webhookSecret } = input;

    const project = await this.projectDAO.findById(projectId);
    if (!project) throw new ProjectNotFoundError(projectId);

    if (!isProviderKey(provider)) throw new ProviderNotImplementedError(provider);
    const caps = getCapabilities(provider);
    if (!caps.implemented || !caps.flows.includes('project')) throw new ProviderNotImplementedError(provider);
    if (!countryAllowed(caps.receiverCountries, project.countryCode)) {
      throw new GatewayCountryNotSupportedError(caps.label, project.countryCode);
    }

    const adapter = createProvider(provider, { keyId, keySecret, webhookSecret }, getPaymentEnvironment());
    if (!(await adapter.verifyCredentials())) throw new GatewayCredentialsRejectedError(caps.label);

    const existing = await this.paymentConnectionDAO.findByProjectAndProvider(projectId, provider, getPaymentEnvironment());
    const id = existing?.id ?? randomUUID();
    const credentialsEnc = encryptJson({ keyId, keySecret, webhookSecret }, getEncryptionKey(), id);
    const displayHint = keyId.slice(0, 9) + '••••' + keyId.slice(-4);

    return this.paymentConnectionDAO.upsert({
      id,
      projectId,
      provider,
      environment: getPaymentEnvironment(),
      credentialsEnc,
      displayHint,
      isEnabled: true,
      verifiedAt: new Date(),
    });
  }

  async disconnect(projectId: string, connectionId: string) {
    const connection = await this.paymentConnectionDAO.findById(connectionId);
    if (!connection || connection.projectId !== projectId) throw new PaymentConnectionNotFoundError(connectionId);
    return this.paymentConnectionDAO.update(connectionId, { isEnabled: false });
  }

  async getAdapter(connectionId: string, opts: { requireEnabled: boolean }): Promise<{
    connection: { id: string; projectId: string; provider: ProviderKey; environment: string; isEnabled: boolean };
    adapter: PaymentProvider;
  }> {
    const connection = await this.paymentConnectionDAO.findWithCredentials(connectionId);
    if (!connection) throw new PaymentConnectionNotFoundError(connectionId);
    if (opts.requireEnabled && !connection.isEnabled) throw new PaymentConnectionDisabledError(connectionId);
    const creds = decryptJson(connection.credentialsEnc, getEncryptionKey(), connection.id);
    const adapter = createProvider(connection.provider, creds, connection.environment);
    return {
      connection: {
        id: connection.id,
        projectId: connection.projectId,
        provider: connection.provider,
        environment: connection.environment,
        isEnabled: connection.isEnabled,
      },
      adapter,
    };
  }
}
