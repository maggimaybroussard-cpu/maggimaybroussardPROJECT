'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import { createClient } from '@/lib/supabase/client';

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  notes: string | null;
  payment_token: string;
  contact_inquiries: {
    name: string;
    email: string;
    service: string;
  } | null;
}

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PayInvoicePage() {
  const params = useParams();
  const token = params?.token as string;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    // Read URL search params client-side only to avoid hydration mismatch
    const sp = new URLSearchParams(window.location.search);
    const status = sp.get('payment');
    if (status) setPaymentStatus(status);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('Invalid payment link.');
      setLoading(false);
      return;
    }

    async function loadInvoice() {
      try {
        const supabase = createClient();
        const { data, error: fetchErr } = await supabase
          .from('client_invoices')
          .select('*, contact_inquiries(name, email, service)')
          .eq('payment_token', token)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!data) {
          setError('This payment link is invalid or has expired.');
          return;
        }
        if (data.status === 'paid') {
          setError('This invoice has already been paid. Thank you!');
          return;
        }
        if (data.status === 'cancelled') {
          setError('This invoice has been cancelled.');
          return;
        }
        setInvoice(data as InvoiceData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load invoice.');
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [token]);

  const handlePay = async () => {
    if (!invoice) return;
    setRedirecting(true);
    setError(null);

    const balance = Number(invoice.amount) - Number(invoice.amount_paid);
    const clientInfo = invoice.contact_inquiries;

    try {
      const res = await fetch('/api/invoices/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          description: invoice.line_items?.[0]?.description || `Invoice ${invoice.invoice_number}`,
          amount: balance,
          currency: invoice.currency,
          customerEmail: clientInfo?.email ?? '',
          customerName: clientInfo?.name ?? '',
          dueDate: invoice.due_date,
          successPath: `/pay/${token}?payment=success`,
          cancelPath: `/pay/${token}?payment=cancelled`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to create payment session');
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open payment. Please try again.');
      setRedirecting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#EDE8E0' }}>
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#C8965A', borderTopColor: 'transparent' }} />
          <p className="text-sm font-serif" style={{ color: '#7A6B5D' }}>Loading your invoice…</p>
        </div>
      </div>
    );
  }

  // ── Already paid / error ──
  if (error && !invoice) {
    const isPaid = error.includes('already been paid');
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#EDE8E0' }}>
        <div className="max-w-md w-full rounded-2xl border p-8 text-center space-y-5" style={{ background: '#FAF7F2', borderColor: '#D9D0C5' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: isPaid ? '#EAF2EB' : '#FEF2F2' }}>
            {isPaid ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold mb-2" style={{ color: '#2C1F14' }}>
              {isPaid ? 'Invoice Already Paid' : 'Payment Link Unavailable'}
            </h1>
            <p className="text-sm font-serif leading-relaxed" style={{ color: '#7A6B5D' }}>{error}</p>
          </div>
          <div className="pt-2 space-y-2">
            <Link
              href="/portal/billing"
              className="block w-full py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest text-center transition-all hover:opacity-90"
              style={{ background: '#355E3B', color: '#fff' }}
            >
              View Billing Portal
            </Link>
            <a
              href="mailto:maggimaybroussard@gmail.com"
              className="block w-full py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest text-center border transition-all hover:border-foreground/30"
              style={{ borderColor: '#D9D0C5', color: '#4A3728' }}
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const balance = Number(invoice.amount) - Number(invoice.amount_paid);
  const clientInfo = invoice.contact_inquiries;
  const firstName = clientInfo?.name?.split(' ')[0] ?? 'there';
  const isOverdue = invoice.status === 'overdue';

  // Check for Stripe return params — now driven by state, not window in render
  if (paymentStatus === 'success' && invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#EDE8E0' }}>
        <div className="max-w-md w-full rounded-2xl border p-8 text-center space-y-5" style={{ background: '#FAF7F2', borderColor: '#D9D0C5' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: '#EAF2EB' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold mb-2" style={{ color: '#2C1F14' }}>Payment Received</h1>
            <p className="text-sm font-serif leading-relaxed" style={{ color: '#7A6B5D' }}>
              Thank you, {firstName}. Your payment for Invoice {invoice.invoice_number} has been processed. A receipt will be emailed to you shortly.
            </p>
          </div>
          <Link
            href="/portal/billing"
            className="block w-full py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest text-center transition-all hover:opacity-90"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            View Billing Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#EDE8E0' }}>
      {/* Header */}
      <header style={{ background: '#4A3728', borderBottom: '1px solid rgba(200,150,90,0.3)' }}>
        <div style={{ height: '4px', background: 'linear-gradient(to right, #C8965A, #E8B87A, #C8965A)' }} />
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <AppLogo size={32} className="brightness-0 invert opacity-90 group-hover:opacity-100 transition-opacity" />
            <div>
              <p className="text-white font-serif text-base leading-tight">Maggi May Broussard</p>
              <p className="font-serif text-xs tracking-widest uppercase" style={{ color: 'rgba(200,150,90,0.8)' }}>Legal Services</p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-serif uppercase tracking-widest" style={{ borderColor: 'rgba(200,150,90,0.4)', color: 'rgba(200,150,90,0.9)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure Payment
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-serif mb-1" style={{ color: '#2C1F14' }}>
            Hi {firstName}, your invoice is ready
          </h1>
          <p className="text-sm font-serif" style={{ color: '#7A6B5D' }}>
            Review the details below and pay securely with your card.
          </p>
        </div>

        {/* Overdue banner */}
        {isOverdue && (
          <div className="rounded-xl border-l-4 px-5 py-4" style={{ background: '#FEF2F2', borderColor: '#B91C1C' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#B91C1C' }}>⚠ Overdue Notice</p>
            <p className="text-sm font-serif" style={{ color: '#2C1F14' }}>
              This invoice was due on <strong>{formatDate(invoice.due_date)}</strong> and remains unpaid. Please complete payment immediately.
            </p>
          </div>
        )}

        {/* Invoice card */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: '#FAF7F2', borderColor: '#D9D0C5' }}>
          {/* Invoice header */}
          <div className="px-6 py-5 border-b" style={{ borderColor: '#D9D0C5' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#7A6B5D' }}>Invoice</p>
                <p className="text-xl font-serif font-semibold" style={{ color: '#2C1F14' }}>{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#7A6B5D' }}>Amount Due</p>
                <p className="text-2xl font-serif font-bold" style={{ color: isOverdue ? '#B91C1C' : '#C8965A' }}>
                  {formatCurrency(balance, invoice.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Invoice meta */}
          <div className="px-6 py-4 border-b grid grid-cols-2 gap-4" style={{ borderColor: '#D9D0C5' }}>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#7A6B5D' }}>Invoice Date</p>
              <p className="text-sm font-serif" style={{ color: '#2C1F14' }}>{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#7A6B5D' }}>Due Date</p>
              <p className="text-sm font-serif font-semibold" style={{ color: isOverdue ? '#B91C1C' : '#C2410C' }}>{formatDate(invoice.due_date)}</p>
            </div>
            {clientInfo?.name && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#7A6B5D' }}>Client</p>
                <p className="text-sm font-serif" style={{ color: '#2C1F14' }}>{clientInfo.name}</p>
              </div>
            )}
            {clientInfo?.service && (
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#7A6B5D' }}>Service</p>
                <p className="text-sm font-serif" style={{ color: '#2C1F14' }}>{clientInfo.service}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 && (
            <div className="px-6 py-4 border-b" style={{ borderColor: '#D9D0C5' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#7A6B5D' }}>Services</p>
              <div className="space-y-2">
                {invoice.line_items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-serif" style={{ color: '#2C1F14' }}>{item.description}</p>
                      {item.quantity > 1 && (
                        <p className="text-xs mt-0.5" style={{ color: '#7A6B5D' }}>
                          {item.quantity} × {formatCurrency(item.unit_price, invoice.currency)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-serif font-semibold shrink-0" style={{ color: '#2C1F14' }}>
                      {formatCurrency(item.total, invoice.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total row */}
          <div className="px-6 py-4" style={{ background: '#F5EDE0' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-serif font-semibold uppercase tracking-widest" style={{ color: '#4A3728' }}>Total Due</p>
              <p className="text-xl font-serif font-bold" style={{ color: isOverdue ? '#B91C1C' : '#C8965A' }}>
                {formatCurrency(balance, invoice.currency)}
              </p>
            </div>
            {Number(invoice.amount_paid) > 0 && (
              <p className="text-xs mt-1 text-right" style={{ color: '#7A6B5D' }}>
                {formatCurrency(invoice.amount_paid, invoice.currency)} already paid · Original: {formatCurrency(invoice.amount, invoice.currency)}
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="rounded-xl border px-5 py-4" style={{ background: '#FAF7F2', borderColor: '#D9D0C5' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#7A6B5D' }}>Notes</p>
            <p className="text-sm font-serif leading-relaxed" style={{ color: '#2C1F14' }}>{invoice.notes}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border-l-4 px-5 py-4" style={{ background: '#FEF2F2', borderColor: '#B91C1C' }}>
            <p className="text-sm font-serif" style={{ color: '#B91C1C' }}>{error}</p>
          </div>
        )}

        {/* Pay CTA */}
        <div className="space-y-3">
          <button
            onClick={handlePay}
            disabled={redirecting}
            className="w-full py-4 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
            style={{ background: isOverdue ? '#B91C1C' : '#355E3B', color: '#fff' }}
          >
            {redirecting ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Opening Secure Checkout…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Pay {formatCurrency(balance, invoice.currency)} Securely
              </>
            )}
          </button>

          <p className="text-center text-xs font-serif flex items-center justify-center gap-1.5" style={{ color: '#7A6B5D' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secured by Stripe · SSL encrypted · PCI compliant
          </p>

          <div className="flex items-center justify-center gap-6 pt-1">
            <Link href="/portal/billing" className="text-xs font-serif underline underline-offset-2" style={{ color: '#7A6B5D' }}>
              View Billing Portal
            </Link>
            <a href="mailto:maggimaybroussard@gmail.com" className="text-xs font-serif underline underline-offset-2" style={{ color: '#7A6B5D' }}>
              Questions? Contact Us
            </a>
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-4 gap-3 pt-2">
          {[
            { icon: '🔒', label: 'SSL Encrypted' },
            { icon: '⚡', label: 'Instant Confirm' },
            { icon: '✅', label: 'Stripe Secured' },
            { icon: '📄', label: 'Receipt Emailed' },
          ].map((b) => (
            <div key={b.label} className="rounded-xl border px-2 py-3 text-center" style={{ background: '#FAF7F2', borderColor: '#D9D0C5' }}>
              <p className="text-lg mb-1">{b.icon}</p>
              <p className="text-xs font-serif" style={{ color: '#7A6B5D' }}>{b.label}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-10 py-6 text-center" style={{ borderColor: '#D9D0C5', background: '#EDE8E0' }}>
        <p className="text-xs font-serif" style={{ color: '#7A6B5D' }}>
          © {new Date().getFullYear()} Maggi May Broussard Legal Services · Louisiana &amp; Nationwide
        </p>
      </footer>
    </div>
  );
}
