'use client';

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { runCheckout } from '@/lib/common/payments/client/run-checkout';
import type { CheckoutInstruction } from '@/lib/common/payments/core/types';

interface StartedResult {
  recordId: string;
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

    await runCheckout(started.instruction, {
      onSuccess: async ({ paymentId, signature }) => {
        try {
          await input.confirm({ id: started.recordId, paymentId, signature });
        } catch {
          return; // confirm mutation toasted
        }
        router.push(
          '/checkout/return?url=' +
            encodeURIComponent(input.recordUrl(started.recordId)) +
            '&back=' +
            encodeURIComponent(pathname)
        );
      },
      onDismiss: () => toast('Checkout closed — the payment stays pending'),
      onFailure: (message) => toast.error(message),
    });
  }

  return { run };
}
