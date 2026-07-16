'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from '@stripe/react-stripe-js';
import type { PaymentIntent, SetupIntent } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PaymentPlanConfig {
  totalAmount: number;
  currency?: string;
  installmentCount: 2 | 3 | 4 | 6 | 12;
  frequency: 'monthly' | 'biweekly' | 'weekly';
  description: string;
  invoiceId?: string | null;
  inquiryId?: string | null;
}

export interface ACHPaymentConfig {
  amount: number;
  currency?: string;
  description: string;
  tableName: string;
  paymentType: string;
  additionalFields?: Record<string, unknown>;
}

export interface CustomerInfo {
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  stripeCustomerId?: string | null;
  billing?: {
    address_line_1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

interface ACHPaymentFormProps {
  clientSecret: string;
  amount: number;
  description: string;
  onSuccess: (pi: PaymentIntent) => void;
  onError: (msg: string) => void;
}

interface PaymentPlanFormProps {
  setupClientSecret: string;
  planId: string;
  installments: Array<{ installment_number: number; amount: number; due_date: string }>;
  installmentAmount: number;
  totalAmount: number;
  frequency: string;
  description: string;
  onSuccess: (si: SetupIntent) => void;
  onError: (msg: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  biweekly: 'Every 2 Weeks',
  weekly: 'Weekly',
};

// ── ACH Payment Form Inner ────────────────────────────────────────────────────
function ACHPaymentFormInner({ clientSecret, amount, description, onSuccess, onError }: ACHPaymentFormProps) {
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
        return_url: `${window.location.origin}/payment-confirmation?type=ach`,
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message ?? 'ACH payment failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
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
      {/* ACH notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: 'rgba(53,94,59,0.05)', borderColor: 'rgba(53,94,59,0.2)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.12)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: '#355E3B' }}>ACH Bank Transfer</p>
          <p className="text-xs text-muted-foreground mt-0.5">Connect your bank account securely via Stripe. ACH transfers typically settle in 1–3 business days.</p>
        </div>
      </div>

      {/* Amount summary */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/40 border border-border">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">One-time ACH bank transfer</p>
        </div>
        <p className="text-xl font-semibold" style={{ color: '#355E3B' }}>{formatCurrency(amount)}</p>
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
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Processing…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Pay {formatCurrency(amount)} via Bank Transfer
          </>
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground">Secured by Stripe · Bank-level encryption · No card required</p>
    </form>
  );
}

// ── Payment Plan Setup Form Inner ─────────────────────────────────────────────
function PaymentPlanFormInner({
  setupClientSecret,
  planId,
  installments,
  installmentAmount,
  totalAmount,
  frequency,
  description,
  onSuccess,
  onError,
}: PaymentPlanFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-confirmation?type=plan&plan_id=${planId}`,
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message ?? 'Setup failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (setupIntent?.status === 'succeeded') {
      onSuccess(setupIntent);
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Plan summary */}
      <div className="p-4 rounded-xl border" style={{ background: 'rgba(53,94,59,0.05)', borderColor: 'rgba(53,94,59,0.2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>Payment Plan</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold" style={{ color: '#355E3B' }}>{formatCurrency(installmentAmount)}</p>
            <p className="text-xs text-muted-foreground">{FREQUENCY_LABELS[frequency] ?? frequency}</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">{installments.length} installments · Total {formatCurrency(totalAmount)}</p>
          <button
            type="button"
            onClick={() => setShowSchedule(!showSchedule)}
            className="text-xs font-medium underline underline-offset-2"
            style={{ color: '#355E3B' }}
          >
            {showSchedule ? 'Hide' : 'View'} schedule
          </button>
        </div>

        {showSchedule && (
          <div className="mt-3 space-y-1.5">
            {installments.map((inst) => (
              <div key={inst.installment_number} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  #{inst.installment_number} · {formatDate(inst.due_date)}
                </span>
                <span className="font-medium text-foreground">{formatCurrency(inst.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACH/Card setup */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-muted-foreground">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-xs text-muted-foreground">
          Add your bank account or card. Your payment method will be saved and charged automatically on each due date.
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
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Setting up plan…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Confirm Payment Plan
          </>
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground">Secured by Stripe · Cancel anytime · Receipts emailed automatically</p>
    </form>
  );
}

// ── ACH Payment Modal ─────────────────────────────────────────────────────────
interface ACHPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerInfo: CustomerInfo;
  paymentConfig: ACHPaymentConfig;
  onSuccess?: () => void;
}

export function ACHPaymentModal({ isOpen, onClose, customerInfo, paymentConfig, onSuccess }: ACHPaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const stripePromise = getStripe();

  React.useEffect(() => {
    if (!isOpen) { setClientSecret(null); setError(null); setSuccess(false); return; }
    setLoading(true);
    const supabase = createClient();
    supabase.functions.invoke<{ clientSecret: string; recordId: string }>('create-payment-intent', {
      body: {
        paymentData: {
          amount: paymentConfig.amount,
          currency: paymentConfig.currency ?? 'usd',
          tableName: paymentConfig.tableName,
          description: paymentConfig.description,
          paymentType: 'ach_or_card',
          additionalFields: paymentConfig.additionalFields,
        },
        customerInfo: {
          userId: customerInfo.userId,
          firstName: customerInfo.firstName,
          lastName: customerInfo.lastName,
          email: customerInfo.email,
          stripeCustomerId: customerInfo.stripeCustomerId ?? null,
          billing: customerInfo.billing ?? {
            address_line_1: '',
            city: '',
            state: '',
            postal_code: '',
            country: 'US',
          },
        },
      },
    }).then(({ data, error: fnErr }) => {
      if (fnErr || !data?.clientSecret) {
        setError((data as { error?: string })?.error ?? fnErr?.message ?? 'Could not initialize payment');
      } else {
        setClientSecret(data.clientSecret);
      }
      setLoading(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pay via Bank Transfer</h2>
            <p className="text-xs text-muted-foreground mt-0.5">ACH or card accepted</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-muted-foreground">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
          )}
          {error && !loading && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(53,94,59,0.12)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-base font-semibold text-foreground">Payment Initiated</p>
              <p className="text-sm text-muted-foreground">ACH transfers settle in 1–3 business days. You will receive a confirmation email.</p>
              <button onClick={() => { setSuccess(false); onClose(); onSuccess?.(); }} className="mt-2 px-6 py-2 rounded-full text-sm font-semibold text-white" style={{ background: '#355E3B' }}>Done</button>
            </div>
          )}
          {clientSecret && !loading && !success && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
              <ACHPaymentFormInner
                clientSecret={clientSecret}
                amount={paymentConfig.amount}
                description={paymentConfig.description}
                onSuccess={() => setSuccess(true)}
                onError={(msg) => setError(msg)}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Payment Plan Modal ────────────────────────────────────────────────────────
interface PaymentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerInfo: CustomerInfo;
  totalAmount: number;
  currency?: string;
  description: string;
  invoiceId?: string | null;
  inquiryId?: string | null;
  onSuccess?: (planId: string) => void;
}

const PLAN_OPTIONS = [
  { count: 2, label: '2 payments', badge: '' },
  { count: 3, label: '3 payments', badge: 'Popular' },
  { count: 4, label: '4 payments', badge: '' },
  { count: 6, label: '6 payments', badge: '' },
];

export function PaymentPlanModal({
  isOpen,
  onClose,
  customerInfo,
  totalAmount,
  currency = 'usd',
  description,
  invoiceId,
  inquiryId,
  onSuccess,
}: PaymentPlanModalProps) {
  const [step, setStep] = useState<'configure' | 'payment' | 'success'>('configure');
  const [installmentCount, setInstallmentCount] = useState<2 | 3 | 4 | 6>(3);
  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<Array<{ installment_number: number; amount: number; due_date: string }>>([]);
  const [installmentAmount, setInstallmentAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripe();

  React.useEffect(() => {
    if (!isOpen) { setStep('configure'); setSetupClientSecret(null); setPlanId(null); setError(null); }
  }, [isOpen]);

  const handleCreatePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fnErr } = await supabase.functions.invoke<{
        planId: string;
        setupIntentClientSecret: string;
        installments: Array<{ installment_number: number; amount: number; due_date: string }>;
        installmentAmount: number;
      }>('create-payment-plan', {
        body: {
          customerInfo: {
            userId: customerInfo.userId,
            firstName: customerInfo.firstName,
            lastName: customerInfo.lastName,
            email: customerInfo.email,
            stripeCustomerId: customerInfo.stripeCustomerId ?? null,
          },
          planConfig: {
            totalAmount,
            currency,
            installmentCount,
            frequency,
            description,
            invoiceId: invoiceId ?? null,
            inquiryId: inquiryId ?? null,
          },
        },
      });

      if (fnErr || !data?.setupIntentClientSecret) {
        throw new Error((data as { error?: string })?.error ?? fnErr?.message ?? 'Could not create plan');
      }

      setSetupClientSecret(data.setupIntentClientSecret);
      setPlanId(data.planId);
      setInstallments(data.installments);
      setInstallmentAmount(data.installmentAmount);
      setStep('payment');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create payment plan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const perInstallment = Math.round((totalAmount / installmentCount) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {step === 'configure' ? 'Set Up Payment Plan' : step === 'payment' ? 'Add Payment Method' : 'Plan Confirmed'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'configure' ? `Total: $${totalAmount.toLocaleString()} ${currency.toUpperCase()}` : description}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Step 1: Configure */}
          {step === 'configure' && (
            <div className="space-y-5">
              {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

              {/* Installment count */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Number of Payments</p>
                <div className="grid grid-cols-2 gap-2">
                  {PLAN_OPTIONS.map((opt) => (
                    <button
                      key={opt.count}
                      type="button"
                      onClick={() => setInstallmentCount(opt.count as 2 | 3 | 4 | 6)}
                      className="relative p-3 rounded-xl border text-left transition-all"
                      style={{
                        borderColor: installmentCount === opt.count ? '#355E3B' : undefined,
                        background: installmentCount === opt.count ? 'rgba(53,94,59,0.07)' : undefined,
                      }}
                    >
                      {opt.badge && (
                        <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#355E3B', color: '#fff' }}>
                          {opt.badge}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(Math.round((totalAmount / opt.count) * 100) / 100)} each
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Payment Frequency</p>
                <div className="flex gap-2">
                  {(['monthly', 'biweekly', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className="flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all"
                      style={{
                        borderColor: frequency === f ? '#355E3B' : undefined,
                        background: frequency === f ? 'rgba(53,94,59,0.07)' : undefined,
                        color: frequency === f ? '#355E3B' : undefined,
                      }}
                    >
                      {FREQUENCY_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">You pay</p>
                  <p className="text-lg font-semibold" style={{ color: '#355E3B' }}>{formatCurrency(perInstallment)}</p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{FREQUENCY_LABELS[frequency]} × {installmentCount}</p>
                  <p className="text-xs text-muted-foreground">Total {formatCurrency(totalAmount)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreatePlan}
                disabled={loading}
                className="w-full py-4 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Creating plan…
                  </>
                ) : 'Continue to Payment Method'}
              </button>
            </div>
          )}

          {/* Step 2: Payment method */}
          {step === 'payment' && setupClientSecret && planId && (
            <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret, appearance: { theme: 'stripe' } }}>
              <PaymentPlanFormInner
                setupClientSecret={setupClientSecret}
                planId={planId}
                installments={installments}
                installmentAmount={installmentAmount}
                totalAmount={totalAmount}
                frequency={frequency}
                description={description}
                onSuccess={() => setStep('success')}
                onError={(msg) => setError(msg)}
              />
            </Elements>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(53,94,59,0.12)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Payment Plan Active</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your {installmentCount}-payment plan is set up. {formatCurrency(installmentAmount)} will be charged {FREQUENCY_LABELS[frequency].toLowerCase()}.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-muted/30 text-left space-y-2">
                {installments.slice(0, 3).map((inst) => (
                  <div key={inst.installment_number} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">#{inst.installment_number} · {formatDate(inst.due_date)}</span>
                    <span className="font-medium">{formatCurrency(inst.amount)}</span>
                  </div>
                ))}
                {installments.length > 3 && (
                  <p className="text-xs text-muted-foreground">+ {installments.length - 3} more installments</p>
                )}
              </div>
              <button
                onClick={() => { onSuccess?.(planId ?? ''); onClose(); }}
                className="px-8 py-3 rounded-full text-sm font-semibold text-white"
                style={{ background: '#355E3B' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
