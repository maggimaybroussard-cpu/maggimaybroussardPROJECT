'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackInvoicePaid } from '@/lib/analytics';

interface BillingPaymentStatusReaderProps {
  onSuccess: (invoiceNumber: string) => void;
  onCancelled: () => void;
}

export default function BillingPaymentStatusReader({ onSuccess, onCancelled }: BillingPaymentStatusReaderProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const invoiceNum = searchParams.get('invoice');
    const invoiceId = searchParams.get('invoice_id') ?? '';
    const amountStr = searchParams.get('amount') ?? '0';
    if (paymentStatus === 'success' && invoiceNum) {
      // Track invoice paid milestone
      trackInvoicePaid(invoiceId, invoiceNum, parseFloat(amountStr));
      onSuccess(invoiceNum);
    } else if (paymentStatus === 'cancelled') {
      onCancelled();
    }
    if (paymentStatus) {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('invoice');
      url.searchParams.delete('invoice_id');
      url.searchParams.delete('amount');
      window.history.replaceState({}, '', url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
