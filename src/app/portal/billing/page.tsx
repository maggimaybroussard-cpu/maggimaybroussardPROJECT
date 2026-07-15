'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import PaymentModal, { PAYMENT_OPTIONS, PaymentType } from '@/components/PaymentModal';
import MakePaymentButton from '@/components/MakePaymentButton';
import { ACHPaymentModal, PaymentPlanModal } from '@/components/ACHPaymentComponents';
import PaymentMethodsPanel from '@/components/PaymentMethodsPanel';
import BillingPaymentStatusReader from './BillingPaymentStatusReader';
import { trackPortalBillingView, trackInvoicePaymentStart, trackInvoiceOverdue } from '@/lib/analytics';
import { Suspense } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Inquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
  booking_stage: string;
  created_at: string;
  calendly_start_time: string | null;
  calendly_event_name: string | null;
  calendly_meeting_location: string | null;
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
  stripe_invoice_id: string | null;
  stripe_invoice_url: string | null;
  stripe_sync_status: string | null;
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
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Retainer tier config ──────────────────────────────────────────────────────
const RETAINER_TIERS: Record<number, { label: string; hours: number }> = {
  750: { label: 'Essential', hours: 10 },
  1500: { label: 'Standard', hours: 20 },
  2800: { label: 'Full-Service', hours: 40 },
};

function getTierFromAmount(amount: number): { label: string; hours: number } | null {
  const amt = Math.round(Number(amount));
  return RETAINER_TIERS[amt] ?? null;
}

const SERVICE_COLORS = ['#355E3B', '#C8965A', '#4A6FA5', '#8B5E3C', '#6B7280', '#7C3AED', '#0891B2'];

function parseHoursFromDescription(desc: string): number | null {
  const match = desc.match(/(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|h)\b/i);
  return match ? parseFloat(match[1]) : null;
}

function inferServiceCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('research')) return 'Legal Research';
  if (d.includes('draft') || d.includes('writing') || d.includes('brief')) return 'Drafting & Writing';
  if (d.includes('review') || d.includes('document review')) return 'Document Review';
  if (d.includes('consult') || d.includes('consultation') || d.includes('meeting')) return 'Consultation';
  if (d.includes('filing') || d.includes('court') || d.includes('motion')) return 'Court Filings';
  if (d.includes('strategy') || d.includes('planning')) return 'Case Strategy';
  if (d.includes('communication') || d.includes('email') || d.includes('call')) return 'Communications';
  return 'General Services';
}

