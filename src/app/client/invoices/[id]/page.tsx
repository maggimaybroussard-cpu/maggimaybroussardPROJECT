'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { trackEvent } from '@/lib/analytics';

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  line_items: InvoiceLineItem[] | null;
  notes: string | null;
  created_at: string;
  inquiry_id: string | null;
}

interface ClientInfo {
  name: string;
  email: string;
}

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  paid: { label: 'Paid', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  sent: { label: 'Due', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  overdue: { label: 'Overdue', pill: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  draft: { label: 'Draft', pill: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
  cancelled: { label: 'Cancelled', pill: 'bg-gray-100 text-gray-400 border-gray-200', dot: 'bg-gray-300' },
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id as string;
  const { user, loading: authLoading, signOut } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const fetchInvoice = useCallback(async () => {
    if (!user || !invoiceId) return;
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;

      // Fetch invoice
      let query = supabase.from('client_invoices').select('*').eq('id', invoiceId);
      if (inquiryId) {
        query = query.eq('inquiry_id', inquiryId);
      }
      const { data: inv, error } = await query.single();

      if (error || !inv) {
        setNotFound(true);
        return;
      }

      setInvoice(inv);

      // Track invoice detail view
      trackEvent('invoice_detail_view', {
        event_category: 'engagement',
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_status: inv.status,
        amount: inv.amount,
      });

      // Fetch client info
      if (inv.inquiry_id) {
        const { data: inquiry } = await supabase
          .from('contact_inquiries')
          .select('name, email')
          .eq('id', inv.inquiry_id)
          .single();
        if (inquiry) {
          setClientInfo({ name: inquiry.name, email: inquiry.email });
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [user, invoiceId]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login?redirectTo=/client/invoices');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchInvoice();
  }, [user, fetchInvoice]);

  const handlePayNow = async () => {
    if (!invoice) return;
    setPayingInvoice(true);
    setPayError(null);

    trackEvent('invoice_pay_click', {
      event_category: 'conversion',
      event_label: 'Invoice Pay Now',
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount - (invoice.amount_paid ?? 0),
    });

    try {
      const balance = Math.max(0, invoice.amount - (invoice.amount_paid ?? 0));
      const res = await fetch('/api/invoices/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: balance,
          currency: invoice.currency || 'usd',
          invoice_number: invoice.invoice_number,
          success_url: `${window.location.origin}/payment-success?invoice_id=${invoice.id}&invoice_number=${encodeURIComponent(invoice.invoice_number)}&amount=${balance}`,
          cancel_url: `${window.location.origin}/client/invoices/${invoice.id}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to create checkout session');
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setPayingInvoice(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-3xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
            <div className="w-28 h-6 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-5 md:px-8 py-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </main>
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
        <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Invoice Not Found</h1>
        <p className="text-sm text-muted-foreground mb-6">This invoice doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/client/invoices" className="px-5 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: '#355E3B' }}>
          Back to Invoices
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
  const balance = Math.max(0, invoice.amount - (invoice.amount_paid ?? 0));
  const canPay = ['sent', 'pending', 'overdue'].includes(invoice.status) && balance > 0;
  const lineItems = invoice.line_items ?? [];
  const subtotal = lineItems.reduce((s, item) => s + item.total, 0) || invoice.amount;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/client/dashboard" className="inline-flex items-center gap-2.5 shrink-0">
              <AppLogo className="h-7 w-auto" />
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {[
                { href: '/client/dashboard', label: 'Dashboard' },
                { href: '/client/invoices', label: 'Invoices' },
                { href: '/client/contracts', label: 'Contracts' },
                { href: '/portal/documents', label: 'Documents' },
                { href: '/portal/messages', label: 'Messages' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    item.href === '/client/invoices' ?'bg-primary/10 text-primary' :'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/client/invoices" className="hover:text-foreground transition-colors">Invoices</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-foreground font-medium">{invoice.invoice_number}</span>
        </div>

        {/* Pay Error */}
        {payError && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium text-red-800">{payError}</p>
            <button onClick={() => setPayError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Invoice Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-6">
          {/* Invoice Header */}
          <div className="px-6 py-5 border-b border-border/60" style={{ background: 'rgba(53,94,59,0.03)' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Invoice</p>
                <h1 className="text-2xl font-bold text-foreground">{invoice.invoice_number}</h1>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
                <p className="text-2xl font-bold text-foreground">{fmt(invoice.amount, invoice.currency)}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-border/60">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Invoice Date</p>
              <p className="text-sm font-medium text-foreground">{fmtDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Due Date</p>
              <p className={`text-sm font-medium ${invoice.status === 'overdue' ? 'text-red-600' : 'text-foreground'}`}>
                {fmtDate(invoice.due_date)}
              </p>
            </div>
          </div>

          {/* Billed To */}
          {clientInfo && (
            <div className="px-6 py-4 border-b border-border/60">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Billed To</p>
              <p className="text-sm font-medium text-foreground">{clientInfo.name}</p>
              <p className="text-sm text-muted-foreground">{clientInfo.email}</p>
            </div>
          )}

          {/* Line Items */}
          {lineItems.length > 0 ? (
            <div className="px-6 py-4 border-b border-border/60">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Services</p>
              <div className="space-y-0">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 pb-2 border-b border-border/40">
                  <span className="col-span-6 text-xs font-semibold text-muted-foreground">Description</span>
                  <span className="col-span-2 text-xs font-semibold text-muted-foreground text-center">Qty</span>
                  <span className="col-span-2 text-xs font-semibold text-muted-foreground text-right">Unit Price</span>
                  <span className="col-span-2 text-xs font-semibold text-muted-foreground text-right">Total</span>
                </div>
                {lineItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 py-2.5 border-b border-border/20 last:border-0">
                    <span className="col-span-6 text-sm text-foreground">{item.description}</span>
                    <span className="col-span-2 text-sm text-muted-foreground text-center">{item.quantity}</span>
                    <span className="col-span-2 text-sm text-muted-foreground text-right">{fmt(item.unit_price, invoice.currency)}</span>
                    <span className="col-span-2 text-sm font-medium text-foreground text-right">{fmt(item.total, invoice.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 border-b border-border/60">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Services</p>
              <p className="text-sm text-muted-foreground">Legal services — see invoice notes for details.</p>
            </div>
          )}

          {/* Totals */}
          <div className="px-6 py-4 space-y-2 border-b border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm font-medium text-foreground">{fmt(subtotal, invoice.currency)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount Paid</span>
                <span className="text-sm font-medium text-emerald-600">−{fmt(invoice.amount_paid, invoice.currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-base font-bold text-foreground">
                {invoice.status === 'paid' ? 'Total Paid' : 'Balance Due'}
              </span>
              <span className={`text-xl font-bold ${invoice.status === 'paid' ? 'text-emerald-600' : 'text-foreground'}`}>
                {fmt(invoice.status === 'paid' ? invoice.amount_paid || invoice.amount : balance, invoice.currency)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-6 py-4 border-b border-border/60">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          {/* Pay Button */}
          {canPay && (
            <div className="px-6 py-5">
              <button
                onClick={handlePayNow}
                disabled={payingInvoice}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: '#355E3B' }}
              >
                {payingInvoice ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Redirecting to Stripe…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Pay {fmt(balance, invoice.currency)} via Stripe
                  </>
                )}
              </button>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Secured by Stripe · All major cards accepted
              </p>
            </div>
          )}

          {invoice.status === 'paid' && (
            <div className="px-6 py-4 flex items-center gap-2.5 bg-emerald-50 border-t border-emerald-100">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-emerald-800">This invoice has been paid in full.</p>
            </div>
          )}
        </div>

        {/* Back link */}
        <Link
          href="/client/invoices"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all invoices
        </Link>
      </main>
    </div>
  );
}
