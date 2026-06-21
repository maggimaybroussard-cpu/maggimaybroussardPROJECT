'use client';

import React, { useState, FormEvent } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
  Elements,
} from '@stripe/react-stripe-js';
import type { PaymentIntent } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/client';
import {
  trackPaymentTypeSelected,
  trackPaymentDetailsSubmitted,
  trackPaymentSuccess,
  trackPaymentError,
} from '@/lib/analytics';

export type PaymentType = 'consultation_deposit' | 'retainer';

export interface PaymentOption {
  type: PaymentType;
  label: string;
  amount: number;
  description: string;
}

export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    type: 'consultation_deposit',
    label: 'Consultation Deposit',
    amount: 150,
    description: 'Secures your consultation slot — applied toward your first invoice.',
  },
  {
    type: 'retainer',
    label: 'Retainer Agreement',
    amount: 1500,
    description: 'Monthly retainer for ongoing legal support and document drafting.',
  },
];

interface CustomerFormData {
  firstName: string;
  lastName: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface PaymentFormInnerProps {
  clientSecret: string;
  onSuccess: (paymentIntent: PaymentIntent) => void;
  onError: (msg: string) => void;
}

function PaymentFormInner({ clientSecret, onSuccess, onError }: PaymentFormInnerProps) {
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
      console.error('Stripe confirmPayment error:', error);
      onError(error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        const supabase = createClient();
        const { error: confirmError } = await supabase.functions.invoke('confirm-payment', {
          body: { paymentIntentId: paymentIntent.id, tableName: 'payments' },
        });
        if (confirmError) {
          console.error('confirm-payment edge fn error:', confirmError);
        }
        onSuccess(paymentIntent);
      } catch (err) {
        console.error('confirm-payment call failed:', err);
        onSuccess(paymentIntent);
      }
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: '#355E3B', color: '#fff' }}
      >
        {isProcessing ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Processing…
          </>
        ) : (
          'Pay Securely'
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe · SSL encrypted
      </p>
    </form>
  );
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedType?: PaymentType;
  userEmail?: string;
  userName?: string;
  userId?: string | null;
  bookingId?: string;
  inquiryId?: string;
  clientName?: string;
  clientEmail?: string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  preselectedType,
  userEmail = '',
  userName = '',
  userId = null,
  bookingId,
  inquiryId,
  clientName: propClientName,
  clientEmail: propClientEmail,
}: PaymentModalProps) {
  const [step, setStep] = useState<'select' | 'details' | 'payment' | 'success'>('select');
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(
    preselectedType ? PAYMENT_OPTIONS.find((o) => o.type === preselectedType) ?? null : null
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    firstName: (propClientName ?? userName).split(' ')[0] ?? '',
    lastName: (propClientName ?? userName).split(' ').slice(1).join(' ') ?? '',
    email: propClientEmail ?? userEmail,
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successIntent, setSuccessIntent] = useState<PaymentIntent | null>(null);

  const stripePromise = getStripe();

  const handleSelectOption = (option: PaymentOption) => {
    trackPaymentTypeSelected(option.type, option.amount);
    setSelectedOption(option);
    setStep('details');
  };

  const handleDetailsSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedOption) return;
    trackPaymentDetailsSubmitted(selectedOption.type, selectedOption.amount);
    setLoading(true);
    setError(null);

    try {
      // Use the booking deposit route for consultation_deposit and retainer types
      if (
        selectedOption.type === 'consultation_deposit' ||
        selectedOption.type === 'retainer'
      ) {
        const res = await fetch('/api/booking/create-deposit-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentType: selectedOption.type,
            clientName: `${formData.firstName} ${formData.lastName}`.trim(),
            clientEmail: formData.email,
            bookingId: bookingId ?? null,
            inquiryId: inquiryId ?? null,
            userId: userId ?? null,
            billingAddress: {
              line1: formData.addressLine1,
              city: formData.city,
              state: formData.state,
              postal_code: formData.postalCode,
              country: formData.country,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.clientSecret) {
          throw new Error(data.error ?? 'Payment setup failed');
        }
        setClientSecret(data.clientSecret);
        setStep('payment');
        return;
      }

      // Fallback: original edge function path for other payment types
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{
        clientSecret: string;
        recordId: string;
        error?: string;
      }>('create-payment-intent', {
        body: {
          paymentData: {
            amount: selectedOption.amount,
            currency: 'usd',
            tableName: 'payments',
            description: selectedOption.description,
            paymentType: selectedOption.type,
          },
          customerInfo: {
            userId: userId ?? null,
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
        console.error('create-payment-intent error:', fnError);
        throw new Error((data as { error?: string })?.error ?? fnError.message ?? 'Payment setup failed');
      }

      if (!data?.clientSecret) throw new Error('No client secret returned');

      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set up payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentIntent: PaymentIntent) => {
    if (selectedOption) {
      trackPaymentSuccess(selectedOption.type, selectedOption.amount, paymentIntent.id);
    }
    setSuccessIntent(paymentIntent);
    setStep('success');
  };

  const handlePaymentError = (msg: string) => {
    if (selectedOption) {
      trackPaymentError(selectedOption.type, msg);
    }
    setError(msg);
  };

  const handleClose = () => {
    setStep(preselectedType ? 'details' : 'select');
    setSelectedOption(
      preselectedType ? PAYMENT_OPTIONS.find((o) => o.type === preselectedType) ?? null : null
    );
    setClientSecret(null);
    setError(null);
    setSuccessIntent(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">
              Secure Payment
            </p>
            <h2 className="font-serif text-xl text-foreground">
              {step === 'select' && 'Choose Payment Type'}
              {step === 'details' && selectedOption?.label}
              {step === 'payment' && 'Payment Details'}
              {step === 'success' && 'Payment Confirmed'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Step: Select payment type */}
          {step === 'select' && (
            <div className="space-y-3">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleSelectOption(option)}
                  className="w-full text-left p-5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/3 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground font-light mt-1 leading-relaxed">
                        {option.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold text-foreground">
                        ${option.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">USD</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step: Customer details */}
          {step === 'details' && selectedOption && (
            <div>
              {/* Amount summary */}
              <div
                className="rounded-xl p-4 mb-5 flex items-center justify-between"
                style={{ background: 'rgba(53,94,59,0.06)' }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {selectedOption.label}
                  </p>
                  <p className="text-xs text-muted-foreground font-light mt-0.5">
                    {selectedOption.description}
                  </p>
                </div>
                <p className="text-xl font-semibold" style={{ color: '#355E3B' }}>
                  ${selectedOption.amount.toLocaleString()}
                </p>
              </div>

              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="Smith"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    placeholder="jane@lawfirm.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.addressLine1}
                    onChange={(e) => setFormData((p) => ({ ...p, addressLine1: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="New Orleans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="LA"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.postalCode}
                      onChange={(e) => setFormData((p) => ({ ...p, postalCode: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      placeholder="70112"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                      Country
                    </label>
                    <select
                      required
                      value={formData.country}
                      onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setStep('select'); setError(null); }}
                    className="flex-1 py-2.5 px-4 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    {loading ? (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-spin"
                        >
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Setting up…
                      </>
                    ) : (
                      'Continue to Payment'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step: Stripe payment form */}
          {step === 'payment' && clientSecret && (
            <div>
              {/* Amount summary */}
              <div
                className="rounded-xl p-4 mb-5 flex items-center justify-between"
                style={{ background: 'rgba(53,94,59,0.06)' }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {selectedOption?.label}
                  </p>
                  <p className="text-xs text-muted-foreground font-light mt-0.5">
                    {formData.firstName} {formData.lastName} · {formData.email}
                  </p>
                </div>
                <p className="text-xl font-semibold" style={{ color: '#355E3B' }}>
                  ${selectedOption?.amount.toLocaleString()}
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
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
                      borderRadius: '8px',
                      fontFamily: 'inherit',
                    },
                  },
                }}
              >
                <PaymentFormInner
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(53,94,59,0.1)' }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#355E3B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="font-serif text-2xl text-foreground mb-2">Payment Received</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs mx-auto mb-1">
                Your {selectedOption?.label.toLowerCase()} of{' '}
                <strong>${selectedOption?.amount.toLocaleString()}</strong> has been processed
                successfully.
              </p>
              <p className="text-xs text-muted-foreground font-light mb-6">
                A confirmation will be sent to <strong>{formData.email}</strong>.
              </p>
              {successIntent && (
                <p className="text-xs text-muted-foreground font-mono mb-6 bg-muted/40 rounded-lg px-3 py-2 inline-block">
                  Ref: {successIntent.id.slice(-12).toUpperCase()}
                </p>
              )}
              <button
                onClick={handleClose}
                className="px-8 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200"
                style={{ background: '#355E3B', color: '#fff' }}
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
