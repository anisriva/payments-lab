import { z } from 'zod';
import type { CheckoutLauncher } from '../../contracts/checkout';

export const DODO_CLIENT: CheckoutLauncher = {
  kind: 'redirect',
  confirmationSchema: z.object({}), // no client confirmation — the return page polls our record
  async launch(instruction, handlers) {
    if (instruction.kind !== 'redirect') {
      handlers.onFailure('Unsupported checkout');
      return;
    }
    window.location.assign(instruction.url);
  },
};
