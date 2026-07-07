'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  line_items: InvoiceLineItem[] | null;
  notes: string | null;
  created_at: string;
  inquiry_id: string | null;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface RetainerSubscription {
  id: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_CONFIG: Record<string, { label: string; pill: string; dot: string }> = {
  paid: { label: 'Paid', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  sent: { label: 'Due', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  overdue: { label: 'Overdue', pill: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  draft: { label: 'Draft', pill: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
  cancelled: { label: 'Cancelled', pill: 'bg-gray-100 text-gray-400 border-gray-200', dot: 'bg-gray-300' },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientInvoicesPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [retainer, setRetainer] = useState<RetainerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'outstanding' | 'paid'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;

      const [invoicesRes, retainerRes] = await Promise.all([
        inquiryId
          ? supabase.from('client_invoices').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false })
          : supabase.from('client_invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase
          .from('retainer_subscriptions')
          .select('id,plan_name,amount,currency,status,current_period_start,current_period_end')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      setInvoices(invoicesRes.data || []);
      setRetainer(retainerRes.data?.[0] ?? null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login?redirectTo=/client/invoices');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Check for Stripe redirect success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setSuccessBanner('Payment successful! Your invoice will be updated shortly.');
      window.history.replaceState({}, '', '/client/invoices');
      fetchData();
    }
  }, [fetchData]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { invoice_id: invoice.id },
      });
      if (error) throw error;
      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank');
      } else if (data?.download_url) {
        window.open(data.download_url, '_blank');
      } else {
        router.push('/portal/invoices');
      }
    } catch {
      router.push('/portal/invoices');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePayNow = async (invoice: Invoice) => {
    setPayingInvoiceId(invoice.id);
    setPayError(null);
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
          success_url: `${window.location.origin}/client/invoices?payment=success`,
          cancel_url: `${window.location.origin}/client/invoices`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setPayingInvoiceId(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const outstanding = invoices.filter((i) => ['sent', 'pending', 'overdue'].includes(i.status));
  const paid = invoices.filter((i) => i.status === 'paid');
  const overdue = invoices.filter((i) => i.status === 'overdue');

  const totalOutstanding = outstanding.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0);
  const totalPaid = paid.reduce((s, i) => s + (i.amount_paid ?? i.amount), 0);

  const filtered = activeTab === 'outstanding' ? outstanding : activeTab === 'paid' ? paid : invoices;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-5xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
            <div className="w-28 h-6 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-5 md:px-8 py-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </main>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/client/dashboard" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo className="h-7 w-auto" />
            </Link>

            {/* Desktop nav */}
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

            <div className="flex items-center gap-2">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
              <button
                className="md:hidden p-2 rounded-lg hover:bg-muted/60 transition-colors"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileNavOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileNavOpen && (
            <div className="md:hidden border-t border-border/60 py-3 space-y-1">
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
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    item.href === '/client/invoices' ?'bg-primary/10 text-primary' :'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8">

        {/* Success Banner */}
        {successBanner && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-emerald-800">{successBanner}</p>
            <button onClick={() => setSuccessBanner(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Error Banner */}
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

        {/* Outstanding Alert */}
        {outstanding.length > 0 && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {fmt(totalOutstanding)} outstanding across {outstanding.length} invoice{outstanding.length !== 1 ? 's' : ''}
              </p>
              {overdue.length > 0 && (
                <p className="text-xs text-amber-700 mt-0.5">{overdue.length} invoice{overdue.length !== 1 ? 's are' : ' is'} overdue — please pay promptly to avoid service interruption.</p>
              )}
            </div>
          </div>
        )}

        {/* Page title */}
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Billing</p>
          <h1 className="text-2xl font-bold text-foreground">Invoices &amp; Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">View, download, and pay all invoices for your services and retainer.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground mt-1">{outstanding.length} invoice{outstanding.length !== 1 ? 's' : ''} due</p>
            {overdue.length > 0 && (
              <p className="text-xs text-red-600 font-medium mt-1">{overdue.length} overdue</p>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">{paid.length} invoice{paid.length !== 1 ? 's' : ''} paid</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Retainer</p>
            {retainer ? (
              <>
                <p className="text-2xl font-bold text-foreground">{fmt(retainer.amount, retainer.currency)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground mt-1">{retainer.plan_name}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${retainer.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {retainer.status === 'active' ? 'Active' : retainer.status}
                </span>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-1">No active retainer</p>
              </>
            )}
          </div>
        </div>

        {/* Retainer period info */}
        {retainer?.current_period_start && retainer?.current_period_end && (
          <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-3">
            <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-foreground">
              <span className="font-semibold">Current billing period:</span>{' '}
              {fmtDate(retainer.current_period_start)} – {fmtDate(retainer.current_period_end)}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-muted/40 rounded-xl p-1 w-fit">
          {([
            { key: 'all', label: `All (${invoices.length})` },
            { key: 'outstanding', label: `Outstanding (${outstanding.length})` },
            { key: 'paid', label: `Paid (${paid.length})` },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Invoice list */}
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No invoices found</p>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'outstanding' ? 'You have no outstanding invoices.' : activeTab === 'paid' ? 'No paid invoices yet.' : 'Your invoices will appear here once issued.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((invoice) => {
              const cfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
              const balance = Math.max(0, invoice.amount - (invoice.amount_paid ?? 0));
              const isExpanded = expandedId === invoice.id;
              const daysUntil = invoice.due_date ? getDaysUntil(invoice.due_date) : null;
              const isDownloading = downloadingId === invoice.id;
              const isPaying = payingInvoiceId === invoice.id;
              const canPay = ['sent', 'pending', 'overdue'].includes(invoice.status) && balance > 0;

              return (
                <div key={invoice.id} className="bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-sm">
                  {/* Row */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                  >
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

                    {/* Invoice info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{invoice.invoice_number}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.pill}`}>
                          {cfg.label}
                        </span>
                        {invoice.status === 'overdue' && daysUntil !== null && (
                          <span className="text-xs text-red-600 font-medium">{Math.abs(daysUntil)}d overdue</span>
                        )}
                        {invoice.status !== 'overdue' && invoice.status !== 'paid' && daysUntil !== null && daysUntil <= 7 && daysUntil >= 0 && (
                          <span className="text-xs text-amber-600 font-medium">Due in {daysUntil}d</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Issued {fmtDate(invoice.invoice_date ?? invoice.created_at)}
                        {invoice.due_date && ` · Due ${fmtDate(invoice.due_date)}`}
                      </p>
                    </div>

                    {/* Pay Now quick button for outstanding */}
                    {canPay && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePayNow(invoice); }}
                        disabled={isPaying}
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
                      >
                        {isPaying ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Processing…
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            Pay {fmt(balance, invoice.currency)}
                          </>
                        )}
                      </button>
                    )}

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{fmt(invoice.amount, invoice.currency)}</p>
                      {invoice.status !== 'paid' && balance > 0 && invoice.amount_paid > 0 && (
                        <p className="text-xs text-muted-foreground">{fmt(balance)} remaining</p>
                      )}
                      {invoice.status === 'paid' && (
                        <p className="text-xs text-emerald-600 font-medium">Paid in full</p>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border/60 px-5 py-4 bg-muted/20">
                      {/* Line items */}
                      {invoice.line_items && invoice.line_items.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Line Items</p>
                          <div className="space-y-1.5">
                            {invoice.line_items.map((item, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-4 text-sm">
                                <span className="text-foreground flex-1">{item.description}</span>
                                <span className="text-muted-foreground shrink-0">
                                  {item.quantity > 1 ? `${item.quantity} × ${fmt(item.unit_price, invoice.currency)}` : ''}
                                </span>
                                <span className="font-medium text-foreground shrink-0">{fmt(item.total, invoice.currency)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-border/60 flex justify-between text-sm font-semibold">
                            <span>Total</span>
                            <span>{fmt(invoice.amount, invoice.currency)}</span>
                          </div>
                          {invoice.amount_paid > 0 && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-muted-foreground">Paid</span>
                              <span className="text-emerald-600 font-medium">−{fmt(invoice.amount_paid, invoice.currency)}</span>
                            </div>
                          )}
                          {balance > 0 && (
                            <div className="flex justify-between text-sm font-bold mt-1">
                              <span>Balance Due</span>
                              <span className="text-red-600">{fmt(balance, invoice.currency)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {invoice.notes && (
                        <div className="mb-4 p-3 bg-background rounded-lg border border-border/60">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm text-foreground">{invoice.notes}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleDownload(invoice)}
                          disabled={isDownloading}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60"
                        >
                          {isDownloading ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Generating…
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download PDF
                            </>
                          )}
                        </button>

                        {canPay && (
                          <button
                            onClick={() => handlePayNow(invoice)}
                            disabled={isPaying}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                          >
                            {isPaying ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Redirecting to payment…
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
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Payment history link */}
        <div className="mt-6 text-center">
          <Link
            href="/portal/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
          >
            View full payment history in portal
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  );
}
