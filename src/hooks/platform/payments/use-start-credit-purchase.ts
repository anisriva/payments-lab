'use client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/common/utils/api-fetch';
import type { CreditPurchaseCreate } from '@/schemas/platform/payments/credit-purchase.schema';
import type { CheckoutInstruction } from '@/lib/common/payments/core/types';

interface StartResult { recordId: string; instruction: CheckoutInstruction }
export function useStartCreditPurchase() {
  return useMutation<StartResult, Error, CreditPurchaseCreate>({
    mutationFn: (data) => apiFetch('/api/platform/payments/credit-purchases', { method: 'POST', body: JSON.stringify(data) }),
    onError: (e) => toast.error(e.message),
  });
}
