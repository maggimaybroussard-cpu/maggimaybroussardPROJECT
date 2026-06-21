'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import PaymentModal, { PAYMENT_OPTIONS, PaymentType } from '@/components/PaymentModal';
import { ACHPaymentModal, PaymentPlanModal } from '@/components/ACHPaymentComponents';
import PaymentMethodsPanel from '@/components/PaymentMethodsPanel';
import InvoicePaymentStatusReader from './InvoicePaymentStatusReader';
import { trackPortalInvoiceDownload } from '@/lib/analytics';
import { logPortalEvent } from '@/lib/portalEventLogger';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
  booking_stage: string;
  created_at: string;
}

interface Payment {
  id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  payment_status: string;
  payment_type: string;
  description: string | null;
  customer_name: string;
  customer_email: string;
  created_at: string;
}

interface Invoice {
  id: string;
  inquiry_id: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  line_items: InvoiceLineItem[];
  notes: string | null;
  created_at: string;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

const RETAINER_AMOUNT = 1500;
const DEPOSIT_AMOUNT = 150;

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPaymentTypeLabel(type: string) {
  if (type === 'consultation_deposit') return 'Consultation Deposit';
  if (type === 'retainer') return 'Retainer Agreement';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusBadge(status: string) {
  if (status === 'succeeded' || status === 'paid') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (status === 'pending') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (status === 'failed' || status === 'overdue') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function getStatusLabel(status: string) {
  if (status === 'succeeded') return 'Paid';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function InvoicesPortalPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [preselectedType, setPreselectedType] = useState<PaymentType | undefined>(undefined);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'history' | 'invoices' | 'timeline'>('overview');
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payLinkError, setPayLinkError] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [downloadInvoiceError, setDownloadInvoiceError] = useState<string | null>(null);
  const [achModalOpen, setAchModalOpen] = useState(false);
  const [achInvoice, setAchInvoice] = useState<Invoice | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planInvoice, setPlanInvoice] = useState<Invoice | null>(null);
  const [payMethodsInvoice, setPayMethodsInvoice] = useState<Invoice | null>(null);
  const [payMethodsOpen, setPayMethodsOpen] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState<Array<{
    id: string;
    event_type?: string;
    start_time: string;
    end_time?: string;
    status: string;
  }>>([]);

  // Live sync state
  const [liveFlash, setLiveFlash] = useState<string | null>(null);
  const [paymentSuccessBanner, setPaymentSuccessBanner] = useState<{ invoiceNumber: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data: accessData, error: accessError } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessError) throw accessError;

      let inquiryId = accessData?.inquiry_id ?? null;

