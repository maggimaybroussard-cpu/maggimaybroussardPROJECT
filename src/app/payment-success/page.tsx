'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
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

const NEXT_STEPS = [
  {
    step: '01',
    title: 'Check Your Email',
    description: 'A detailed receipt and confirmation have been sent to your email on file. Save it for your records.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Access Your Client Portal',
    description: 'Log in to your portal to view case updates, documents, messages, and your full billing history.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'We\'ll Be in Touch',
    description: 'Our team will follow up within one business day to confirm next steps and any outstanding items.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    step: '04',
    title: 'Upload Any Documents',
    description: 'If your matter requires supporting documents, upload them securely through the portal\'s Documents section.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
];

function generateReceiptHTML(params: {
  refCode: string;
  invoiceNumber: string | null;
  paidAmount: number;
  currency: string;
  sessionId: string | null;
  dateStr: string;
  lineItems: InvoiceData['line_items'];
  notes: string | null;
}): string {
  const { refCode, invoiceNumber, paidAmount, currency, sessionId, dateStr, lineItems, notes } = params;
  const lineItemsHTML = lineItems && lineItems.length > 0
    ? lineItems.map(item => `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">${item.description}</td>
        <td style="padding:8px 0;font-size:13px;color:#555;text-align:center;border-bottom:1px solid #f0f0f0;">${item.quantity}</td>
        <td style="padding:8px 0;font-size:13px;color:#555;text-align:right;border-bottom:1px solid #f0f0f0;">${fmt(item.unit_price, currency)}</td>
        <td style="padding:8px 0;font-size:13px;font-weight:600;color:#1a1a1a;text-align:right;border-bottom:1px solid #f0f0f0;">${fmt(item.total, currency)}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="padding:12px 0;font-size:13px;color:#888;text-align:center;">Legal services rendered</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Receipt — ${refCode}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Georgia,serif;color:#1a1a1a;background:#fff;padding:48px;max-width:700px;margin:0 auto}
    .header{border-bottom:2px solid #355E3B;padding-bottom:24px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:flex-end}
    .brand{font-size:22px;font-weight:bold;color:#355E3B}
    .brand-sub{font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase;margin-top:4px}
    .receipt-label{font-size:11px;color:#666;letter-spacing:2px;text-transform:uppercase;text-align:right}
    .receipt-num{font-size:18px;font-weight:bold;color:#1a1a1a;text-align:right;margin-top:4px}
    .section{margin-bottom:28px}
    .section-title{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:6px}
    .row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
    .row .label{color:#555}
    .row .value{font-weight:500;color:#1a1a1a}
    table{width:100%;border-collapse:collapse}
    th{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#888;padding:6px 0;text-align:left;border-bottom:2px solid #eee}
    th:last-child,th:nth-child(3){text-align:right}
    th:nth-child(2){text-align:center}
    .total-row{display:flex;justify-content:space-between;padding:14px 0;font-size:18px;border-top:2px solid #355E3B;margin-top:8px}
    .total-row .label{font-weight:bold;color:#1a1a1a}
    .total-row .value{font-weight:bold;color:#355E3B}
    .badge{display:inline-block;background:#e8f5e9;color:#355E3B;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase}
    .note{background:#f9f9f9;border-left:3px solid #355E3B;padding:12px 16px;font-size:12px;color:#555;margin-top:16px;line-height:1.6}
    .footer{margin-top:48px;padding-top:24px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center;line-height:1.8}
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
      <div class="receipt-num">${refCode}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Payment Status</div>
    <span class="badge">✓ Confirmed</span>
  </div>
  <div class="section">
    <div class="section-title">Receipt Details</div>
    ${invoiceNumber ? `<div class="row"><span class="label">Invoice Number</span><span class="value">${invoiceNumber}</span></div>` : ''}
    <div class="row"><span class="label">Payment Date</span><span class="value">${dateStr}</span></div>
    ${sessionId ? `<div class="row"><span class="label">Transaction ID</span><span class="value">${sessionId}</span></div>` : ''}
    <div class="row"><span class="label">Reference Code</span><span class="value">${refCode}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Services</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${lineItemsHTML}</tbody>
    </table>
    <div class="total-row">
      <span class="label">Total Paid</span>
      <span class="value">${fmt(paidAmount, currency)}</span>
    </div>
  </div>
  ${notes ? `<div class="note"><strong>Notes:</strong> ${notes}</div>` : ''}
  <div class="note">
    This receipt confirms your payment has been received and processed securely via Stripe.
    Please retain this document for your records.
  </div>
  <div class="footer">
    Maggi May Broussard · Contract Legal Services · Nationwide Remote Paralegal Support<br/>
    maggimaybroussard.com · Questions? Contact via the website contact form.<br/><br/>
    This is not a legal invoice. Provided for payment confirmation purposes only.
  </div>
</body>
</html>`.trim();
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
  const [downloading, setDownloading] = useState(false);
  const [showLineItems, setShowLineItems] = useState(false);

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

    trackEvent('checkout_progress', {
      event_category: 'conversion',
      checkout_step: 4,
      checkout_option: 'payment_confirmed',
      invoice_number: invoiceNumber ?? '',
    });

    async function fetchAndNotify() {
      try {
        const res = await fetch(`/api/invoices/get-details?invoice_id=${invoiceId}&session_id=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setInvoice(data.invoice ?? null);
        }

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
  const currency = invoice?.currency ?? 'usd';
  const lineItems = invoice?.line_items ?? null;
  const hasLineItems = lineItems && lineItems.length > 0;

  const handleDownloadReceipt = useCallback(() => {
    setDownloading(true);
    try {
      const html = generateReceiptHTML({
        refCode,
        invoiceNumber: invoiceNumber ?? invoice?.invoice_number ?? null,
        paidAmount,
        currency,
        sessionId,
        dateStr,
        lineItems,
        notes: invoice?.notes ?? null,
      });
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${refCode}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      trackEvent('receipt_downloaded', { event_category: 'engagement', invoice_id: invoiceId ?? '' });
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  }, [refCode, invoiceNumber, invoice, paidAmount, currency, sessionId, dateStr, lineItems, invoiceId]);

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

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-12 space-y-6">

        {/* ── Success Hero ── */}
        <div className="flex flex-col items-center text-center">
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

        {/* ── Receipt Card ── */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
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

          <div className="px-6 py-5 space-y-5">
            {/* Amount Paid */}
            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <span className="text-sm text-muted-foreground">Amount Paid</span>
              <span className="text-2xl font-bold text-foreground">{fmt(paidAmount, currency)}</span>
            </div>

            {/* Invoice Meta */}
            <div className="space-y-2.5">
              {(invoiceNumber || invoice?.invoice_number) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invoice</span>
                  <span className="text-sm font-medium text-foreground">
                    {invoiceNumber ?? invoice?.invoice_number}
                  </span>
                </div>
              )}
              {dateStr && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Date</span>
                  <span className="text-sm font-medium text-foreground">{dateStr}</span>
                </div>
              )}
              {invoice?.invoice_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invoice Date</span>
                  <span className="text-sm font-medium text-foreground">
                    {new Date(invoice.invoice_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}
              {sessionId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Transaction ID</span>
                  <span className="text-xs font-mono text-muted-foreground">{sessionId.slice(0, 24)}…</span>
                </div>
              )}
              {invoice?.status && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invoice Status</span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                    style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
                  >
                    {invoice.status}
                  </span>
                </div>
              )}
            </div>

            {/* ── Line Items (Invoice Breakdown) ── */}
            {hasLineItems && (
              <div className="border-t border-border/60 pt-4">
                <button
                  onClick={() => setShowLineItems(v => !v)}
                  className="flex items-center justify-between w-full text-left group"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                    Invoice Breakdown
                  </p>
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showLineItems ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showLineItems && (
                  <div className="mt-3 space-y-0 rounded-xl overflow-hidden border border-border/60">
                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/40 border-b border-border/60">
                      <span className="col-span-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</span>
                      <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Qty</span>
                      <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Rate</span>
                      <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</span>
                    </div>
                    {/* Rows */}
                    {lineItems!.map((item, i) => (
                      <div
                        key={i}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 ${i < lineItems!.length - 1 ? 'border-b border-border/40' : ''}`}
                      >
                        <span className="col-span-6 text-sm text-foreground">{item.description}</span>
                        <span className="col-span-2 text-sm text-muted-foreground text-center">{item.quantity}</span>
                        <span className="col-span-2 text-sm text-muted-foreground text-right">{fmt(item.unit_price, currency)}</span>
                        <span className="col-span-2 text-sm font-medium text-foreground text-right">{fmt(item.total, currency)}</span>
                      </div>
                    ))}
                    {/* Subtotal row */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/30 border-t border-border/60">
                      <span className="col-span-10 text-sm font-semibold text-foreground text-right">Total</span>
                      <span className="col-span-2 text-sm font-bold text-foreground text-right">{fmt(paidAmount, currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {invoice?.notes && (
              <div className="rounded-xl bg-muted/30 border border-border/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                <p className="text-sm text-foreground leading-relaxed">{invoice.notes}</p>
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

          {/* Download Receipt Footer */}
          <div className="px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Save a copy of this receipt for your records.
            </p>
            <button
              onClick={handleDownloadReceipt}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60"
            >
              {downloading ? (
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {downloading ? 'Preparing…' : 'Download Receipt'}
            </button>
          </div>
        </div>

        {/* ── What Happens Next ── */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div
            className="px-6 py-4"
            style={{ background: 'rgba(53,94,59,0.05)', borderBottom: '1px solid rgba(53,94,59,0.1)' }}
          >
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
              What Happens Next
            </p>
            <p className="text-sm text-foreground font-medium mt-0.5">
              Here&apos;s what to expect after your payment
            </p>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-0">
              {NEXT_STEPS.map((item, i) => (
                <div
                  key={item.step}
                  className={`flex gap-4 py-4 ${i < NEXT_STEPS.length - 1 ? 'border-b border-border/50' : ''}`}
                >
                  {/* Step number + icon */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
                    >
                      {item.icon}
                    </div>
                    <span className="text-xs font-mono font-bold text-muted-foreground/50">{item.step}</span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-semibold text-foreground mb-0.5">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
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
            Go to Dashboard
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground leading-relaxed">
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
