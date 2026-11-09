
import { z } from 'zod';
import type { CheckoutHandlers, CheckoutInstruction, CheckoutLauncher } from '../../contracts/checkout';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      on(event: string, handler: (r: { error: { description: string } }) => void): void;
      open(): void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScriptOnce(src: string): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

export const RAZORPAY_CLIENT: CheckoutLauncher = {
  kind: 'modal',
  confirmationSchema: z.object({
    paymentId: z.string(),
    signature: z.string(),
  }),
  async launch(instruction: CheckoutInstruction, handlers: CheckoutHandlers) {
    if (instruction.kind === 'redirect') {
      window.location.assign(instruction.url);
      return;
    }
    await loadScriptOnce('https://checkout.razorpay.com/v1/checkout.js');
    const rzp = new window.Razorpay!({
      ...instruction.options,
      handler: (r: { razorpay_payment_id: string; razorpay_signature: string }) =>
        handlers.onSuccess({ paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: { ondismiss: handlers.onDismiss },
    });
    rzp.on('payment.failed', (r) => handlers.onFailure(r.error.description));
    rzp.open();
  },
};
