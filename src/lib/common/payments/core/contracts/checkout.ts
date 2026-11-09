import { z } from 'zod';

export type CheckoutInstruction =
  | { kind: 'modal'; options: Record<string, unknown> }
  | { kind: 'redirect'; url: string }
  | { kind: 'embedded'; options: Record<string, unknown> };

export interface CheckoutStart {
  providerRef: string;
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
