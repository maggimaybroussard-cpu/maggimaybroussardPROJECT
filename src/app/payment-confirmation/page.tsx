'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { PAYMENT_OPTIONS } from '@/components/PaymentModal';
import {
  trackPaymentSuccess,
  trackBookingConfirmationPageView,
  trackLeadQuality,
  trackServicesFunnelConversionComplete,
} from '@/lib/analytics';

interface TransactionDetails {
  paymentIntentId: string;
  amount: number;
  paymentType: string;
  label: string;
  description: string;
  email: string;
  name: string;
  date: string;
  referenceCode: string;
}

function generateReceiptHTML(tx: TransactionDetails): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Receipt — ${tx.referenceCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; color: #1a1a1a; background: #fff; padding: 48px; max-width: 680px; margin: 0 auto; }
    .header { border-bottom: 2px solid #355E3B; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 22px; font-weight: bold; color: #355E3B; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .receipt-label { font-size: 11px; color: #666; letter-spacing: 2px; text-transform: uppercase; text-align: right; }
    .receipt-num { font-size: 18px; font-weight: bold; color: #1a1a1a; text-align: right; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .row .label { color: #555; }
    .row .value { font-weight: 500; color: #1a1a1a; }
    .total-row { display: flex; justify-content: space-between; padding: 14px 0; font-size: 18px; border-top: 2px solid #355E3B; margin-top: 8px; }
    .total-row .label { font-weight: bold; color: #1a1a1a; }
    .total-row .value { font-weight: bold; color: #355E3B; }
    .status-badge { display: inline-block; background: #e8f5e9; color: #355E3B; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; line-height: 1.8; }
    .note { background: #f9f9f9; border-left: 3px solid #355E3B; padding: 12px 16px; font-size: 13px; color: #555; margin-top: 16px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Maggi May Broussard</div>
      <div class="brand-sub">Contract Legal Services · Nationwide · Remote</div>
    </div>
    <div>
      <div class="receipt-label">Payment Receipt</div>
      <div class="receipt-num">${tx.referenceCode}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payment Status</div>
    <span class="status-badge">✓ Confirmed</span>
  </div>

  <div class="section">
    <div class="section-title">Billed To</div>
    <div class="row"><span class="label">Name</span><span class="value">${tx.name}</span></div>
    <div class="row"><span class="label">Email</span><span class="value">${tx.email}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">${tx.date}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Service</div>
    <div class="row"><span class="label">Description</span><span class="value">${tx.label}</span></div>
    <div class="row"><span class="label">Details</span><span class="value">${tx.description}</span></div>
    <div class="row"><span class="label">Transaction ID</span><span class="value">${tx.paymentIntentId}</span></div>
    <div class="total-row">
      <span class="label">Total Paid</span>
      <span class="value">$${tx.amount.toLocaleString()} USD</span>
    </div>
  </div>

  <div class="note">
    This receipt confirms your payment has been received and processed securely via Stripe. 
    Please retain this document for your records. A copy has been sent to ${tx.email}.
  </div>

  <div class="footer">
    Maggi May Broussard · Contract Legal Services · Nationwide Remote Paralegal Support<br />
    maggimaybroussard.com · Questions? Contact via the website contact form.<br /><br />
    This is not a legal invoice. Provided for payment confirmation purposes only.
  </div>
</body>
</html>
  `.trim();
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    // Derive date on client only to avoid hydration mismatch
    const now = new Date();
    setDateStr(
      now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    );

    const paymentIntentId = searchParams.get('payment_intent') ?? '';
    const paymentType = searchParams.get('payment_type') ?? 'consultation_deposit';
    const email = searchParams.get('email') ?? '';
    const name = searchParams.get('name') ?? '';

    const option = PAYMENT_OPTIONS.find((o) => o.type === paymentType) ?? PAYMENT_OPTIONS[0];
    const refCode = paymentIntentId
      ? `RCP-${paymentIntentId.slice(-8).toUpperCase()}`
      : `RCP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    setTransaction({
      paymentIntentId: paymentIntentId || 'N/A',
      amount: option.amount,
      paymentType: option.type,
      label: option.label,
      description: option.description,
      email: email || 'on file',
      name: name || 'Valued Client',
      date: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      referenceCode: refCode,
    });

    // Fire conversion events when a real payment_intent is present
    if (paymentIntentId) {
      trackPaymentSuccess(option.type, option.amount, paymentIntentId);
      trackBookingConfirmationPageView(option.type, option.amount, paymentIntentId);
      trackLeadQuality({
        source: 'payment',
        service: option.label,
        conversionType: 'payment',
        value: option.amount,
      });
      // Fire services → booking funnel terminal conversion event
      trackServicesFunnelConversionComplete({
        paymentType: option.type,
        amount: option.amount,
        transactionId: paymentIntentId,
      });

      // Trigger post-payment welcome email sequence
      fetch('/api/post-payment-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: email || null,
          recipientName: name || 'Valued Client',
          service: option.label,
          amount: option.amount,
          paymentType: option.type,
          referenceCode: `RCP-${paymentIntentId.slice(-8).toUpperCase()}`,
          paymentIntentId,
        }),
      }).catch(() => {
        // Non-blocking — page experience unaffected if sequence scheduling fails
      });
    }
  }, [searchParams]);

  const handleDownloadReceipt = useCallback(() => {
    if (!transaction) return;
    setDownloading(true);

    try {
      const html = generateReceiptHTML(transaction);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${transaction.referenceCode}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  }, [transaction]);

  if (!transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="pt-28 pb-20 px-6 md:px-10 max-w-3xl mx-auto">
      {/* Success badge */}
      <div className="flex flex-col items-center text-center mb-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg"
          style={{ background: 'rgba(53,94,59,0.1)', border: '2px solid rgba(53,94,59,0.2)' }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#355E3B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Payment Confirmed
        </p>
        <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
          Thank you, {transaction.name.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground font-light leading-relaxed max-w-md">
          Your payment has been processed successfully. A confirmation has been sent to{' '}
          <span className="font-medium text-foreground">{transaction.email}</span>.
        </p>
      </div>

      {/* Transaction details card */}
      <div className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden mb-6">
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'rgba(53,94,59,0.05)', borderBottom: '1px solid rgba(53,94,59,0.1)' }}
        >
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
              Transaction Details
            </p>
            <p className="font-mono text-sm font-medium text-foreground mt-0.5">
              {transaction.referenceCode}
            </p>
          </div>
          <span
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
          >
            ✓ Paid
          </span>
        </div>

        <div className="divide-y divide-border">
          {[
            { label: 'Service', value: transaction.label },
            { label: 'Description', value: transaction.description },
            { label: 'Billed To', value: transaction.name },
            { label: 'Email', value: transaction.email },
            { label: 'Date', value: dateStr },
            { label: 'Payment ID', value: transaction.paymentIntentId },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between px-6 py-4 gap-4">
              <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground shrink-0 pt-0.5">
                {label}
              </span>
              <span className="text-sm text-foreground text-right font-light leading-relaxed">
                {value}
              </span>
            </div>
          ))}

          {/* Amount row */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ background: 'rgba(53,94,59,0.04)' }}
          >
            <span className="text-sm font-semibold uppercase tracking-widest text-foreground">
              Total Paid
            </span>
            <span className="text-2xl font-semibold" style={{ color: '#355E3B' }}>
              ${transaction.amount.toLocaleString()}{' '}
              <span className="text-sm font-normal text-muted-foreground">USD</span>
            </span>
          </div>
        </div>
      </div>

      {/* Download receipt */}
      <div className="rounded-2xl border border-border bg-background p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(53,94,59,0.08)' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#355E3B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Download Receipt</p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">
              Save a copy of your payment confirmation for your records
            </p>
          </div>
        </div>
        <button
          onClick={handleDownloadReceipt}
          disabled={downloading}
          className="shrink-0 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 flex items-center gap-2 border border-border hover:border-primary/40 hover:bg-primary/5 text-foreground"
        >
          {downloading ? (
            <>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Preparing…
            </>
          ) : (
            <>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 18 15 15" />
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
              </svg>
              Download
            </>
          )}
        </button>
      </div>

      {/* Next steps / Booking CTA */}
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(53,94,59,0.08) 0%, rgba(53,94,59,0.04) 100%)',
          border: '1px solid rgba(53,94,59,0.15)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(53,94,59,0.12)' }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#355E3B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Your Next Step
        </p>
        <h2 className="font-serif text-2xl text-foreground mb-3">
          {transaction.paymentType === 'consultation_deposit' ?'Schedule Your Consultation' :'Book Your Onboarding Call'}
        </h2>
        <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-sm mx-auto mb-6">
          {transaction.paymentType === 'consultation_deposit' ?'Your deposit is confirmed. Book your 30-minute consultation to discuss your legal support needs and next steps.' :'Your retainer is active. Schedule your onboarding call so we can align on priorities, timelines, and deliverables.'}
        </p>
        <Link
          href="/availability"
          className="inline-flex items-center gap-2.5 px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-md"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Book Your Session
        </Link>

        {/* Recommended services link */}
        <div className="mt-4">
          <Link
            href={`/payment-followup?payment_type=${transaction.paymentType}&name=${encodeURIComponent(transaction.name)}`}
            className="inline-flex items-center gap-2.5 px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 border hover:bg-white/60"
            style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B', background: 'rgba(255,255,255,0.4)' }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            See Recommended Next Steps
          </Link>
        </div>

        {/* Return to portal link */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/portal/invoices"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all duration-200 hover:bg-white/60 text-foreground"
            style={{ borderColor: 'rgba(53,94,59,0.25)', background: 'rgba(255,255,255,0.4)' }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Return to Invoice Portal
          </Link>
        </div>

        <p className="text-xs text-muted-foreground font-light mt-4">
          Questions?{' '}
          <Link href="/contact" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Contact us
          </Link>{' '}
          and we&apos;ll respond within one business day.
        </p>
      </div>
    </main>
  );
}

export default function PaymentConfirmationPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center pt-28">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        }
      >
        <ConfirmationContent />
      </Suspense>
      <Footer />
    </>
  );
}
