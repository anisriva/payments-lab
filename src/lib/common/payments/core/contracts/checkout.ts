import { z } from 'zod';

export type CheckoutInstruction =
  | { kind: 'modal'; options: Record<string, unknown> }
  | { kind: 'redirect'; url: string }
  | { kind: 'embedded'; options: Record<string, unknown> };

export interface CheckoutStart {
  providerRef?: string;          // omitted when the provider's id only exists after payment; services adopt it from the first success event matched by our reference
  instruction: CheckoutInstruction;
}

export interface CheckoutHandlers {
  onSuccess: (confirmation: unknown) => void; // payload matches confirmationSchema
  onDismiss: () => void;
  onFailure: (message: string) => void;
}

/** The only place a provider's browser JS is loaded or called. */
export interface CheckoutLauncher {
  kind: 'modal' | 'redirect' | 'embedded';
  confirmationSchema: z.ZodType<unknown>;
  launch(instruction: CheckoutInstruction, handlers: CheckoutHandlers): Promise<void>;
}
