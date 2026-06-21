'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface InvoicePaymentStatusReaderProps {
  onSuccess: (invoiceNumber: string) => void;
}

export default function InvoicePaymentStatusReader({ onSuccess }: InvoicePaymentStatusReaderProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const invoiceNum = searchParams.get('invoice');
    if (paymentStatus === 'success' && invoiceNum) {
      onSuccess(invoiceNum);
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('invoice');
      window.history.replaceState({}, '', url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
