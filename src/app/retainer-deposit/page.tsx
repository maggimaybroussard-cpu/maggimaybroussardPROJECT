'use client';

import React, { useState, useEffect, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from '@stripe/react-stripe-js';
import type { PaymentIntent } from '@stripe/stripe-js';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getStripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/client';

const DEPOSIT_AMOUNT = 250;
const DEPOSIT_LABEL = 'Consultation Retainer Deposit';

// ── Stripe payment form ───────────────────────────────────────────────────────
interface PaymentFormInnerProps {
  clientSecret: string;
  onSuccess: (pi: PaymentIntent) => void;
  onError: (msg: string) => void;
  clientName: string;
}

function PaymentFormInner({ clientSecret, onSuccess, onError, clientName }: PaymentFormInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/retainer-deposit/success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        const supabase = createClient();
        await supabase.functions.invoke('confirm-payment', {
          body: { paymentIntentId: paymentIntent.id, tableName: 'payments' },
        });
      } catch {
        // non-blocking
      }
      onSuccess(paymentIntent);
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Order summary */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ background: 'rgba(53,94,59,0.07)', border: '1px solid rgba(53,94,59,0.15)' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>
            {DEPOSIT_LABEL}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Applied toward your first invoice upon engagement</p>
        </div>
        <p className="text-xl font-semibold" style={{ color: '#355E3B' }}>
          ${DEPOSIT_AMOUNT} <span className="text-xs text-muted-foreground font-normal">USD</span>
        </p>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} />

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
        style={{ background: '#355E3B', color: '#fff' }}
      >
        {isProcessing ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Processing…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Pay ${DEPOSIT_AMOUNT} Deposit Securely
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe · SSL encrypted · Receipt emailed instantly
      </p>
    </form>
  );
}

