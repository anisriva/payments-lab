'use client';

import type { CheckoutInstruction } from '@/lib/common/payments/core/types';

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

export async function runCheckout(
  instruction: CheckoutInstruction,
  handlers: {
    onSuccess: (r: { paymentId: string; signature: string }) => void;
    onDismiss: () => void;
    onFailure: (message: string) => void;
  }
): Promise<void> {
  if (instruction.kind === 'redirect') {
    window.location.assign(instruction.url);
    return;
  }
  await loadRazorpayScript();
  const rzp = new window.Razorpay({
    ...instruction.options,
    handler: (r: { razorpay_payment_id: string; razorpay_signature: string }) => handlers.onSuccess({ paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
    modal: { ondismiss: handlers.onDismiss },
  });
  rzp.on('payment.failed', (r: { error: { description: string } }) => handlers.onFailure(r.error.description));
  rzp.open();
}
