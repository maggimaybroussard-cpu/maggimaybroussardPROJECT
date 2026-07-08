'use client';

import React, { useState, FormEvent, useEffect, Suspense, useMemo } from 'react';
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

// ── Retainer tiers ─────────────────────────────────────────────────────────────
const RETAINER_TIERS = [
  {
    id: 'essential',
    label: 'Essential Retainer',
    amount: 750,
    hours: 10,
    description: 'Targeted support for focused matters — ideal for solo attorneys.',
    features: ['10 hrs/month', 'Legal research & drafting', 'Document review', 'Email support'],
  },
  {
    id: 'standard',
    label: 'Standard Retainer',
    amount: 1500,
    hours: 20,
    description: 'The go-to retainer for active firms with regular paralegal needs.',
    features: ['20 hrs/month', 'All Essential features', 'Discovery assistance', 'Trial prep support', 'Priority scheduling'],
    popular: true,
  },
  {
    id: 'full-service',
    label: 'Full-Service Retainer',
    amount: 2800,
    hours: 40,
    description: 'Complete litigation support suite for high-volume practices.',
    features: ['40 hrs/month', 'All Standard features', 'Dedicated availability', 'Case management', 'Monthly reporting', 'Deposition prep & summaries', 'Weekly strategy calls'],
  },
];

// ── Agreement sections ─────────────────────────────────────────────────────────
const AGREEMENT_HIGHLIGHTS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    title: 'Scope of Services',
    text: 'Legal research, drafting, discovery, case management, and trial prep under attorney supervision.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    title: 'Payment Terms',
    text: 'Monthly retainer due on the 1st. Unused hours do not roll over. Overages billed at $75/hr.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Confidentiality',
    text: 'All client information and privileged communications are kept strictly confidential, surviving termination.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: 'Term & Termination',
    text: 'Month-to-month with 30 days written notice. Immediate termination for cause. Pro-rated refund on prepaid amounts.',
  },
];