// ── Inner page (uses useSearchParams) ─────────────────────────────────────────
function RetainerDepositInner() {
  const searchParams = useSearchParams();
  const clientName = searchParams.get('name') ?? '';
  const clientEmail = searchParams.get('email') ?? '';
  const eventName = searchParams.get('event') ?? 'Consultation';
  const startTime = searchParams.get('start') ?? '';
  const bookingId = searchParams.get('booking_id') ?? '';

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successIntent, setSuccessIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState('');
  const [formattedStart, setFormattedStart] = useState('');

  const stripePromise = getStripe();

  // Format start time client-side only to avoid hydration mismatch
  useEffect(() => {
    if (startTime) {
      try {
        setFormattedStart(
          new Date(startTime).toLocaleString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
          })
        );
      } catch {
        setFormattedStart(startTime);
      }
    }
  }, [startTime]);

  // Generate reference code after success
  useEffect(() => {
    if (successIntent) {
      setReferenceCode(`DEP-${successIntent.id.slice(-8).toUpperCase()}`);
    }
  }, [successIntent]);

  // Auto-create payment intent on mount if we have email
  useEffect(() => {
    if (!clientEmail) return;
    createDepositIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientEmail]);

  const createDepositIntent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/booking/create-deposit-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: 'consultation_deposit',
          clientName: clientName || 'Client',
          clientEmail,
          bookingId: bookingId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to initialize payment');
      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successIntent) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-20 px-4 md:px-8" style={{ background: '#FAF7F2' }}>
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col items-center text-center mb-10">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg"
                style={{ background: 'rgba(53,94,59,0.1)', border: '2px solid rgba(53,94,59,0.25)' }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                Deposit Received
              </p>
              <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                {clientName ? `Thank you, ${clientName.split(' ')[0]}!` : 'Deposit Confirmed!'}
              </h1>
              <p className="text-muted-foreground font-light leading-relaxed max-w-md">
                Your ${DEPOSIT_AMOUNT} deposit is confirmed. Your consultation is locked in and your engagement begins.
              </p>
            </div>

            {/* Confirmation card */}
            <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden mb-6">
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ background: 'rgba(53,94,59,0.05)', borderBottom: '1px solid rgba(53,94,59,0.1)' }}
              >
                <div>
                  <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Deposit Confirmation</p>
                  <p className="font-mono text-sm font-medium text-foreground mt-0.5">{referenceCode}</p>
                </div>
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
                >
                  ✓ Paid
                </span>
              </div>
              <div className="px-6 py-5 space-y-3">
                {[
                  { label: 'Client', value: clientName || '—' },
                  { label: 'Email', value: clientEmail || '—' },
                  { label: 'Consultation', value: eventName },
                  ...(formattedStart ? [{ label: 'Scheduled', value: formattedStart }] : []),
                  { label: 'Deposit Amount', value: `$${DEPOSIT_AMOUNT} USD` },
                  { label: 'Applied To', value: 'First invoice upon engagement' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next steps */}
            <div className="rounded-2xl border border-border bg-white shadow-sm p-6 mb-8">
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-4">What Happens Next</p>
              <div className="space-y-3">
                {[
                  { num: '01', text: 'Check your email for a payment receipt and consultation details.' },
                  { num: '02', text: 'Your deposit is applied toward your first invoice — no extra charge.' },
                  { num: '03', text: 'Expect a welcome message within 1 business day to prepare for your consultation.' },
                ].map(({ num, text }) => (
                  <div key={num} className="flex items-start gap-4">
                    <span
                      className="text-xs font-bold shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
                    >
                      {num}
                    </span>
                    <p className="text-sm text-foreground font-light leading-relaxed pt-0.5">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="flex-1 text-center py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-sm"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                Return Home
              </Link>
              <Link
                href="/portal/login"
                className="flex-1 text-center py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 border border-border hover:border-primary/40 text-foreground"
              >
                Client Portal
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Payment screen ─────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-20 px-4 md:px-8" style={{ background: '#FAF7F2' }}>
        <div className="max-w-5xl mx-auto">

          {/* Page header */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#C8965A' }}>
              Retainer Deposit · Step 2 of 2
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-3">
              Secure Your Engagement
            </h1>
            <p className="text-muted-foreground font-light leading-relaxed max-w-lg">
              A ${DEPOSIT_AMOUNT} deposit is required to confirm your consultation and begin the engagement. It is applied in full toward your first invoice.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">

            {/* Left: booking summary */}
            <div className="space-y-5">
              {/* Booking confirmation banner */}
              <div
                className="rounded-2xl p-6 border"
                style={{ background: 'rgba(53,94,59,0.04)', borderColor: 'rgba(53,94,59,0.15)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(53,94,59,0.12)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Booking Confirmed</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{eventName}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {clientName && (
                    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                      <span className="text-xs text-muted-foreground">Client</span>
                      <span className="text-sm font-medium text-foreground">{clientName}</span>
                    </div>
                  )}
                  {clientEmail && (
                    <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                      <span className="text-xs text-muted-foreground">Email</span>
                      <span className="text-sm font-medium text-foreground">{clientEmail}</span>
                    </div>
                  )}
                  {formattedStart && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-muted-foreground">Scheduled</span>
                      <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{formattedStart}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* What the deposit covers */}
              <div className="rounded-2xl border border-border bg-white p-6">
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-4">What Your Deposit Covers</p>
                <div className="space-y-3">
                  {[
                    { icon: '✓', text: 'Locks in your consultation time slot' },
                    { icon: '✓', text: 'Applied 100% toward your first invoice' },
                    { icon: '✓', text: 'Confirms engagement start — no extra charge' },
                    { icon: '✓', text: 'Triggers your onboarding welcome sequence' },
                    { icon: '✓', text: 'Receipt emailed instantly via Stripe' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-start gap-3">
                      <span className="text-xs font-bold shrink-0 mt-0.5" style={{ color: '#355E3B' }}>{icon}</span>
                      <p className="text-sm text-foreground font-light">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust signals */}
              <div
                className="rounded-xl px-5 py-4 flex items-start gap-3"
                style={{ background: 'rgba(200,150,90,0.08)', border: '1px solid rgba(200,150,90,0.25)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Fully Refundable</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If the engagement does not proceed, your deposit is refunded in full within 3–5 business days.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: payment form */}
            <div className="rounded-2xl border border-border bg-white shadow-sm p-6 md:p-8">
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-5">
                Secure Payment
              </p>

              {loading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <p className="text-sm text-muted-foreground">Preparing secure checkout…</p>
                </div>
              )}

              {error && !loading && (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-4 py-3 flex items-start gap-3"
                    style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                  <button
                    onClick={createDepositIntent}
                    className="w-full py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest border border-border hover:border-primary/40 transition-all duration-200"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!loading && !error && clientSecret && (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#355E3B',
                        colorBackground: '#ffffff',
                        borderRadius: '12px',
                        fontFamily: 'inherit',
                      },
                    },
                  }}
                >
                  <PaymentFormInner
                    clientSecret={clientSecret}
                    onSuccess={setSuccessIntent}
                    onError={setError}
                    clientName={clientName}
                  />
                </Elements>
              )}

              {!loading && !error && !clientSecret && !clientEmail && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">
                    This page requires a valid booking link. Please book a consultation first.
                  </p>
                  <Link
                    href="/book-consultation"
                    className="inline-block py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    Book a Consultation
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ── Page wrapper with Suspense ─────────────────────────────────────────────────
export default function RetainerDepositPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF7F2' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    }>
      <RetainerDepositInner />
    </Suspense>
  );
}