// ── Formatters ────────────────────────────────────────────────────────────────
function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getPaymentTypeLabel(type: string) {
  if (type === 'consultation_deposit') return 'Consultation Deposit';
  if (type === 'retainer') return 'Retainer Agreement';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusBadge(status: string) {
  if (status === 'succeeded' || status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'failed' || status === 'overdue') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function getStatusLabel(status: string) {
  if (status === 'succeeded') return 'Paid';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ── Nav icon helpers ──────────────────────────────────────────────────────────
const DashboardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const CasesIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const CardIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const SignOutIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const SpinnerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CALENDLY_URL = 'https://calendly.com/maggimaybroussard/30min';

// ── Consultation Booking Panel ────────────────────────────────────────────────
function ConsultationBookingPanel({ inquiry, user }: { inquiry: Inquiry | null; user: { email?: string | null; id: string } }) {
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [selectedType, setSelectedType] = useState<'consultation' | 'checkin'>('consultation');

  useEffect(() => {
    const existingScript = document.getElementById('calendly-script-billing');
    if (existingScript) { setEmbedLoaded(true); return; }
    const script = document.createElement('script');
    script.id = 'calendly-script-billing';
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => setEmbedLoaded(true);
    document.head.appendChild(script);
  }, []);

  const prefillParams = user
    ? `?name=${encodeURIComponent(inquiry?.name ?? user.email?.split('@')[0] ?? '')}&email=${encodeURIComponent(user.email ?? '')}`
    : '';

  const calendlyEmbedUrl = `${CALENDLY_URL}${prefillParams}`;

  return (
    <div className="space-y-5">
      {/* Upcoming booking notice */}
      {inquiry?.calendly_start_time && (
        <div className="p-4 rounded-xl border flex items-start gap-3" style={{ borderColor: 'rgba(53,94,59,0.25)', background: 'rgba(53,94,59,0.05)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#355E3B' }}>Upcoming Appointment</p>
            <p className="text-sm font-semibold text-foreground">{inquiry.calendly_event_name ?? '30 Minute Meeting'}</p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">{formatDateTime(inquiry.calendly_start_time)}</p>
            {inquiry.calendly_meeting_location && (
              <p className="text-xs text-muted-foreground font-light mt-0.5">📍 {inquiry.calendly_meeting_location}</p>
            )}
          </div>
        </div>
      )}

      {/* Appointment type selector */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Appointment Type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              type: 'consultation' as const,
              label: 'Initial Consultation',
              desc: 'First meeting to discuss your legal matter and explore options.',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              ),
            },
            {
              type: 'checkin' as const,
              label: 'Case Check-In',
              desc: 'Follow-up meeting to review progress and next steps.',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              ),
            },
          ].map(({ type, label, desc, icon }) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                selectedType === type
                  ? 'border-current' :'border-border hover:border-foreground/20'
              }`}
              style={selectedType === type ? { borderColor: 'rgba(53,94,59,0.5)', background: 'rgba(53,94,59,0.05)' } : {}}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedType === type ? '' : 'bg-muted/40'}`}
                style={selectedType === type ? { background: 'rgba(53,94,59,0.12)', color: '#355E3B' } : {}}>
                {icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground font-light mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* What to expect */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">What to Expect</p>
        <div className="space-y-2.5">
          {[
            { icon: '⏱', text: '30-minute video or phone session' },
            { icon: '📋', text: 'Review your case details and questions in advance' },
            { icon: '📧', text: 'Confirmation email with meeting link sent immediately' },
            { icon: '🔔', text: 'Reminder sent 24 hours before your appointment' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2.5">
              <span className="text-base">{item.icon}</span>
              <p className="text-xs text-muted-foreground font-light">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendly embed */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Select a Time</h3>
            <p className="text-xs text-muted-foreground font-light mt-0.5">Choose a date and time that works for you</p>
          </div>
          <a
            href={`${CALENDLY_URL}${prefillParams}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open in new tab
          </a>
        </div>
        {embedLoaded ? (
          <div
            className="calendly-inline-widget"
            data-url={calendlyEmbedUrl}
            style={{ minWidth: '320px', height: '630px' }}
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#355E3B' }} />
              <p className="text-xs text-muted-foreground">Loading calendar…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BillingPortalPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<RetainerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [preselectedType, setPreselectedType] = useState<PaymentType | undefined>(undefined);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payLinkError, setPayLinkError] = useState<string | null>(null);
  const [achModalOpen, setAchModalOpen] = useState(false);
  const [achInvoice, setAchInvoice] = useState<Invoice | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planInvoice, setPlanInvoice] = useState<Invoice | null>(null);
  const [payMethodsInvoice, setPayMethodsInvoice] = useState<Invoice | null>(null);
  const [payMethodsOpen, setPayMethodsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'retainer' | 'transactions' | 'invoices' | 'book'>('summary');
  const [liveFlash, setLiveFlash] = useState<string | null>(null);
  const [paymentSuccessBanner, setPaymentSuccessBanner] = useState<{ invoiceNumber: string } | null>(null);
  const [paymentCancelledBanner, setPaymentCancelledBanner] = useState(false);
  const [trackedInvoiceIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let inquiryId = accessData?.inquiry_id ?? null;

      const [paymentsRes, inquiryRes, invoicesRes, subRes] = await Promise.all([
        supabase.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        inquiryId
          ? supabase.from('contact_inquiries').select('id,name,email,service,status,booking_stage,created_at,calendly_start_time,calendly_event_name,calendly_meeting_location').eq('id', inquiryId).single()
          : Promise.resolve({ data: null, error: null }),
        inquiryId
          ? supabase.from('client_invoices').select('*,stripe_invoice_id,stripe_invoice_url,stripe_sync_status').eq('inquiry_id', inquiryId).order('created_at', { ascending: false })
          : supabase.from('client_invoices').select('*,stripe_invoice_id,stripe_invoice_url,stripe_sync_status').eq('user_id', user.id).order('created_at', { ascending: false }),
        inquiryId
          ? supabase.from('retainer_subscriptions').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }).limit(1).maybeSingle()
          : supabase.from('retainer_subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setPayments(paymentsRes.data || []);
      if (inquiryRes.data) setInquiry(inquiryRes.data);
      const fetchedInvoices = invoicesRes.data || [];
      setInvoices(fetchedInvoices);
      setSubscription(subRes.data ?? null);

      const outstandingCount = fetchedInvoices.filter(
        (inv: Invoice) => inv.status === 'sent' || inv.status === 'overdue'
      ).length;
      trackPortalBillingView(fetchedInvoices.length, outstandingCount);

      fetchedInvoices.forEach((inv: Invoice) => {
        if (inv.status === 'overdue') {
          trackInvoiceOverdue(inv.id, inv.invoice_number, inv.amount);
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
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
          .channel('billing-page-invoices-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'client_invoices', filter: inquiryId ? `inquiry_id=eq.${inquiryId}` : `user_id=eq.${user.id}` },
            (payload) => {
              const newRow = payload.new as Invoice & { status?: string };
              const oldRow = payload.old as Invoice & { status?: string };
              if (payload.eventType === 'INSERT') setLiveFlash('New invoice received');
              else if (payload.eventType === 'UPDATE' && newRow.status !== oldRow?.status) {
                if (newRow.status === 'paid') setLiveFlash('Invoice marked as paid ✓');
                else if (newRow.status === 'overdue') setLiveFlash('Invoice is now overdue');
                else setLiveFlash('Invoice updated');
              }
              fetchData();
            }
          ).subscribe();

        const paymentsChannel = supabase
          .channel('billing-page-payments-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` },
            (payload) => {
              const newRow = payload.new as Payment & { payment_status?: string };
              const oldRow = payload.old as Payment & { payment_status?: string };
              if (payload.eventType === 'INSERT') setLiveFlash('New payment recorded');
              else if (payload.eventType === 'UPDATE' && newRow.payment_status !== oldRow?.payment_status) {
                if (newRow.payment_status === 'succeeded') setLiveFlash('Payment confirmed ✓');
                else setLiveFlash('Payment status updated');
              }
              fetchData();
            }
          ).subscribe();

        return () => {
          supabase.removeChannel(invoiceChannel);
          supabase.removeChannel(paymentsChannel);
        };
      });
  }, [user, fetchData]);

  useEffect(() => {
    if (!liveFlash) return;
    const t = setTimeout(() => setLiveFlash(null), 5000);
    return () => clearTimeout(t);
  }, [liveFlash]);

  useEffect(() => {
    if (!paymentCancelledBanner) return;
    const t = setTimeout(() => setPaymentCancelledBanner(false), 4000);
    return () => clearTimeout(t);
  }, [paymentCancelledBanner]);

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
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : 'Could not download invoice.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    setPayingInvoiceId(invoice.id);
    setPayLinkError(null);
    trackInvoicePaymentStart(invoice.id, invoice.invoice_number, invoice.amount);
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
          successPath: `/portal/billing?payment=success&invoice=${invoice.invoice_number}`,
          cancelPath: `/portal/billing?payment=cancelled`,
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

  // ── Derived: retainer data ────────────────────────────────────────────────
  const succeededPayments = payments.filter((p) => p.payment_status === 'succeeded');
  const totalPaid = succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const retainerPayments = succeededPayments.filter((p) => p.payment_type === 'retainer');
  const depositPayments = succeededPayments.filter((p) => p.payment_type === 'consultation_deposit');
  const hasRetainer = retainerPayments.length > 0;
  const hasDeposit = depositPayments.length > 0;

  const purchasedHours = retainerPayments.reduce((sum, p) => {
    const tier = getTierFromAmount(p.amount);
    return sum + (tier?.hours ?? 0);
  }, 0);
  const totalRetainerPaid = retainerPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const serviceMap: Record<string, { hours: number; amount: number }> = {};
  invoices.forEach((inv) => {
    if (!Array.isArray(inv.line_items)) return;
    inv.line_items.forEach((item) => {
      const hrs = parseHoursFromDescription(item.description);
      const category = inferServiceCategory(item.description);
      if (!serviceMap[category]) serviceMap[category] = { hours: 0, amount: 0 };
      if (hrs !== null) serviceMap[category].hours += hrs * (item.quantity || 1);
      serviceMap[category].amount += Number(item.total || 0);
    });
  });

  const serviceBreakdown = Object.entries(serviceMap)
    .map(([service, data], idx) => ({ service, hours: data.hours, amount: data.amount, color: SERVICE_COLORS[idx % SERVICE_COLORS.length] }))
    .filter((s) => s.hours > 0 || s.amount > 0)
    .sort((a, b) => b.hours - a.hours);

  const usedHours = serviceBreakdown.reduce((sum, s) => sum + s.hours, 0);
  const remainingHours = Math.max(0, purchasedHours - usedHours);
  const usedPercent = purchasedHours > 0 ? Math.min(100, (usedHours / purchasedHours) * 100) : 0;
  const hourlyRate = purchasedHours > 0 ? totalRetainerPaid / purchasedHours : 0;
  const remainingValue = remainingHours * hourlyRate;
  const latestRetainer = retainerPayments[0];
  const currentTier = latestRetainer ? getTierFromAmount(latestRetainer.amount) : null;
  const isLowBalance = purchasedHours > 0 && remainingHours <= purchasedHours * 0.25;

  // ── Outstanding invoice totals ────────────────────────────────────────────
  const outstandingInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0);
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalInvoicePaid = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);

  // ── Loading skeleton ──────────────────────────────────────────────────────
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
          <div className="grid sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 h-28 animate-pulse" />
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 h-64 animate-pulse" />
          <div className="bg-card border border-border rounded-2xl p-6 h-48 animate-pulse" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <BillingPaymentStatusReader
          onSuccess={(invoiceNumber) => {
            setPaymentSuccessBanner({ invoiceNumber });
            setActiveTab('invoices');
            fetchData();
          }}
          onCancelled={() => setPaymentCancelledBanner(true)}
        />
      </Suspense>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200">
                <DashboardIcon /><span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link href="/portal/cases" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200">
                <CasesIcon /><span className="hidden sm:inline">Cases</span>
              </Link>
              <Link href="/portal/retainer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200">
                <ClockIcon /><span className="hidden sm:inline">Retainer</span>
              </Link>
              <Link href="/portal/billing" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold uppercase tracking-widest transition-all duration-200" style={{ borderColor: 'rgba(53,94,59,0.5)', color: '#355E3B', background: 'rgba(53,94,59,0.07)' }}>
                <CardIcon /><span className="hidden sm:inline">Billing</span>
              </Link>
              <button
                onClick={() => handleOpenPayment()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                <CardIcon /><span className="hidden sm:inline">Make Payment</span><span className="sm:hidden">Pay</span>
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? <SpinnerIcon /> : <SignOutIcon />}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-10 py-8 md:py-10">
        {/* ── Page heading ── */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Portal</p>
          <h1 className="font-serif text-4xl text-foreground">Billing &amp; Payments</h1>
          {inquiry && (
            <p className="text-sm text-muted-foreground font-light mt-1">
              Linked to: <span className="font-medium text-foreground">{inquiry.service}</span>
              <span className="mx-2 text-border">·</span>
              <span>Since {formatDateShort(inquiry.created_at)}</span>
            </p>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Payment success banner ── */}
        {paymentSuccessBanner && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Payment successful!</p>
                <p className="text-xs text-emerald-700 font-light">Invoice {paymentSuccessBanner.invoiceNumber} has been paid. Your account will update shortly.</p>
              </div>
            </div>
            <button onClick={() => setPaymentSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-800 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* ── Payment cancelled banner ── */}
        {paymentCancelledBanner && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm text-amber-800">Payment was cancelled. Your invoice is still open — you can pay it any time.</p>
            </div>
            <button onClick={() => setPaymentCancelledBanner(false)} className="text-amber-600 hover:text-amber-800 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* ── Live status flash ── */}
        {liveFlash && (
          <div className="mb-6 p-3 rounded-xl bg-card border border-border flex items-center gap-2.5 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <p className="text-xs font-semibold text-foreground">{liveFlash}</p>
            <span className="text-xs text-muted-foreground font-light ml-auto">Live update</span>
          </div>
        )}

        {/* ── Low balance warning ── */}
        {isLowBalance && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Retainer balance running low</p>
              <p className="text-xs text-amber-700 font-light mt-0.5">
                You have {remainingHours.toFixed(1)} hours remaining ({formatCurrency(remainingValue)}). Consider adding more hours to avoid service interruption.
              </p>
            </div>
            <button
              onClick={() => handleOpenPayment('retainer')}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest bg-amber-700 text-white hover:bg-amber-800 transition-colors"
            >
              Add Hours
            </button>
          </div>
        )}

        {/* ── Overdue invoice alert ── */}
        {overdueInvoices.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                {overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-700 font-light mt-0.5">
                {formatCurrency(overdueInvoices.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0))} past due — please pay to avoid service interruption.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('invoices')}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              View
            </button>
          </div>
        )}

        {/* ── Make Payment Button (Stripe) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 p-6 bg-card border border-border rounded-2xl">
          <div>
            <h2 className="text-base font-semibold text-foreground">Secure Online Payment</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pay invoices, deposits, or retainer fees securely via Stripe. Funds are deposited directly to Broussard Legal Services.
            </p>
          </div>
          <div className="shrink-0">
            <MakePaymentButton
              amount={outstandingTotal > 0 ? outstandingTotal : 0}
              description={outstandingTotal > 0 ? `Outstanding balance — ${outstandingInvoices.length} invoice${outstandingInvoices.length !== 1 ? 's' : ''}` : 'Legal Services Payment'}
              customerName={inquiry?.name ?? ''}
              customerEmail={user?.email ?? ''}
              paymentType="portal_payment"
              showCardLogos={true}
            />
          </div>
        </div>

        {/* ── Enhanced Summary stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#355E3B', transform: 'translate(30%,-30%)' }} />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Total Paid</p>
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">{succeededPayments.length} transaction{succeededPayments.length !== 1 ? 's' : ''}</p>
          </div>

          <div className={`rounded-2xl p-5 border relative overflow-hidden ${hasRetainer ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#C8965A', transform: 'translate(30%,-30%)' }} />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Retainer Paid</p>
            <p className={`text-2xl font-semibold ${hasRetainer ? 'text-emerald-700' : 'text-foreground'}`}>{formatCurrency(totalRetainerPaid)}</p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">
              {hasRetainer ? `${retainerPayments.length} payment${retainerPayments.length !== 1 ? 's' : ''}` : 'No retainer yet'}
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#4A6FA5', transform: 'translate(30%,-30%)' }} />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Hours Remaining</p>
            <p className={`text-2xl font-semibold ${isLowBalance ? 'text-amber-600' : 'text-foreground'}`}>
              {purchasedHours > 0 ? `${remainingHours.toFixed(1)}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">
              {purchasedHours > 0 ? `of ${purchasedHours} purchased` : 'No retainer active'}
            </p>
          </div>

          <div className={`rounded-2xl p-5 border relative overflow-hidden ${outstandingInvoices.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5" style={{ background: '#8B5E3C', transform: 'translate(30%,-30%)' }} />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Open Invoices</p>
            <p className={`text-2xl font-semibold ${outstandingInvoices.length > 0 ? 'text-amber-700' : 'text-foreground'}`}>
              {outstandingInvoices.length}
            </p>
            <p className="text-xs text-muted-foreground font-light mt-0.5">
              {outstandingTotal > 0 ? `${formatCurrency(outstandingTotal)} due` : 'All clear'}
            </p>
          </div>
        </div>

        {/* ── Enhanced secondary stats ── */}
        {invoices.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Invoiced</p>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(totalInvoiced)}</p>
              <p className="text-xs text-muted-foreground font-light mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Invoice Paid</p>
              <p className="text-lg font-semibold text-emerald-700">{formatCurrency(totalInvoicePaid)}</p>
              <p className="text-xs text-muted-foreground font-light mt-0.5">{paidInvoices.length} paid</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Overdue</p>
              <p className={`text-lg font-semibold ${overdueInvoices.length > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {overdueInvoices.length > 0 ? formatCurrency(overdueInvoices.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0)) : '$0'}
              </p>
              <p className="text-xs text-muted-foreground font-light mt-0.5">{overdueInvoices.length} overdue</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Collection Rate</p>
              <p className="text-lg font-semibold text-foreground">
                {totalInvoiced > 0 ? `${((totalInvoicePaid / totalInvoiced) * 100).toFixed(0)}%` : '—'}
              </p>
              <p className="text-xs text-muted-foreground font-light mt-0.5">of total invoiced</p>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 bg-muted/40 rounded-xl p-1 overflow-x-auto">
          {([
            { id: 'summary', label: 'Billing Summary' },
            { id: 'retainer', label: `Retainer${purchasedHours > 0 ? ` (${purchasedHours}h)` : ''}` },
            { id: 'transactions', label: `Transactions${payments.length > 0 ? ` (${payments.length})` : ''}` },
            { id: 'invoices', label: `Invoices${invoices.length > 0 ? ` (${invoices.length})` : ''}` },
            { id: 'book', label: '📅 Book Consultation' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: BILLING SUMMARY
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            {/* Retainer status card */}
            {hasRetainer && currentTier ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-border/60 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Active Retainer — {currentTier.label} Plan</h2>
                      <p className="text-xs text-muted-foreground font-light mt-0.5">
                        {currentTier.hours} hours · {formatCurrency(hourlyRate)}/hr effective rate
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B', background: 'rgba(53,94,59,0.07)' }}>
                    Active
                  </span>
                </div>
                <div className="p-6">
                  <div className="mb-5">
                    <div className="flex justify-between text-xs text-muted-foreground font-light mb-2">
                      <span>{usedHours.toFixed(1)} hrs used</span>
                      <span>{purchasedHours} hrs total</span>
                    </div>
                    <div className="h-3 bg-muted/30 rounded-full overflow-hidden flex">
                      {serviceBreakdown.map((s) => {
                        const pct = purchasedHours > 0 ? (s.hours / purchasedHours) * 100 : 0;
                        return pct > 0 ? (
                          <div key={s.service} className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} title={`${s.service}: ${s.hours.toFixed(1)} hrs`} />
                        ) : null;
                      })}
                      {(100 - usedPercent) > 0 && (
                        <div className="h-full" style={{ width: `${100 - usedPercent}%`, background: 'var(--muted)', opacity: 0.4 }} />
                      )}
                    </div>
                    <div className="flex justify-between text-xs mt-1.5">
                      <span className="text-muted-foreground font-light">{usedPercent.toFixed(0)}% consumed</span>
                      <span className={`font-medium ${isLowBalance ? 'text-amber-600' : 'text-foreground'}`}>
                        {remainingHours.toFixed(1)} hrs remaining ({formatCurrency(remainingValue)})
                      </span>
                    </div>
                  </div>

                  {serviceBreakdown.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {serviceBreakdown.map((s) => (
                        <div key={s.service} className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/50">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{s.service}</p>
                            <p className="text-xs text-muted-foreground font-light">{s.hours.toFixed(1)} hrs · {formatCurrency(s.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {serviceBreakdown.length === 0 && (
                    <p className="text-xs text-muted-foreground font-light text-center py-4">No usage logged yet. Hours will appear as invoices are issued.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.08)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No active retainer</p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">Purchase a retainer plan to get dedicated hours for your legal needs.</p>
                  </div>
                </div>
                <Link href="/retainer-payment" className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity" style={{ background: '#355E3B', color: '#fff' }}>
                  View Plans
                </Link>
              </div>
            )}

            {/* Payment Status */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">Payment Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasDeposit ? 'bg-emerald-100' : 'bg-muted/40'}`}>
                      {hasDeposit ? <CheckIcon /> : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Consultation Deposit</p>
                      {hasDeposit && depositPayments[0] && (
                        <p className="text-xs text-muted-foreground font-light">Paid {formatDateShort(depositPayments[0].created_at)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground">$150</p>
                    {hasDeposit ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">Paid</span>
                    ) : (
                      <button onClick={() => handleOpenPayment('consultation_deposit')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity" style={{ background: '#355E3B', color: '#fff' }}>
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>

                {retainerPayments.map((rp) => (
                  <div key={rp.id} className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-100">
                        <CheckIcon />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Retainer — {getTierFromAmount(rp.amount)?.label ?? 'Custom'} Plan
                        </p>
                        <p className="text-xs text-muted-foreground font-light">
                          Paid {formatDateShort(rp.created_at)} · {getTierFromAmount(rp.amount)?.hours ?? '?'} hrs
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(rp.amount))}</p>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">Paid</span>
                    </div>
                  </div>
                ))}

                {!hasRetainer && (
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/40">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Retainer Agreement</p>
                        <p className="text-xs text-muted-foreground font-light">
                          {hasDeposit ? `$150 deposit will be applied — balance: $1,350` : 'Starting from $750'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleOpenPayment('retainer')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity" style={{ background: '#355E3B', color: '#fff' }}>
                      Pay Retainer
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Book consultation CTA */}
            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.08)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {inquiry?.calendly_start_time ? 'Upcoming Consultation' : 'Book a Consultation'}
                  </p>
                  <p className="text-xs text-muted-foreground font-light mt-0.5">
                    {inquiry?.calendly_start_time
                      ? `${inquiry.calendly_event_name ?? '30 Minute Meeting'} · ${formatDateShort(inquiry.calendly_start_time)}`
                      : 'Schedule a 30-minute session with Maggi May Broussard'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('book')}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                <CalendarIcon />
                {inquiry?.calendly_start_time ? 'Book Another' : 'Book Now'}
              </button>
            </div>

            {/* Recent transactions preview */}
            {succeededPayments.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Recent Transactions</h2>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">Last {Math.min(3, succeededPayments.length)} payments</p>
                  </div>
                  <button onClick={() => setActiveTab('transactions')} className="text-xs font-semibold uppercase tracking-widest transition-colors hover:opacity-80" style={{ color: '#355E3B' }}>
                    View All →
                  </button>
                </div>
                <div className="divide-y divide-border/60">
                  {succeededPayments.slice(0, 3).map((payment) => (
                    <div key={payment.id} className="px-6 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <CheckIcon />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{getPaymentTypeLabel(payment.payment_type)}</p>
                          <p className="text-xs text-muted-foreground font-light">{formatDateShort(payment.created_at)}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(payment.amount), payment.currency)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security note */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0 mt-0.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <div>
                <p className="text-xs font-semibold text-foreground">Secure payments powered by Stripe</p>
                <p className="text-xs text-muted-foreground font-light mt-0.5">All transactions are encrypted with SSL. Your card details are never stored on our servers. Receipts and invoices are available immediately after payment.</p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: RETAINER USAGE
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'retainer' && (
          <div className="space-y-5">
            {purchasedHours === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(53,94,59,0.08)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <h2 className="font-serif text-2xl text-foreground mb-2">No retainer on file</h2>
                <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto mb-6">Purchase a retainer package to start tracking your dedicated hours.</p>
                <Link href="/retainer-payment" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity" style={{ background: '#355E3B', color: '#fff' }}>
                  View Retainer Plans
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-card border border-border rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.08) 0%, rgba(53,94,59,0.02) 100%)' }}>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Purchased</p>
                    <p className="text-3xl font-semibold text-foreground">{purchasedHours}</p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">hours total</p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Used</p>
                    <p className="text-3xl font-semibold text-foreground">{usedHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">{usedPercent.toFixed(0)}% consumed</p>
                  </div>
                  <div className="bg-card border rounded-2xl p-5" style={{ borderColor: isLowBalance ? 'rgba(220,38,38,0.3)' : 'var(--border)', background: isLowBalance ? 'rgba(220,38,38,0.04)' : undefined }}>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Remaining</p>
                    <p className="text-3xl font-semibold" style={{ color: isLowBalance ? '#DC2626' : 'var(--foreground)' }}>{remainingHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">{isLowBalance ? '⚠ Low balance' : 'hours left'}</p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Balance Value</p>
                    <p className="text-2xl font-semibold text-foreground">{formatCurrency(remainingValue)}</p>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">{hourlyRate > 0 ? `${formatCurrency(hourlyRate)}/hr` : 'estimated'}</p>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#355E3B' }}>
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-foreground">Retainer Consumption</p>
                    </div>
                    {currentTier && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: 'rgba(53,94,59,0.3)', color: '#355E3B', background: 'rgba(53,94,59,0.07)' }}>
                        {currentTier.label} Plan
                      </span>
                    )}
                  </div>

                  <div className="mb-5">
                    <div className="flex justify-between text-xs text-muted-foreground font-light mb-2">
                      <span>{usedHours.toFixed(1)} hrs used</span>
                      <span>{purchasedHours} hrs purchased</span>
                    </div>
                    <div className="h-5 bg-muted/30 rounded-full overflow-hidden flex">
                      {serviceBreakdown.map((s) => {
                        const pct = purchasedHours > 0 ? (s.hours / purchasedHours) * 100 : 0;
                        return pct > 0 ? (
                          <div key={s.service} className="h-full transition-all duration-700 first:rounded-l-full" style={{ width: `${pct}%`, background: s.color }} title={`${s.service}: ${s.hours.toFixed(1)} hrs`} />
                        ) : null;
                      })}
                      {(100 - usedPercent) > 0 && (
                        <div className="h-full rounded-r-full" style={{ width: `${100 - usedPercent}%`, background: 'var(--muted)', opacity: 0.4 }} />
                      )}
                    </div>
                    <div className="flex justify-between text-xs mt-2">
                      <span className="flex items-center gap-1 text-muted-foreground font-light">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#355E3B' }} />
                        Used ({usedPercent.toFixed(0)}%)
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground font-light">
                        <span className="w-2 h-2 rounded-full inline-block bg-muted opacity-60" />
                        Remaining ({(100 - usedPercent).toFixed(0)}%)
                      </span>
                    </div>
                  </div>

                  {serviceBreakdown.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-border/60">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Breakdown by Service Type</p>
                      {serviceBreakdown.map((s) => {
                        const pct = purchasedHours > 0 ? (s.hours / purchasedHours) * 100 : 0;
                        return (
                          <div key={s.service}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                                <span className="text-xs font-semibold text-foreground">{s.service}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground font-light">
                                <span>{s.hours.toFixed(1)} hrs</span>
                                <span>{formatCurrency(s.amount)}</span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/60">
                    <h2 className="text-sm font-semibold text-foreground">Retainer Charges</h2>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">All retainer payments on your account</p>
                  </div>
                  <div className="divide-y divide-border/60">
                    {retainerPayments.map((rp) => {
                      const tier = getTierFromAmount(rp.amount);
                      return (
                        <div key={rp.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100">
                              <CheckIcon />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-foreground">Retainer — {tier?.label ?? 'Custom'} Plan</p>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">Paid</span>
                              </div>
                              <p className="text-xs text-muted-foreground font-light mt-0.5">{formatDate(rp.created_at)}</p>
                              {tier && <p className="text-xs text-muted-foreground font-light">{tier.hours} hours · {formatCurrency(Number(rp.amount) / tier.hours)}/hr</p>}
                              <p className="text-xs text-muted-foreground/60 font-light mt-0.5 font-mono">#{rp.payment_intent_id.slice(-8).toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <p className="text-base font-semibold text-foreground">{formatCurrency(Number(rp.amount), rp.currency)}</p>
                            <button
                              onClick={() => handleDownloadInvoice(rp)}
                              disabled={downloadingId === rp.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60"
                            >
                              {downloadingId === rp.id ? <SpinnerIcon /> : <DownloadIcon />}
                              Receipt
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {retainerPayments.length === 0 && (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm text-muted-foreground font-light">No retainer charges yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {invoices.some((inv) => Array.isArray(inv.line_items) && inv.line_items.length > 0) && (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/60">
                      <h2 className="text-sm font-semibold text-foreground">Usage Detail Log</h2>
                      <p className="text-xs text-muted-foreground font-light mt-0.5">Itemized breakdown from all issued invoices</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/20">
                            <th className="px-6 py-3 text-left font-semibold uppercase tracking-widest text-muted-foreground">Description</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-widest text-muted-foreground">Qty</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-widest text-muted-foreground">Rate</th>
                            <th className="px-4 py-3 text-right font-semibold uppercase tracking-widest text-muted-foreground">Hours</th>
                            <th className="px-6 py-3 text-right font-semibold uppercase tracking-widest text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {invoices.flatMap((inv) =>
                            (inv.line_items || []).map((item, idx) => {
                              const hrs = parseHoursFromDescription(item.description);
                              return (
                                <tr key={`${inv.id}-${idx}`} className="hover:bg-muted/10 transition-colors">
                                  <td className="px-6 py-3.5">
                                    <p className="font-medium text-foreground">{item.description}</p>
                                    <p className="text-muted-foreground font-light mt-0.5">{inv.invoice_number} · {formatDateShort(inv.invoice_date)}</p>
                                  </td>
                                  <td className="px-4 py-3.5 text-right text-muted-foreground">{item.quantity}</td>
                                  <td className="px-4 py-3.5 text-right text-muted-foreground">{formatCurrency(item.unit_price)}</td>
                                  <td className="px-4 py-3.5 text-right">
                                    {hrs !== null ? (
                                      <span className="font-medium text-foreground">{(hrs * item.quantity).toFixed(1)}</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-3.5 text-right font-semibold text-foreground">{formatCurrency(item.total)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: TRANSACTIONS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'transactions' && (
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
                <h3 className="font-serif text-xl text-foreground mb-2">No transactions yet</h3>
                <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">Your payment history will appear here once you make your first payment.</p>
                <button onClick={() => handleOpenPayment()} className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity" style={{ background: '#355E3B', color: '#fff' }}>
                  Make a Payment
                </button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Transaction History</h2>
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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : payment.payment_status === 'pending' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
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
                          {payment.description && <p className="text-xs text-muted-foreground font-light mt-0.5">{payment.description}</p>}
                          <p className="text-xs text-muted-foreground/60 font-light mt-0.5 font-mono">#{payment.payment_intent_id.slice(-8).toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-base font-semibold text-foreground">{formatCurrency(Number(payment.amount), payment.currency)}</p>
                        {payment.payment_status === 'succeeded' && (
                          <button
                            onClick={() => handleDownloadInvoice(payment)}
                            disabled={downloadingId === payment.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {downloadingId === payment.id ? <SpinnerIcon /> : <DownloadIcon />}
                            Receipt
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

        {/* ══════════════════════════════════════════════════════════════════
            TAB: INVOICES
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {payLinkError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {payLinkError}
              </div>
            )}

            {/* Invoice summary strip */}
            {invoices.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Invoiced', value: formatCurrency(totalInvoiced), color: 'text-foreground' },
                  { label: 'Paid', value: formatCurrency(totalInvoicePaid), color: 'text-emerald-700' },
                  { label: 'Outstanding', value: formatCurrency(outstandingTotal), color: outstandingTotal > 0 ? 'text-amber-600' : 'text-foreground' },
                  { label: 'Overdue', value: formatCurrency(overdueInvoices.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid)), 0)), color: overdueInvoices.length > 0 ? 'text-red-600' : 'text-foreground' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{stat.label}</p>
                    <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
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
                <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">Formal invoices will appear here once issued. Payment receipts are available in the Transactions tab.</p>
              </div>
            ) : (
              <>
                {outstandingInvoices.length > 0 && (
                  <div className="bg-card border border-amber-200 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-amber-200 bg-amber-50/50">
                      <h2 className="text-sm font-semibold text-foreground">Outstanding Invoices</h2>
                      <p className="text-xs text-muted-foreground font-light mt-0.5">
                        {outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? 's' : ''} requiring payment · {formatCurrency(outstandingTotal)} total due
                      </p>
                    </div>
                    <div className="divide-y divide-border/60">
                      {outstandingInvoices.map((invoice) => {
                        const balance = Number(invoice.amount) - Number(invoice.amount_paid);
                        const daysUntil = Math.round((new Date(invoice.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const isOverdue = daysUntil < 0;
                        const hasStripeLink = !!invoice.stripe_invoice_url && invoice.stripe_sync_status === 'synced';
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
                                  {isOverdue && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">Overdue</span>}
                                  {!isOverdue && daysUntil <= 7 && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">Due in {daysUntil}d</span>}
                                  {hasStripeLink && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-semibold">
                                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                      Stripe Invoice
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground font-light mt-0.5">
                                  Issued {formatDateShort(invoice.invoice_date)} · Due {formatDateShort(invoice.due_date)}
                                </p>
                                {invoice.notes && <p className="text-xs text-muted-foreground font-light mt-0.5">{invoice.notes}</p>}
                                {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 && (
                                  <p className="text-xs text-muted-foreground font-light mt-0.5">{invoice.line_items[0].description}{invoice.line_items.length > 1 ? ` +${invoice.line_items.length - 1} more` : ''}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                              <div className="text-right">
                                <p className="text-base font-semibold text-foreground">{formatCurrency(Number(invoice.amount), invoice.currency)}</p>
                                {balance > 0 && <p className="text-xs text-red-600 font-medium">Balance: {formatCurrency(balance, invoice.currency)}</p>}
                              </div>
                              {hasStripeLink ? (
                                <a href={invoice.stripe_invoice_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90" style={{ background: '#5851D8', color: '#fff' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                  Pay via Stripe
                                </a>
                              ) : (
                                <button onClick={() => handleOpenPayMethods(invoice)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90" style={{ background: '#355E3B', color: '#fff' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
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

                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/60">
                    <h2 className="text-sm font-semibold text-foreground">All Invoices</h2>
                    <p className="text-xs text-muted-foreground font-light mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} issued</p>
                  </div>
                  <div className="divide-y divide-border/60">
                    {invoices.map((invoice) => {
                      const balance = Number(invoice.amount) - Number(invoice.amount_paid);
                      const hasStripeLink = !!invoice.stripe_invoice_url && invoice.stripe_sync_status === 'synced';
                      return (
                        <div key={invoice.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-start gap-4">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${invoice.status === 'paid' ? 'bg-emerald-100' : invoice.status === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={invoice.status === 'paid' ? 'text-emerald-600' : invoice.status === 'overdue' ? 'text-red-500' : 'text-amber-600'}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                              </svg>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-foreground font-mono">{invoice.invoice_number}</p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${getStatusBadge(invoice.status)}`}>
                                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                </span>
                                {hasStripeLink && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-semibold">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    Stripe
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-light mt-0.5">
                                Issued {formatDateShort(invoice.invoice_date)} · Due {formatDateShort(invoice.due_date)}
                              </p>
                              {invoice.notes && <p className="text-xs text-muted-foreground font-light mt-0.5">{invoice.notes}</p>}
                              {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 && (
                                <p className="text-xs text-muted-foreground font-light mt-0.5">{invoice.line_items[0].description}{invoice.line_items.length > 1 ? ` +${invoice.line_items.length - 1} more` : ''}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                            <div className="text-right">
                              <p className="text-base font-semibold text-foreground">{formatCurrency(Number(invoice.amount), invoice.currency)}</p>
                              {balance > 0 && invoice.status !== 'paid' ? (
                                <p className="text-xs text-red-600 font-medium">Balance: {formatCurrency(balance, invoice.currency)}</p>
                              ) : invoice.status === 'paid' ? (
                                <p className="text-xs text-emerald-600 font-medium">Paid in full</p>
                              ) : null}
                            </div>
                            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && balance > 0 && (
                              hasStripeLink ? (
                                <a href={invoice.stripe_invoice_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90" style={{ background: '#5851D8', color: '#fff' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                  Pay via Stripe
                                </a>
                              ) : (
                                <button onClick={() => handleOpenPayMethods(invoice)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90" style={{ background: '#355E3B', color: '#fff' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                  Pay
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: BOOK CONSULTATION
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'book' && user && (
          <ConsultationBookingPanel inquiry={inquiry} user={user} />
        )}
      </main>

      {/* Payment Methods Modal */}
      {payMethodsOpen && payMethodsInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
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
            {/* Body */}
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
