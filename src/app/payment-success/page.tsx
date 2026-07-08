'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { trackEvent } from '@/lib/analytics';

interface InvoiceData {
  id: string;
  invoice_number: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  due_date: string | null;
  invoice_date: string | null;
  notes: string | null;
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }> | null;
}

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionId = searchParams.get('session_id');
  const invoiceId = searchParams.get('invoice_id');
  const invoiceNumber = searchParams.get('invoice_number');
  const amountParam = searchParams.get('amount');

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const now = new Date();
    setDateStr(now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);

  useEffect(() => {
    if (!sessionId && !invoiceId) {
      router.replace('/client/invoices');
      return;
    }

    // Track payment funnel completion
    trackEvent('payment_funnel_complete', {
      event_category: 'conversion',
      event_label: 'Invoice Payment Success',
      session_id: sessionId ?? '',
      invoice_id: invoiceId ?? '',
      invoice_number: invoiceNumber ?? '',
      value: amountParam ? parseFloat(amountParam) : 0,
      currency: 'USD',
    });

    // GA4 purchase event
    trackEvent('purchase', {
      transaction_id: sessionId ?? invoiceId ?? '',
      value: amountParam ? parseFloat(amountParam) : 0,
      currency: 'USD',
      items: [
        {
          item_id: invoiceId ?? '',
          item_name: `Invoice ${invoiceNumber ?? ''}`,
          price: amountParam ? parseFloat(amountParam) : 0,
          quantity: 1,
          item_category: 'legal_services',
        },
      ],
    });

    // Track payment funnel step
    trackEvent('checkout_progress', {
      event_category: 'conversion',
      checkout_step: 4,
      checkout_option: 'payment_confirmed',
      invoice_number: invoiceNumber ?? '',
    });

    // Fetch invoice details and trigger receipt email
    async function fetchAndNotify() {
      try {
        // Fetch invoice from API
        const res = await fetch(`/api/invoices/get-details?invoice_id=${invoiceId}&session_id=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setInvoice(data.invoice ?? null);
        }

        // Trigger receipt email
        const emailRes = await fetch('/api/invoices/send-receipt-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: invoiceId,
            session_id: sessionId,
            invoice_number: invoiceNumber,
            amount: amountParam ? parseFloat(amountParam) : 0,
          }),
        });

        if (emailRes.ok) {
          setEmailSent(true);
          trackEvent('receipt_email_sent', {
            event_category: 'engagement',
            invoice_id: invoiceId ?? '',
          });
        } else {
          const errData = await emailRes.json();
          setEmailError(errData.error ?? 'Could not send receipt email');
        }
      } catch {
        setEmailError('Receipt email could not be sent at this time.');
      } finally {
        setLoading(false);
      }
    }

    fetchAndNotify();
  }, [sessionId, invoiceId, invoiceNumber, amountParam, router]);

  const refCode = sessionId
    ? `RCP-${sessionId.slice(-8).toUpperCase()}`
    : invoiceId
    ? `RCP-${invoiceId.slice(-8).toUpperCase()}`
    : 'RCP-CONFIRMED';

  const paidAmount = amountParam ? parseFloat(amountParam) : invoice?.amount ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link href="/client/dashboard">
            <AppLogo className="h-7 w-auto" />
          </Link>
          <Link
            href="/client/invoices"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Invoices
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-12">
        {/* Success Hero */}
        <div className="flex flex-col items-center text-center mb-10">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg"
            style={{ background: 'rgba(53,94,59,0.1)', border: '2px solid rgba(53,94,59,0.2)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">
            Payment Confirmed
          </p>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
            Payment Successful
          </h1>
          <p className="text-muted-foreground font-light leading-relaxed max-w-md">
            Your invoice payment has been processed successfully. A receipt has been{' '}
            {emailSent ? (
              <span className="font-medium text-foreground">sent to your email</span>
            ) : (
              <span>sent to your email on file</span>
            )}
            .
          </p>
        </div>

        {/* Receipt Card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden mb-6">
          {/* Card Header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: 'rgba(53,94,59,0.05)', borderBottom: '1px solid rgba(53,94,59,0.1)' }}
          >
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                Payment Receipt
              </p>
              <p className="font-mono text-sm font-semibold text-foreground mt-0.5">{refCode}</p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Confirmed
            </span>
          </div>

          {/* Card Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Amount */}
            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <span className="text-sm text-muted-foreground">Amount Paid</span>
              <span className="text-2xl font-bold text-foreground">{fmt(paidAmount)}</span>
            </div>

            {/* Details */}
            <div className="space-y-2.5">
              {invoiceNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invoice</span>
                  <span className="text-sm font-medium text-foreground">{invoiceNumber}</span>
                </div>
              )}
              {dateStr && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Date</span>
                  <span className="text-sm font-medium text-foreground">{dateStr}</span>
                </div>
              )}
              {sessionId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Transaction ID</span>
                  <span className="text-xs font-mono text-muted-foreground">{sessionId.slice(0, 24)}…</span>
                </div>
              )}
            </div>

            {/* Line items if available */}
            {invoice?.line_items && invoice.line_items.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Services
                </p>
                <div className="space-y-2">
                  {invoice.line_items.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-4">
                      <span className="text-sm text-foreground flex-1">{item.description}</span>
                      <span className="text-sm font-medium text-foreground shrink-0">{fmt(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email status */}
            <div className={`flex items-center gap-2.5 p-3 rounded-xl text-sm ${
              emailSent
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : emailError
                ? 'bg-amber-50 border border-amber-200 text-amber-800' :'bg-muted/40 border border-border text-muted-foreground'
            }`}>
              {emailSent ? (
                <>
                  <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Receipt email sent to your email on file
                </>
              ) : emailError ? (
                <>
                  <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {emailError}
                </>
              ) : loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin shrink-0" />
                  Sending receipt email…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Receipt will be emailed to you shortly
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {invoiceId && (
            <Link
              href={`/client/invoices/${invoiceId}`}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              onClick={() => trackEvent('view_invoice_detail_click', { invoice_id: invoiceId, source: 'payment_success' })}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Invoice Detail
            </Link>
          )}
          <Link
            href="/client/invoices"
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            All Invoices
          </Link>
          <Link
            href="/client/dashboard"
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: '#355E3B' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
        </div>

        {/* Note */}
        <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed">
          Questions about this payment? Contact us via the{' '}
          <Link href="/contact" className="underline hover:text-foreground transition-colors">
            client portal
          </Link>{' '}
          or messaging hub.
        </p>
      </main>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
