'use client';

import React, { useState, FormEvent, useMemo } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/client';
import {
  trackConsultationDepositInitiated,
  trackConsultationDepositPaid,
  getTrafficAttribution,
} from '@/lib/analytics';

const DEPOSIT_AMOUNT = 150;

interface DepositFormInnerProps {
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}

function DepositFormInner({ onSuccess, onError }: DepositFormInnerProps) {
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
        return_url: `${window.location.origin}/payment-confirmation`,
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
        // Non-fatal
      }
      onSuccess(paymentIntent.id);
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: '#355E3B', color: '#fff' }}
      >
        {isProcessing ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Processing…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            Pay ${DEPOSIT_AMOUNT} Deposit
          </>
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe · SSL encrypted
      </p>
    </form>
  );
}

interface ConsultationDepositFieldProps {
  clientName?: string;
  clientEmail?: string;
  inquiryId?: string;
  bookingId?: string;
  onDepositPaid?: (paymentIntentId: string) => void;
}

type DepositState = 'idle' | 'collecting-info' | 'loading' | 'payment' | 'success' | 'error';

export default function ConsultationDepositField({
  clientName: propName = '',
  clientEmail: propEmail = '',
  inquiryId,
  bookingId,
  onDepositPaid,
}: ConsultationDepositFieldProps) {
  const [state, setState] = useState<DepositState>('idle');
  const [name, setName] = useState(propName);
  const [email, setEmail] = useState(propEmail);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  const stripePromise = React.useMemo(() => clientSecret ? getStripe() : null, [clientSecret]);

  const handleEnable = () => {
    // If we already have name/email from props, skip info collection
    if (propName && propEmail) {
      handleCreateIntent(propName, propEmail);
    } else {
      setState('collecting-info');
    }
  };

  const handleCreateIntent = async (clientNameVal: string, clientEmailVal: string) => {
    setState('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/booking/create-deposit-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: 'consultation_deposit',
          clientName: clientNameVal,
          clientEmail: clientEmailVal,
          inquiryId: inquiryId ?? null,
          bookingId: bookingId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        throw new Error(data.error ?? 'Failed to initialize payment');
      }

      // Track deposit initiated
      const attr = getTrafficAttribution();
      trackConsultationDepositInitiated({
        serviceType: 'general',
        trafficSource: attr.trafficSource,
        amount: DEPOSIT_AMOUNT,
      });

      // Record KPI row
      try {
        const supabase = createClient();
        await supabase.from('consultation_deposit_kpis').insert({
          stripe_payment_intent: data.paymentIntentId,
          amount_cents: DEPOSIT_AMOUNT * 100,
          currency: 'usd',
          client_name: clientNameVal,
          client_email: clientEmailVal,
          inquiry_id: inquiryId ?? null,
          booking_id: bookingId ?? null,
          invoice_id: data.invoiceId ?? null,
          status: 'pending',
          source: 'booking_form',
        });
      } catch {
        // Non-fatal KPI insert
      }

      setClientSecret(data.clientSecret);
      setState('payment');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  };

  const handleInfoSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    handleCreateIntent(name.trim(), email.trim());
  };

  const handlePaymentSuccess = async (piId: string) => {
    setPaymentIntentId(piId);
    // Update KPI row to succeeded
    try {
      const supabase = createClient();
      await supabase
        .from('consultation_deposit_kpis')
        .update({ status: 'succeeded', paid_at: new Date().toISOString() })
        .eq('stripe_payment_intent', piId);
    } catch {
      // Non-fatal
    }

    // Track deposit paid
    const attr = getTrafficAttribution();
    trackConsultationDepositPaid({
      serviceType: 'general',
      trafficSource: attr.trafficSource,
      amount: DEPOSIT_AMOUNT,
      transactionId: piId,
    });

    setState('success');
    onDepositPaid?.(piId);
  };

  const handlePaymentError = (msg: string) => {
    setErrorMsg(msg);
    setState('error');
  };

  // ── Idle state: optional toggle ─────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="bg-background border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Optional</p>
            <h3 className="font-serif text-lg text-foreground leading-tight">Consultation Deposit</h3>
          </div>
          <span
            className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
          >
            ${DEPOSIT_AMOUNT}
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-light leading-relaxed mb-4">
          Pay a ${DEPOSIT_AMOUNT} deposit now to secure your consultation slot. Applied toward your first invoice upon engagement.
        </p>
        <button
          onClick={handleEnable}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
          style={{ background: '#355E3B', color: '#fff' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          Pay Deposit Now
        </button>
        <p className="text-center text-xs text-muted-foreground mt-2">No obligation — skip to book for free</p>
      </div>
    );
  }

  // ── Collecting name/email ────────────────────────────────────────────────────
  if (state === 'collecting-info') {
    return (
      <div className="bg-background border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-foreground">Consultation Deposit</h3>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
          >
            ${DEPOSIT_AMOUNT}
          </span>
        </div>
        <form onSubmit={handleInfoSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@lawfirm.com"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 px-5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            Continue to Payment
          </button>
          <button
            type="button"
            onClick={() => setState('idle')}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="bg-background border border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <p className="text-sm text-muted-foreground">Setting up payment…</p>
      </div>
    );
  }

  // ── Payment form ─────────────────────────────────────────────────────────────
  if (state === 'payment' && clientSecret) {
    return (
      <div className="bg-background border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-foreground">Pay Deposit</h3>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
          >
            ${DEPOSIT_AMOUNT}
          </span>
        </div>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#355E3B',
                borderRadius: '12px',
                fontFamily: 'inherit',
              },
            },
          }}
        >
          <DepositFormInner onSuccess={handlePaymentSuccess} onError={handlePaymentError} />
        </Elements>
        <button
          onClick={() => setState('idle')}
          className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center text-center gap-3"
        style={{ background: 'rgba(53,94,59,0.07)', border: '1px solid rgba(53,94,59,0.2)' }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(53,94,59,0.15)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">Deposit Paid!</p>
          <p className="text-xs text-muted-foreground font-light mt-1 leading-relaxed">
            Your ${DEPOSIT_AMOUNT} deposit is confirmed. A receipt has been sent to your email.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Now book your consultation below ↓</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="bg-background border border-border rounded-2xl p-6">
        <div
          className="rounded-xl p-3 mb-4 flex items-start gap-2"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-red-700">{errorMsg ?? 'Payment failed. Please try again.'}</p>
        </div>
        <button
          onClick={() => setState('idle')}
          className="w-full py-2.5 px-5 rounded-full text-xs font-semibold uppercase tracking-widest border border-border text-foreground hover:bg-secondary/50 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return null;
}