// ── Customer form data ─────────────────────────────────────────────────────────
interface CustomerFormData {
  firstName: string;
  lastName: string;
  email: string;
  firmName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// ── Stripe payment form inner ──────────────────────────────────────────────────
interface PaymentFormInnerProps {
  clientSecret: string;
  onSuccess: (pi: PaymentIntent) => void;
  onError: (msg: string) => void;
  amount: number;
  tierLabel: string;
}

function PaymentFormInner({ clientSecret, onSuccess, onError, amount, tierLabel }: PaymentFormInnerProps) {
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
        return_url: `${window.location.origin}/retainer-payment/success`,
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
      {/* Order summary pill */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ background: 'rgba(53,94,59,0.07)', border: '1px solid rgba(53,94,59,0.15)' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>
            {tierLabel}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">First month retainer</p>
        </div>
        <p className="text-xl font-semibold" style={{ color: '#355E3B' }}>
          ${amount.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">USD</span>
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
            Pay ${amount.toLocaleString()} Securely
          </>
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe · SSL encrypted · Invoice emailed instantly
      </p>
    </form>
  );
}

// ── Inner page (uses useSearchParams) ─────────────────────────────────────────
function RetainerPaymentInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'tier' | 'agreement' | 'details' | 'payment' | 'success'>('tier');
  const [selectedTier, setSelectedTier] = useState<(typeof RETAINER_TIERS)[0] | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successIntent, setSuccessIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [referenceCode, setReferenceCode] = useState('');

  const [formData, setFormData] = useState<CustomerFormData>({
    firstName: '',
    lastName: '',
    email: '',
    firmName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  });

  const stripePromise = useMemo(() => clientSecret ? getStripe() : null, [clientSecret]);

  // ── Session-based tier pre-selection from URL query params ─────────────────
  useEffect(() => {
    const tierId = searchParams.get('tier');
    if (tierId) {
      const matched = RETAINER_TIERS.find((t) => t.id === tierId);
      if (matched) {
        setSelectedTier(matched);
        setStep('agreement');
      }
    }
  }, [searchParams]);

  // Generate reference code on client only
  useEffect(() => {
    if (step === 'success' && successIntent) {
      setReferenceCode(`RCP-${successIntent.id.slice(-8).toUpperCase()}`);
    }
  }, [step, successIntent]);

  // Send invoice email after success
  useEffect(() => {
    if (step === 'success' && successIntent && selectedTier && !invoiceSent) {
      setInvoiceSent(true);
      fetch('/api/retainer-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: formData.email,
          recipientName: `${formData.firstName} ${formData.lastName}`.trim(),
          firmName: formData.firmName,
          tierLabel: selectedTier.label,
          amount: selectedTier.amount,
          hours: selectedTier.hours,
          paymentIntentId: successIntent.id,
          referenceCode: `RCP-${successIntent.id.slice(-8).toUpperCase()}`,
        }),
      }).catch(() => {/* non-blocking */});
    }
  }, [step, successIntent, selectedTier, formData, invoiceSent]);

  const handleDetailsSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTier) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{
        clientSecret: string;
        recordId: string;
        error?: string;
      }>('create-payment-intent', {
        body: {
          paymentData: {
            amount: selectedTier.amount,
            currency: 'usd',
            tableName: 'payments',
            description: `${selectedTier.label} — ${selectedTier.hours} hrs/month`,
            paymentType: 'retainer',
          },
          customerInfo: {
            userId: null,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            stripeCustomerId: null,
            billing: {
              address_line_1: formData.addressLine1,
              city: formData.city,
              state: formData.state,
              postal_code: formData.postalCode,
              country: formData.country,
            },
          },
        },
      });

      if (fnError) {
        throw new Error((data as { error?: string })?.error ?? fnError.message ?? 'Payment setup failed');
      }
      if (!data?.clientSecret) throw new Error('No client secret returned');

      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set up payment. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (pi: PaymentIntent) => {
    setSuccessIntent(pi);
    setStep('success');
  };

  // ── Step indicator ─────────────────────────────────────────────────────────
  const steps = ['tier', 'agreement', 'details', 'payment'];
  const stepLabels = ['Select Plan', 'Review Agreement', 'Your Details', 'Payment'];
  const currentStepIdx = steps.indexOf(step === 'success' ? 'payment' : step);

  // ── Success screen ─────────────────────────────────────────────────────────
  if (step === 'success' && successIntent && selectedTier) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-20 px-4 md:px-8" style={{ background: '#FAF7F2' }}>
          <div className="max-w-2xl mx-auto">
            {/* Success badge */}
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
                Retainer Activated
              </p>
              <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                Welcome aboard, {formData.firstName}!
              </h1>
              <p className="text-muted-foreground font-light leading-relaxed max-w-md">
                Your retainer is confirmed and your invoice has been sent to{' '}
                <span className="font-medium text-foreground">{formData.email}</span>.
              </p>
            </div>

            {/* Confirmation card */}
            <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden mb-6">
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ background: 'rgba(53,94,59,0.05)', borderBottom: '1px solid rgba(53,94,59,0.1)' }}
              >
                <div>
                  <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                    Retainer Confirmation
                  </p>
                  <p className="font-mono text-sm font-medium text-foreground mt-0.5">
                    {referenceCode}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
                >
                  ✓ Active
                </span>
              </div>

              <div className="px-6 py-5 space-y-3">
                {[
                  { label: 'Client', value: `${formData.firstName} ${formData.lastName}` },
                  { label: 'Firm', value: formData.firmName || '—' },
                  { label: 'Plan', value: selectedTier.label },
                  { label: 'Hours Included', value: `${selectedTier.hours} hrs/month` },
                  { label: 'Amount Paid', value: `$${selectedTier.amount.toLocaleString()} USD` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoice notice */}
            <div
              className="rounded-xl px-5 py-4 mb-6 flex items-start gap-3"
              style={{ background: 'rgba(200,150,90,0.08)', border: '1px solid rgba(200,150,90,0.25)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">Invoice Delivered</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A detailed invoice has been sent to <strong>{formData.email}</strong>. Check your inbox (and spam folder) for your retainer agreement summary and payment receipt.
                </p>
              </div>
            </div>

            {/* Next steps */}
            <div className="rounded-2xl border border-border bg-white shadow-sm p-6 mb-8">
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-4">Next Steps</p>
              <div className="space-y-3">
                {[
                  { num: '01', text: 'Check your email for the invoice and retainer agreement summary.' },
                  { num: '02', text: 'Download and sign the retainer contract from the Retainer page.' },
                  { num: '03', text: 'Expect a welcome message within 1 business day to schedule your kickoff call.' },
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

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/retainer-contract"
                className="flex-1 text-center py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-sm"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                View Retainer Contract
              </Link>
              <Link
                href="/intake-status"
                className="flex-1 text-center py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 border border-border hover:border-primary/40 text-foreground"
              >
                Check Intake Status
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-20 px-4 md:px-8" style={{ background: '#FAF7F2' }}>
        <div className="max-w-5xl mx-auto">

          {/* Page header */}
          <div className="mb-10 md:mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#C8965A' }}>
              Retainer Agreement & Payment
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-3">
              Secure Your Retainer
            </h1>
            <p className="text-muted-foreground font-light leading-relaxed max-w-lg">
              Select a plan, review the retainer agreement, and pay securely via Stripe. Your invoice is delivered instantly by email.
            </p>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-0 mb-10 md:mb-12 max-w-lg">
            {stepLabels.map((label, idx) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                    style={{
                      background: idx <= currentStepIdx ? '#355E3B' : 'rgba(53,94,59,0.1)',
                      color: idx <= currentStepIdx ? '#fff' : '#355E3B',
                    }}
                  >
                    {idx < currentStepIdx ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest hidden sm:block"
                    style={{ color: idx <= currentStepIdx ? '#355E3B' : '#9CA3AF' }}
                  >
                    {label}
                  </span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div
                    className="flex-1 h-px mx-2 mb-4 transition-all duration-300"
                    style={{ background: idx < currentStepIdx ? '#355E3B' : 'rgba(53,94,59,0.15)' }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ── Step: Tier Selection ── */}
          {step === 'tier' && (
            <div>
              <h2 className="font-serif text-2xl text-foreground mb-6">Choose Your Plan</h2>
              <div className="grid md:grid-cols-3 gap-5 mb-8">
                {RETAINER_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => { setSelectedTier(tier); setStep('agreement'); }}
                    className="relative text-left p-6 rounded-2xl border transition-all duration-200 group hover:shadow-lg active:scale-[0.99] bg-white"
                    style={{
                      borderColor: tier.popular ? '#355E3B' : 'rgba(0,0,0,0.1)',
                      boxShadow: tier.popular ? '0 0 0 2px rgba(53,94,59,0.15)' : undefined,
                    }}
                  >
                    {tier.popular && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                        style={{ background: '#355E3B', color: '#fff' }}
                      >
                        Most Popular
                      </span>
                    )}
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{tier.label}</p>
                      <p className="font-serif text-3xl text-foreground">
                        ${tier.amount.toLocaleString()}
                        <span className="text-sm font-sans font-normal text-muted-foreground">/mo</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{tier.hours} hrs included</p>
                    </div>
                    <p className="text-sm text-muted-foreground font-light leading-relaxed mb-4">{tier.description}</p>
                    <ul className="space-y-2 mb-5">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200"
                      style={{
                        background: tier.popular ? '#355E3B' : 'rgba(53,94,59,0.08)',
                        color: tier.popular ? '#fff' : '#355E3B',
                      }}
                    >
                      Select Plan
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Need a custom arrangement?{' '}
                <Link href="/contact" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  Contact us
                </Link>{' '}
                to discuss your needs.
              </p>
            </div>
          )}

          {/* ── Step: Agreement Review ── */}
          {step === 'agreement' && selectedTier && (
            <div className="max-w-3xl">
              <button
                onClick={() => { setStep('tier'); setAgreementAccepted(false); }}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                Back to Plans
              </button>

              <h2 className="font-serif text-2xl text-foreground mb-2">Review Retainer Agreement</h2>
              <p className="text-sm text-muted-foreground font-light mb-6">
                Please read the key terms below before proceeding to payment.
              </p>

              {/* Selected plan summary */}
              <div
                className="rounded-xl px-5 py-4 mb-6 flex items-center justify-between"
                style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>
                    {selectedTier.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedTier.hours} hrs/month</p>
                </div>
                <p className="font-serif text-2xl text-foreground">
                  ${selectedTier.amount.toLocaleString()}<span className="text-sm font-sans font-normal text-muted-foreground">/mo</span>
                </p>
              </div>

              {/* Agreement highlights */}
              <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-border" style={{ background: 'rgba(74,55,40,0.03)' }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Key Agreement Terms</p>
                </div>
                <div className="divide-y divide-border">
                  {AGREEMENT_HIGHLIGHTS.map(({ icon, title, text }) => (
                    <div key={title} className="px-6 py-4 flex items-start gap-4">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B' }}
                      >
                        {icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-0.5">{title}</p>
                        <p className="text-sm text-muted-foreground font-light leading-relaxed">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-border" style={{ background: 'rgba(74,55,40,0.03)' }}>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This is a summary of key terms. View the{' '}
                    <Link href="/retainer-contract" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors" style={{ color: '#355E3B' }}>
                      full retainer contract
                    </Link>{' '}
                    for complete terms. All paralegal services are performed under attorney supervision and do not constitute the practice of law.
                  </p>
                </div>
              </div>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group mb-6">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200"
                    style={{
                      borderColor: agreementAccepted ? '#355E3B' : '#D1D5DB',
                      background: agreementAccepted ? '#355E3B' : 'transparent',
                    }}
                  >
                    {agreementAccepted && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  I have read and agree to the{' '}
                  <Link href="/retainer-contract" target="_blank" className="underline underline-offset-2 transition-colors" style={{ color: '#355E3B' }}>
                    Retainer Agreement
                  </Link>{' '}
                  and authorize Maggi May Broussard to provide paralegal services under the terms described above.
                </p>
              </label>

              <button
                onClick={() => setStep('details')}
                disabled={!agreementAccepted}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-sm"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                Continue to Details
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Step: Details ── */}
          {step === 'details' && selectedTier && (
            <div className="max-w-2xl">
              <button
                onClick={() => { setStep('agreement'); setError(null); }}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                Back to Agreement
              </button>

              <h2 className="font-serif text-2xl text-foreground mb-6">Your Details</h2>

              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">First Name *</label>
                    <input
                      type="text" required value={formData.firstName}
                      onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="Jane" autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Last Name *</label>
                    <input
                      type="text" required value={formData.lastName}
                      onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="Smith" autoComplete="family-name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Email Address *</label>
                  <input
                    type="email" required value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    placeholder="jane@lawfirm.com" autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Law Firm / Organization</label>
                  <input
                    type="text" value={formData.firmName}
                    onChange={(e) => setFormData((p) => ({ ...p, firmName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    placeholder="Smith & Associates LLP (optional)" autoComplete="organization"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Billing Address *</label>
                  <input
                    type="text" required value={formData.addressLine1}
                    onChange={(e) => setFormData((p) => ({ ...p, addressLine1: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    placeholder="123 Main Street" autoComplete="street-address"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">City *</label>
                    <input
                      type="text" required value={formData.city}
                      onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="New Orleans" autoComplete="address-level2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">State *</label>
                    <input
                      type="text" required value={formData.state}
                      onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="LA" autoComplete="address-level1" maxLength={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">ZIP / Postal Code *</label>
                    <input
                      type="text" required value={formData.postalCode}
                      onChange={(e) => setFormData((p) => ({ ...p, postalCode: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="70112" autoComplete="postal-code"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Country *</label>
                    <select
                      required value={formData.country}
                      onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      autoComplete="country"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#DC2626' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:opacity-90"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {loading ? (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Setting up payment…
                    </>
                  ) : (
                    'Continue to Payment'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── Step: Payment ── */}
          {step === 'payment' && clientSecret && selectedTier && (
            <div className="max-w-lg">
              <button
                onClick={() => { setStep('details'); setClientSecret(null); setError(null); }}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                Back to Details
              </button>

              <h2 className="font-serif text-2xl text-foreground mb-6">Secure Payment</h2>

              {error && (
                <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#355E3B',
                      colorBackground: '#ffffff',
                      colorText: '#2C1F14',
                      colorDanger: '#DC2626',
                      fontFamily: 'Georgia, serif',
                      borderRadius: '12px',
                    },
                  },
                }}
              >
                <PaymentFormInner
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onError={(msg) => setError(msg)}
                  amount={selectedTier.amount}
                  tierLabel={selectedTier.label}
                />
              </Elements>
            </div>
          )}

        </div>
      </main>
      <Footer />
    </>
  );
}

// ── Main page (wraps inner in Suspense for useSearchParams) ───────────────────
export default function RetainerPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF7F2' }}>
        <div className="flex flex-col items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    }>
      <RetainerPaymentInner />
    </Suspense>
  );
}
