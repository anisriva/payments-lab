'use client';

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getClientAdapter } from '@/lib/common/payments/core/registry.client';
import type { CheckoutInstruction } from '@/lib/common/payments/core/contracts/checkout';
import type { ProviderKey } from '@/lib/common/payments/core/contracts/provider';

interface StartedResult {
  recordId: string;
  provider: ProviderKey;
  instruction: CheckoutInstruction;
}

export function useCheckoutFlow() {
  const router = useRouter();
  const pathname = usePathname();

  async function run(input: {
    start: () => Promise<StartedResult>;
    confirm: (input: { id: string; paymentId: string; signature: string }) => Promise<unknown>;
    recordUrl: (id: string) => string;
  }): Promise<void> {
    let started: StartedResult;
    try {
      started = await input.start();
    } catch {
      return; // start mutation already toasted the error
    }

    if (started.instruction.kind === 'redirect') {
      window.location.assign(started.instruction.url);
      return;
    }
    const launcher = getClientAdapter(started.provider).client;
    await launcher.launch(started.instruction, {
      onSuccess: async (payload) => {
        const parsed = launcher.confirmationSchema.safeParse(payload);
        if (!parsed.success) return;
        const { paymentId, signature } = parsed.data as { paymentId: string; signature: string };
        try {
          await input.confirm({ id: started.recordId, paymentId, signature });
        } catch {
          return; // confirm mutation toasted
        }
        router.push(
          '/checkout/return?url=' +
            encodeURIComponent(input.recordUrl(started.recordId)) +
            '&back=' +
            encodeURIComponent(pathname) +
            '&provider=' +
            started.provider
        );
      },
      onDismiss: () => toast('Checkout closed — the payment stays pending'),
      onFailure: (message) => toast.error(message),
    });
  }

  return { run };
}