      const paymentsQuery = supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const [paymentsRes, inquiryRes, invoicesRes] = await Promise.all([
        paymentsQuery,
        inquiryId
          ? supabase.from('contact_inquiries').select('id,name,email,service,status,booking_stage,created_at').eq('id', inquiryId).single()
          : Promise.resolve({ data: null, error: null }),
        inquiryId
          ? supabase.from('client_invoices').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false })
          : supabase.from('client_invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      setPayments(paymentsRes.data || []);
      if (inquiryRes.data) setInquiry(inquiryRes.data);
      setInvoices(invoicesRes.data || []);

      // Fetch upcoming bookings for this user's email
      if (user?.email) {
        const bookingsRes = await supabase
          .from('calendly_bookings')
          .select('id,event_type,start_time,end_time,status')
          .eq('email', user.email)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(10);
        setUpcomingBookings(bookingsRes.data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payment data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/portal/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    let inquiryId: string | null = null;

    supabase
      .from('client_portal_access')
      .select('inquiry_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        inquiryId = data?.inquiry_id ?? null;

        const invoiceChannel = supabase
          .channel('invoices-page-live')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'client_invoices',
              filter: inquiryId ? `inquiry_id=eq.${inquiryId}` : `user_id=eq.${user.id}`,
            },
            (payload) => {
              const newRow = payload.new as Invoice & { status?: string };
              const oldRow = payload.old as Invoice & { status?: string };
              if (payload.eventType === 'INSERT') {
                setLiveFlash('New invoice received');
              } else if (payload.eventType === 'UPDATE' && newRow.status !== oldRow?.status) {
                if (newRow.status === 'paid') {
                  setLiveFlash('Invoice marked as paid');
                } else if (newRow.status === 'overdue') {
                  setLiveFlash('Invoice is now overdue');
                } else {
                  setLiveFlash('Invoice updated');
                }
              }
              fetchData();
            }
          )
          .subscribe();

        const paymentsChannel = supabase
          .channel('invoices-payments-live')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payments',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              setLiveFlash('Payment record updated');
              fetchData();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(invoiceChannel);
          supabase.removeChannel(paymentsChannel);
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auto-clear flash message
  useEffect(() => {
    if (!liveFlash) return;
    const t = setTimeout(() => setLiveFlash(null), 4000);
    return () => clearTimeout(t);
  }, [liveFlash]);

  // Auto-dismiss success banner after 8 seconds
  useEffect(() => {
    if (!paymentSuccessBanner) return;
    const t = setTimeout(() => setPaymentSuccessBanner(null), 8000);
    return () => clearTimeout(t);
  }, [paymentSuccessBanner]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  const handleOpenPayment = (type?: PaymentType) => {
    setPreselectedType(type);
    setPaymentOpen(true);
  };

  const handlePaymentClose = () => {
    setPaymentOpen(false);
    setPreselectedType(undefined);
    fetchData();
  };

  const handleDownloadInvoice = async (payment: Payment) => {
    if (payment.payment_status !== 'succeeded') return;
    setDownloadingId(payment.id);
    setDownloadError(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          paymentIntentId: payment.payment_intent_id,
          customerName: payment.customer_name,
          customerEmail: payment.customer_email,
          paymentType: payment.payment_type,
          amount: Number(payment.amount),
          currency: payment.currency,
          createdAt: payment.created_at,
          returnPdf: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to generate invoice.');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${payment.payment_intent_id.slice(-8).toUpperCase()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        if (data?.pdfBase64) {
          const byteChars = atob(data.pdfBase64);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice-${payment.payment_intent_id.slice(-8).toUpperCase()}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          throw new Error('Invoice PDF not available.');
        }
      }
      trackPortalInvoiceDownload({
        invoiceType: 'payment_receipt',
        amount: Number(payment.amount),
      });
      logPortalEvent('portal_invoice_download', {
        invoice_type: 'payment_receipt',
        amount: Number(payment.amount),
      });
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download invoice.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    setPayingInvoiceId(invoice.id);
    setPayLinkError(null);
    try {
      const balance = Number(invoice.amount) - Number(invoice.amount_paid);
      const res = await fetch('/api/invoices/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          description: invoice.line_items?.[0]?.description || `Invoice ${invoice.invoice_number}`,
          amount: balance,
          currency: invoice.currency,
          customerEmail: user?.email ?? '',
          customerName: inquiry?.name ?? '',
          dueDate: invoice.due_date,
          successPath: `/portal/invoices?payment=success&invoice=${invoice.invoice_number}`,
          cancelPath: `/portal/invoices?payment=cancelled`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to create payment session');
      window.location.href = data.url;
    } catch (err: unknown) {
      setPayLinkError(err instanceof Error ? err.message : 'Could not open payment session.');
      setPayingInvoiceId(null);
    }
  };

  const handlePayInvoiceACH = (invoice: Invoice) => {
    setAchInvoice(invoice);
    setAchModalOpen(true);
  };

  const handlePayInvoicePlan = (invoice: Invoice) => {
    setPlanInvoice(invoice);
    setPlanModalOpen(true);
  };

  const handleOpenPayMethods = (invoice: Invoice) => {
    setPayMethodsInvoice(invoice);
    setPayMethodsOpen(true);
  };

  const handleDownloadClientInvoice = async (invoice: Invoice) => {
    setDownloadingInvoiceId(invoice.id);
    setDownloadInvoiceError(null);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const items = (invoice.line_items || []).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unit_price,
        total: li.total,
      }));

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          customerName: inquiry?.name ?? '',
          customerEmail: user?.email ?? '',
          paymentType: 'legal_services',
          amount: Number(invoice.amount),
          currency: invoice.currency || 'usd',
          items,
          notes: invoice.notes,
          returnPdf: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to generate invoice PDF.');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${invoice.invoice_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        if (data?.pdfBase64) {
          const byteChars = atob(data.pdfBase64);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Invoice-${invoice.invoice_number}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          throw new Error('Invoice PDF not available.');
        }
      }
      trackPortalInvoiceDownload({
        invoiceType: 'client_invoice',
        invoiceNumber: invoice.invoice_number,
        amount: Number(invoice.amount),
      });
      logPortalEvent('portal_invoice_download', {
        invoice_type: 'client_invoice',
        invoice_number: invoice.invoice_number,
        amount: Number(invoice.amount),
      });
    } catch (err: unknown) {
      setDownloadInvoiceError(err instanceof Error ? err.message : 'Could not download invoice.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  // Derived values
  const succeededPayments = payments.filter((p) => p.payment_status === 'succeeded');
  const totalPaid = succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const hasDeposit = succeededPayments.some((p) => p.payment_type === 'consultation_deposit');
  const hasRetainer = succeededPayments.some((p) => p.payment_type === 'retainer');
  const depositPayment = succeededPayments.find((p) => p.payment_type === 'consultation_deposit');
  const retainerPayment = succeededPayments.find((p) => p.payment_type === 'retainer');

  // Retainer balance: $1500 retainer - $150 deposit if deposit already applied
  const retainerBalance = hasRetainer ? 0 : hasDeposit ? RETAINER_AMOUNT - DEPOSIT_AMOUNT : RETAINER_AMOUNT;
  const retainerApplied = hasDeposit ? DEPOSIT_AMOUNT : 0;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-5xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="w-28 h-7 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 md:px-10 py-10 space-y-5">
          <div className="w-48 h-8 bg-muted/60 rounded-lg animate-pulse" />
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 h-32 animate-pulse" />
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 h-64 animate-pulse" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Read ?payment=success from URL (must be in Suspense for Next.js) */}
      <Suspense fallback={null}>
        <InvoicePaymentStatusReader
          onSuccess={(invoiceNumber) => {
            setPaymentSuccessBanner({ invoiceNumber });
            setActiveSection('invoices');
          }}
        />
      </Suspense>

      {/* Payment success banner */}
      {paymentSuccessBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-600 shadow-lg text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 max-w-sm w-full mx-4">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Payment received!</p>
            <p className="text-xs text-white/80 font-light">Invoice {paymentSuccessBanner.invoiceNumber} is being marked as paid.</p>
          </div>
          <button
            onClick={() => setPaymentSuccessBanner(null)}
            className="text-white/70 hover:text-white transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Live flash banner */}
      {liveFlash && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border shadow-lg text-sm font-medium text-foreground animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {liveFlash}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/portal/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                href="/portal/documents"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="hidden sm:inline">Documents</span>
              </Link>
              <Link
                href="/portal/retainer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="hidden sm:inline">Retainer</span>
              </Link>
              <Link
                href="/portal/billing"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="hidden sm:inline">Billing</span>
              </Link>
              {/* Live sync indicator */}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
              <button
                onClick={() => handleOpenPayment()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="hidden sm:inline">Make Payment</span>
                <span className="sm:hidden">Pay</span>
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-10 py-8 md:py-10">
        {/* Page heading */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Portal</p>
          <h1 className="font-serif text-4xl text-foreground">Invoices &amp; Payments</h1>
          {inquiry && (
            <p className="text-sm text-muted-foreground font-light mt-1">
              Linked to: <span className="font-medium text-foreground">{inquiry.service}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── PORTAL ALERTS: Overdue & Upcoming Invoice Reminders ── */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const overdueInvoices = invoices.filter((inv) => {
            if (inv.status === 'paid' || inv.status === 'cancelled') return false;
            const due = new Date(inv.due_date + 'T00:00:00');
            return due < today;
          });
          const upcomingInvoices = invoices.filter((inv) => {
            if (inv.status === 'paid' || inv.status === 'cancelled') return false;
            const due = new Date(inv.due_date + 'T00:00:00');
            const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
          });
          if (overdueInvoices.length === 0 && upcomingInvoices.length === 0) return null;
          return (
            <div className="mb-6 space-y-3">
              {overdueInvoices.map((inv) => {
                const due = new Date(inv.due_date + 'T00:00:00');
                const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                const balance = Number(inv.amount) - Number(inv.amount_paid);
                return (
                  <div key={inv.id} className="flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-800">
                        Invoice {inv.invoice_number} is {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        {formatCurrency(balance, inv.currency)} was due {formatDate(inv.due_date)}. Please complete payment to avoid service interruption.
                      </p>
                    </div>
                    <button
                      onClick={() => { setActiveSection('invoices'); handlePayInvoice(inv); }}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                    >
                      Pay Now
                    </button>
                  </div>
                );
              })}
              {upcomingInvoices.map((inv) => {
                const due = new Date(inv.due_date + 'T00:00:00');
                const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const balance = Number(inv.amount) - Number(inv.amount_paid);
                return (
                  <div key={inv.id} className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-800">
                        Invoice {inv.invoice_number} due {daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`}
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {formatCurrency(balance, inv.currency)} due {formatDate(inv.due_date)}. Pay early to avoid any disruption.
                      </p>
                    </div>
                    <button
                      onClick={() => { setActiveSection('invoices'); handlePayInvoice(inv); }}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                    >
                      Pay Now
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── BALANCE SUMMARY CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Total Paid */}
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5" style={{ background: '#355E3B', transform: 'translate(30%, -30%)' }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Paid</p>
            <p className="text-3xl font-semibold text-foreground">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground font-light mt-1">
              {succeededPayments.length} payment{succeededPayments.length !== 1 ? 's' : ''} confirmed
            </p>
          </div>

          {/* Consultation Deposit */}
          <div className={`rounded-2xl p-6 border relative overflow-hidden ${hasDeposit ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5" style={{ background: '#C8965A', transform: 'translate(30%, -30%)' }} />
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${hasDeposit ? 'bg-emerald-100' : 'bg-amber-50'}`}>
              {hasDeposit ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              )}
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Consultation Deposit</p>
            <p className={`text-3xl font-semibold ${hasDeposit ? 'text-emerald-700' : 'text-foreground'}`}>
              {formatCurrency(DEPOSIT_AMOUNT)}
            </p>
            {hasDeposit ? (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                ✓ Paid {depositPayment ? formatDateShort(depositPayment.created_at) : ''}
              </p>
            ) : (
              <button
                onClick={() => handleOpenPayment('consultation_deposit')}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-80"
                style={{ color: '#355E3B' }}
              >
                Pay now
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            )}
          </div>

          {/* Retainer Balance */}
          <div className={`rounded-2xl p-6 border relative overflow-hidden ${hasRetainer ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5" style={{ background: '#355E3B', transform: 'translate(30%, -30%)' }} />
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${hasRetainer ? 'bg-emerald-100' : 'bg-primary/8'}`}>
              {hasRetainer ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              )}
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Retainer Balance</p>
            <p className={`text-3xl font-semibold ${hasRetainer ? 'text-emerald-700' : 'text-foreground'}`}>
              {hasRetainer ? formatCurrency(0) : formatCurrency(retainerBalance)}
            </p>
            {hasRetainer ? (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                ✓ Retainer active {retainerPayment ? formatDateShort(retainerPayment.created_at) : ''}
              </p>
            ) : (
              <div className="mt-1">
                {hasDeposit && retainerApplied > 0 && (
                  <p className="text-xs text-muted-foreground font-light">
                    {formatCurrency(retainerApplied)} deposit applied
                  </p>
                )}
                <button
                  onClick={() => handleOpenPayment('retainer')}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-80"
                  style={{ color: '#355E3B' }}
                >
                  Pay retainer
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION TABS ── */}
        <div className="flex gap-1 mb-6 bg-muted/40 rounded-xl p-1 overflow-x-auto">
          {(['overview', 'history', 'invoices', 'timeline'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${
                activeSection === section
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {section === 'overview' && 'Payment Options'}
              {section === 'history' && `Payment History${payments.length > 0 ? ` (${payments.length})` : ''}`}
              {section === 'invoices' && `Invoices${invoices.length > 0 ? ` (${invoices.length})` : ''}`}
              {section === 'timeline' && `Upcoming Services${upcomingBookings.length > 0 ? ` (${upcomingBookings.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* ── PAYMENT OPTIONS SECTION ── */}
        {activeSection === 'overview' && (
          <div className="space-y-5">
            {/* Case context banner */}
            {inquiry && (
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.08)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">Linked Case</p>
                    <p className="text-sm font-semibold text-foreground">{inquiry.service}</p>
                    <p className="text-xs text-muted-foreground font-light">Submitted {formatDate(inquiry.created_at)}</p>
                  </div>
                </div>
                <Link
                  href="/portal/dashboard"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all self-start sm:self-auto"
                >
                  View Case
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </div>
            )}

            {/* Payment options */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-border/60">
                <h2 className="text-sm font-semibold text-foreground">Available Payments</h2>
                <p className="text-xs text-muted-foreground font-light mt-0.5">Select a payment type to proceed securely via Stripe.</p>
              </div>
              <div className="divide-y divide-border/60">
                {PAYMENT_OPTIONS.map((option) => {
                  const isPaid = succeededPayments.some((p) => p.payment_type === option.type);
                  return (
                    <div key={option.type} className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPaid ? 'bg-emerald-100' : 'bg-primary/8'}`}>
                          {isPaid ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-foreground">{option.label}</p>
                            {isPaid && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                                Paid
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-light leading-relaxed max-w-md">{option.description}</p>
                          {option.type === 'retainer' && hasDeposit && !hasRetainer && (
                            <p className="text-xs font-medium mt-1" style={{ color: '#355E3B' }}>
                              Your {formatCurrency(DEPOSIT_AMOUNT)} deposit will be applied — balance due: {formatCurrency(RETAINER_AMOUNT - DEPOSIT_AMOUNT)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-lg font-semibold" style={{ color: '#355E3B' }}>
                          {formatCurrency(option.amount)}
                        </p>
                        {!isPaid ? (
                          <button
                            onClick={() => handleOpenPayment(option.type)}
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                            style={{ background: '#355E3B', color: '#fff' }}
                          >
                            Pay Now
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest bg-emerald-50 border border-emerald-200 text-emerald-700">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Complete
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0 mt-0.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <div>
                <p className="text-xs font-semibold text-foreground">Secure payments powered by Stripe</p>
                <p className="text-xs text-muted-foreground font-light mt-0.5">
                  All transactions are encrypted with SSL. Your card details are never stored on our servers.
                  Receipts and invoices are available immediately after payment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENT HISTORY SECTION ── */}
        {activeSection === 'history' && (
          <div className="space-y-4">
            {downloadError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {downloadError}
              </div>
            )}

            {payments.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-foreground mb-2">No payments yet</h3>
                <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
                  Your payment history will appear here once you make your first payment.
                </p>
                <button
                  onClick={() => handleOpenPayment()}
                  className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  Make a Payment
                </button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Payment History</h2>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">{payments.length} transaction{payments.length !== 1 ? 's' : ''} total</p>
                  </div>
                  {totalPaid > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-light">Total paid</p>
                      <p className="text-base font-semibold" style={{ color: '#355E3B' }}>{formatCurrency(totalPaid)}</p>
                    </div>
                  )}
                </div>

                <div className="divide-y divide-border/60">
                  {payments.map((payment) => (
                    <div key={payment.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start gap-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          payment.payment_status === 'succeeded' ? 'bg-emerald-100' :
                          payment.payment_status === 'pending' ? 'bg-amber-50' : 'bg-red-50'
                        }`}>
                          {payment.payment_status === 'succeeded' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : payment.payment_status === 'pending' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{getPaymentTypeLabel(payment.payment_type)}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${getStatusBadge(payment.payment_status)}`}>
                              {getStatusLabel(payment.payment_status)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-light mt-0.5">{formatDate(payment.created_at)}</p>
                          {payment.description && (
                            <p className="text-xs text-muted-foreground font-light mt-0.5">{payment.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground/60 font-light mt-0.5 font-mono">
                            #{payment.payment_intent_id.slice(-8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 pl-13 sm:pl-0">
                        <p className="text-base font-semibold text-foreground">
                          {formatCurrency(Number(payment.amount), payment.currency)}
                        </p>
                        {payment.payment_status === 'succeeded' && (
                          <button
                            onClick={() => handleDownloadInvoice(payment)}
                            disabled={downloadingId === payment.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {downloadingId === payment.id ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                            )}
                            Invoice
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INVOICES SECTION ── */}
        {activeSection === 'invoices' && (
          <div className="space-y-4">
            {(payLinkError || downloadInvoiceError) && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {payLinkError || downloadInvoiceError}
              </div>
            )}
            {invoices.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-foreground mb-2">No invoices yet</h3>
                <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
                  Formal invoices will appear here once issued by Maggi May Broussard. Payment receipts are available in Payment History.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border/60">
                  <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
                  <p className="text-xs text-muted-foreground font-light mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} issued</p>
                </div>
                <div className="divide-y divide-border/60">
                  {invoices.map((invoice) => {
                    const balance = Number(invoice.amount) - Number(invoice.amount_paid);
                    return (
                      <div key={invoice.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-start gap-4">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            invoice.status === 'paid' ? 'bg-emerald-100' :
                            invoice.status === 'overdue' ? 'bg-red-50' : 'bg-amber-50'
                          }`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={
                              invoice.status === 'paid' ? 'text-emerald-600' :
                              invoice.status === 'overdue' ? 'text-red-500' : 'text-amber-600'
                            }>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground font-mono">{invoice.invoice_number}</p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${getStatusBadge(invoice.status)}`}>
                                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-light mt-0.5">
                              Issued {formatDateShort(invoice.invoice_date)} · Due {formatDateShort(invoice.due_date)}
                            </p>
                            {invoice.notes && (
                              <p className="text-xs text-muted-foreground font-light mt-0.5">{invoice.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                          <div className="text-right">
                            <p className="text-base font-semibold text-foreground">{formatCurrency(Number(invoice.amount), invoice.currency)}</p>
                            {balance > 0 && invoice.status !== 'paid' && (
                              <p className="text-xs text-red-600 font-medium">Balance: {formatCurrency(balance, invoice.currency)}</p>
                            )}
                            {invoice.status === 'paid' && (
                              <p className="text-xs text-emerald-600 font-medium">Paid in full</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDownloadClientInvoice(invoice)}
                            disabled={downloadingInvoiceId === invoice.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {downloadingInvoiceId === invoice.id ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                            )}
                            Download
                          </button>
                          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && balance > 0 && (
                            <button
                              onClick={() => handleOpenPayMethods(invoice)}
                              disabled={payingInvoiceId === invoice.id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                              style={{ background: '#355E3B', color: '#fff' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                              </svg>
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── UPCOMING SERVICES TIMELINE SECTION ── */}
      {activeSection === 'timeline' && (
        <section className="max-w-5xl mx-auto px-4 md:px-10 pb-10">
          <div className="space-y-4">
            {upcomingBookings.length === 0 && invoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled').length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <h3 className="font-serif text-xl text-foreground mb-2">No upcoming services</h3>
                <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
                  Your scheduled consultations and pending invoice due dates will appear here.
                </p>
              </div>
            ) : (
              <>
                {upcomingBookings.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/60">
                      <h2 className="text-sm font-semibold text-foreground">Scheduled Consultations</h2>
                      <p className="text-xs text-muted-foreground font-light mt-0.5">{upcomingBookings.length} upcoming appointment{upcomingBookings.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="divide-y divide-border/60">
                      {upcomingBookings.map((booking) => {
                        const daysUntil = Math.round((new Date(booking.start_time).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const isToday = daysUntil === 0;
                        const isSoon = daysUntil > 0 && daysUntil <= 3;
                        return (
                          <div key={booking.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start gap-4">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.08)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{booking.event_type || 'Consultation'}</p>
                                <p className="text-xs text-muted-foreground font-light mt-0.5">
                                  {new Date(booking.start_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-muted-foreground font-light">
                                  {new Date(booking.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  {booking.end_time && ` – ${new Date(booking.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                                isToday ? 'bg-amber-50 border-amber-200 text-amber-700' : isSoon ?'bg-amber-50 border-amber-200 text-amber-700': 'bg-secondary/40 border-border text-muted-foreground'
                              }`}>
                                {isToday ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${
                                booking.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                booking.status === 'canceled'? 'bg-red-50 text-red-700 border-red-200' : 'bg-primary/8 text-primary border-primary/20'
                              }`}>
                                {booking.status === 'active' ? 'Confirmed' : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {invoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled').length > 0 && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/60">
                      <h2 className="text-sm font-semibold text-foreground">Pending Invoice Due Dates</h2>
                      <p className="text-xs text-muted-foreground font-light mt-0.5">Outstanding invoices requiring payment</p>
                    </div>
                    <div className="divide-y divide-border/60">
                      {invoices
                        .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
                        .map((invoice) => {
                          const daysUntil = Math.round((new Date(invoice.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          const isOverdue = daysUntil < 0;
                          const isSoon = daysUntil >= 0 && daysUntil <= 7;
                          const balance = Number(invoice.amount) - Number(invoice.amount_paid);
                          return (
                            <div key={invoice.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex items-start gap-4">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50' : 'bg-amber-50'}`}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isOverdue ? 'text-red-500' : 'text-amber-600'}>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                  </svg>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-foreground font-mono">{invoice.invoice_number}</p>
                                    {isOverdue && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">Overdue</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground font-light mt-0.5">
                                    Due {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                  </p>
                                  {invoice.notes && <p className="text-xs text-muted-foreground font-light mt-0.5">{invoice.notes}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                  <p className="text-base font-semibold text-foreground">{formatCurrency(Number(invoice.amount), invoice.currency)}</p>
                                  {balance > 0 && (
                                    <p className="text-xs text-red-600 font-medium">Balance: {formatCurrency(balance, invoice.currency)}</p>
                                  )}
                                </div>
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                                  isOverdue ? 'bg-red-50 border-red-200 text-red-700' : isSoon ?'bg-amber-50 border-amber-200 text-amber-700': 'bg-secondary/40 border-border text-muted-foreground'
                                }`}>
                                  {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil}d left`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Payment Methods Modal */}
      {payMethodsOpen && payMethodsInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">Payment Options</h2>
                <p className="text-xs text-muted-foreground font-light mt-0.5">Invoice {payMethodsInvoice.invoice_number}</p>
              </div>
              <button
                onClick={() => { setPayMethodsOpen(false); setPayMethodsInvoice(null); }}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <PaymentMethodsPanel
                amount={Number(payMethodsInvoice.amount) - Number(payMethodsInvoice.amount_paid)}
                currency={payMethodsInvoice.currency || 'usd'}
                invoiceNumber={payMethodsInvoice.invoice_number}
                description={payMethodsInvoice.line_items?.[0]?.description}
                onStripeCard={() => {
                  setPayMethodsOpen(false);
                  handlePayInvoice(payMethodsInvoice);
                }}
                onACH={() => {
                  setPayMethodsOpen(false);
                  handlePayInvoiceACH(payMethodsInvoice);
                }}
                onPlan={() => {
                  setPayMethodsOpen(false);
                  handlePayInvoicePlan(payMethodsInvoice);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentOpen}
        onClose={handlePaymentClose}
        preselectedType={preselectedType}
        userEmail={user?.email ?? ''}
        userName={inquiry?.name ?? ''}
        userId={user?.id ?? null}
      />

      {/* ACH Payment Modal */}
      {achInvoice && (
        <ACHPaymentModal
          isOpen={achModalOpen}
          onClose={() => { setAchModalOpen(false); setAchInvoice(null); }}
          customerInfo={{
            userId: user?.id ?? null,
            firstName: (inquiry?.name ?? user?.email ?? '').split(' ')[0] ?? '',
            lastName: (inquiry?.name ?? '').split(' ').slice(1).join(' ') ?? '',
            email: user?.email ?? '',
            billing: { address_line_1: '', city: '', state: '', postal_code: '', country: 'US' },
          }}
          paymentConfig={{
            amount: Number(achInvoice.amount) - Number(achInvoice.amount_paid),
            currency: achInvoice.currency || 'usd',
            description: `Invoice ${achInvoice.invoice_number}`,
            tableName: 'payments',
            paymentType: 'invoice_ach',
            additionalFields: { invoice_id: achInvoice.id },
          }}
          onSuccess={() => { setAchModalOpen(false); setAchInvoice(null); fetchData(); }}
        />
      )}

      {/* Payment Plan Modal */}
      {planInvoice && (
        <PaymentPlanModal
          isOpen={planModalOpen}
          onClose={() => { setPlanModalOpen(false); setPlanInvoice(null); }}
          customerInfo={{
            userId: user?.id ?? null,
            firstName: (inquiry?.name ?? user?.email ?? '').split(' ')[0] ?? '',
            lastName: (inquiry?.name ?? '').split(' ').slice(1).join(' ') ?? '',
            email: user?.email ?? '',
          }}
          totalAmount={Number(planInvoice.amount) - Number(planInvoice.amount_paid)}
          currency={planInvoice.currency || 'usd'}
          description={`Invoice ${planInvoice.invoice_number}`}
          invoiceId={planInvoice.id}
          inquiryId={planInvoice.inquiry_id ?? null}
          onSuccess={() => { setPlanModalOpen(false); setPlanInvoice(null); fetchData(); }}
        />
      )}
    </div>
  );
}