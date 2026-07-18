'use client';

import React, { useState, FormEvent, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { PAYMENT_OPTIONS, PaymentOption } from '@/components/PaymentModal';
import {
  trackEvent,
  trackPaymentTypeSelected,
  trackPaymentDetailsSubmitted,
  trackPaymentSuccess,
  trackPaymentError,
  trackLeadQuality,
  trackRetainerPurchased,
  trackCheckoutPaymentFailed,
} from '@/lib/analytics';

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

const TRUST_BADGES = [
  { icon: '🔒', label: 'SSL Encrypted' },
  { icon: '⚡', label: 'Instant Confirmation' },
  { icon: '✅', label: 'Stripe Secured' },
  { icon: '📄', label: 'Receipt Emailed' },
];

const CONSULTATION_INCLUDES = [
  '30-minute focused strategy session',
  'Case overview & needs assessment',
  'Google Meet link sent instantly',
  'Deposit applied to first invoice',
  'No obligation after the call',
];

/* ─── Inner Stripe payment form ─────────────────────────────────────── */
interface PaymentFormInnerProps {
  clientSecret: string;
  onSuccess: (pi: PaymentIntent) => void;
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
      <PaymentElement options={{ layout: 'tabs' }} />
      {/* Mobile-optimized sticky CTA area */}
      <div className="sm:static fixed bottom-0 left-0 right-0 sm:p-0 p-4 sm:bg-transparent bg-background sm:border-0 border-t border-border z-10">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full py-4 sm:py-3.5 px-6 rounded-full text-base sm:text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Pay Securely
            </>
          )}
        </button>
        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-2 sm:mt-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Secured by Stripe · SSL encrypted · PCI compliant
        </p>
      </div>
      {/* Spacer so content isn't hidden behind sticky button on mobile */}
      <div className="h-24 sm:h-0" />
    </form>
  );
}

/* ─── Main checkout content ──────────────────────────────────────────── */
function CheckoutContent() {
  const searchParams = useSearchParams();
  const preType = searchParams.get('type') as 'consultation_deposit' | 'retainer' | 'hourly_rate' | null;

  const [step, setStep] = useState<'select' | 'details' | 'payment' | 'success'>(
    preType ? 'details' : 'select'
  );
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(
    preType ? PAYMENT_OPTIONS.find((o) => o.type === preType) ?? null : null
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successIntent, setSuccessIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only initialize Stripe when we have a clientSecret (payment step reached)
  // This prevents the 298 KiB Stripe JS bundle from loading on initial page visit
  const stripePromise = clientSecret ? getStripe() : null;

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

  // Track checkout page view on mount
  React.useEffect(() => {
    trackEvent('checkout_page_view', {
      event_category: 'conversion',
      event_label: 'Checkout Page',
      page: 'checkout',
      pre_selected_type: preType ?? 'none',
    });
  }, []);

  const handleSelectOption = (option: PaymentOption) => {
    setSelectedOption(option);
    // GA4 begin_checkout ecommerce event + custom payment_type_selected
    trackEvent('begin_checkout', {
      currency: 'USD',
      value: option.amount,
      items: [
        {
          item_id: option.type,
          item_name: option.label,
          price: option.amount,
          quantity: 1,
        },
      ],
    });
    trackPaymentTypeSelected(option.type, option.amount);
    setStep('details');
  };

  const handleDetailsSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedOption) return;
    setLoading(true);
    setError(null);

    // Track that the user submitted billing details and is proceeding to Stripe
    trackPaymentDetailsSubmitted(selectedOption.type, selectedOption.amount);

    try {
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
      trackPaymentError(selectedOption.type, msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (pi: PaymentIntent) => {
    if (selectedOption) {
      // GA4 purchase conversion event
      trackPaymentSuccess(selectedOption.type, selectedOption.amount, pi.id);
      // Fire specific retainer_purchased funnel event for retainer payments
      if (selectedOption.type === 'retainer') {
        trackRetainerPurchased(selectedOption.label ?? 'Retainer', selectedOption.amount, pi.id);
      }
      // Lead quality attribution
      trackLeadQuality({
        source: 'payment',
        service: selectedOption.type,
        conversionType: 'payment',
        value: selectedOption.amount,
      });
    }
    setSuccessIntent(pi);
    setStep('success');
  };

  const handlePaymentError = (msg: string) => {
    if (selectedOption) {
      trackPaymentError(selectedOption.type, msg);
      trackCheckoutPaymentFailed(selectedOption.type, msg, selectedOption.amount);
    }
    setError(msg);
  };

  /* ── Step: Select ── */
  if (step === 'select') {
    return (
      <div className="grid lg:grid-cols-[1fr_420px] gap-10 items-start">
        {/* Left: info panel */}
        <div>
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
          >
            Secure Checkout
          </span>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight mb-5">
            Convert Your Inquiry
            <br />
            <span className="italic" style={{ color: '#355E3B' }}>Into Action</span>
          </h1>
          <p className="text-muted-foreground font-light leading-relaxed text-base md:text-lg mb-8 max-w-lg">
            Select a payment option below to secure your consultation or begin your retainer. All payments are processed securely via Stripe.
          </p>

          {/* What's included */}
          <div
            className="rounded-2xl p-5 md:p-6 mb-6"
            style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.15)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#355E3B' }}>
              Consultation Includes
            </p>
            <ul className="space-y-2.5">
              {CONSULTATION_INCLUDES.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-foreground font-light">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
            {TRUST_BADGES.map((b) => (
              <span
                key={b.label}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs font-medium border border-border text-muted-foreground"
              >
                <span>{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: option cards */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Choose a Payment Option
          </p>
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => handleSelectOption(option)}
              className="w-full text-left p-5 md:p-6 rounded-2xl border border-border hover:border-primary/40 transition-all duration-200 group bg-background shadow-sm hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                    {option.label}
                  </p>
                  <p className="text-sm text-muted-foreground font-light mt-1 leading-relaxed">
                    {option.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-semibold" style={{ color: '#355E3B' }}>
                    ${option.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">USD</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>
                Select
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}

          <p className="text-xs text-muted-foreground font-light text-center pt-2">
            Already booked?{' '}
            <Link href="/book-consultation" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Return to booking page
            </Link>
          </p>
        </div>
      </div>
    );
  }

  /* ── Step: Details ── */
  if (step === 'details' && selectedOption) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => { setStep('select'); setError(null); }}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6 md:mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Options
        </button>

        {/* Order summary */}
        <div
          className="rounded-2xl p-4 md:p-5 mb-6 md:mb-8 flex items-center justify-between"
          style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              {selectedOption.label}
            </p>
            <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs">
              {selectedOption.description}
            </p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-2xl font-semibold" style={{ color: '#355E3B' }}>
              ${selectedOption.amount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">USD</p>
          </div>
        </div>

        <h2 className="font-serif text-2xl text-foreground mb-5 md:mb-6">Your Details</h2>

        <form onSubmit={handleDetailsSubmit} className="space-y-4 md:space-y-5">
          {/* Name row — stacked on mobile, side-by-side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="Jane"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="Smith"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Email Address *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="jane@lawfirm.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Law Firm / Organization</label>
            <input
              type="text"
              value={formData.firmName}
              onChange={(e) => setFormData((p) => ({ ...p, firmName: e.target.value }))}
              className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="Smith & Associates LLP (optional)"
              autoComplete="organization"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Billing Address *</label>
            <input
              type="text"
              required
              value={formData.addressLine1}
              onChange={(e) => setFormData((p) => ({ ...p, addressLine1: e.target.value }))}
              className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="123 Main Street"
              autoComplete="street-address"
            />
          </div>

          {/* City / State — stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="New Orleans"
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">State *</label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="LA"
                maxLength={2}
                autoComplete="address-level1"
              />
            </div>
          </div>

          {/* ZIP / Country — stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">ZIP Code *</label>
              <input
                type="text"
                required
                value={formData.postalCode}
                onChange={(e) => setFormData((p) => ({ ...p, postalCode: e.target.value }))}
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="70112"
                autoComplete="postal-code"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Country *</label>
              <select
                required
                value={formData.country}
                onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl border border-border bg-background text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
            <div className="flex items-center gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Mobile-optimized sticky CTA */}
          <div className="sm:static fixed bottom-0 left-0 right-0 sm:p-0 p-4 sm:bg-transparent bg-background sm:border-0 border-t border-border z-10">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 sm:py-3.5 px-6 rounded-full text-base sm:text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
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
          </div>
          {/* Spacer so content isn't hidden behind sticky button on mobile */}
          <div className="h-20 sm:h-0" />
        </form>
      </div>
    );
  }

  /* ── Step: Payment ── */
  if (step === 'payment' && clientSecret && selectedOption) {
    return (
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => { setStep('details'); setError(null); setClientSecret(null); }}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6 md:mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Details
        </button>

        {/* Order summary */}
        <div
          className="rounded-2xl p-4 md:p-5 mb-6 md:mb-8 flex items-center justify-between"
          style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              {selectedOption.label}
            </p>
            <p className="text-xs text-muted-foreground font-light">
              {formData.firstName} {formData.lastName} · {formData.email}
            </p>
          </div>
          <p className="text-2xl font-semibold shrink-0 ml-4" style={{ color: '#355E3B' }}>
            ${selectedOption.amount.toLocaleString()}
          </p>
        </div>

        <h2 className="font-serif text-2xl text-foreground mb-5 md:mb-6">Payment Details</h2>

        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
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
                borderRadius: '10px',
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
    );
  }

  /* ── Step: Success ── */
  if (step === 'success' && selectedOption) {
    return (
      <div className="max-w-lg mx-auto text-center py-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
          style={{ background: 'rgba(53,94,59,0.1)', border: '2px solid rgba(53,94,59,0.2)' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">
          Payment Confirmed
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
          You&apos;re all set, {formData.firstName}!
        </h2>
        <p className="text-muted-foreground font-light leading-relaxed mb-2">
          Your <strong>{selectedOption.label.toLowerCase()}</strong> of{' '}
          <strong>${selectedOption.amount.toLocaleString()}</strong> has been processed.
        </p>
        <p className="text-sm text-muted-foreground font-light mb-8">
          A receipt has been sent to <span className="font-medium text-foreground">{formData.email}</span>.
        </p>

        {successIntent && (
          <p className="text-xs text-muted-foreground font-mono mb-8 bg-muted/40 rounded-lg px-4 py-2.5 inline-block">
            Ref: {successIntent.id.slice(-12).toUpperCase()}
          </p>
        )}

        <div className="flex flex-col gap-3 justify-center">
          <Link
            href="/book-consultation"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 sm:py-3 rounded-full text-base sm:text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-md"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Book Your Consultation
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 sm:py-3 rounded-full text-sm font-semibold uppercase tracking-widest border border-border hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-foreground"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Page wrapper ───────────────────────────────────────────────────── */
export default function CheckoutPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero strip */}
        <section
          className="pt-24 md:pt-28 pb-6 md:pb-10 px-4 md:px-10"
          style={{ background: 'linear-gradient(135deg, #2d5a35 0%, #355E3B 60%, #4a7c52 100%)' }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4">
              <div>
                <Link
                  href="/book-consultation"
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-xs font-medium uppercase tracking-widest mb-3 md:mb-4 transition-colors duration-200"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                  Back to Booking
                </Link>
                <h1 className="font-serif text-2xl md:text-4xl text-white leading-tight">
                  Secure Checkout
                </h1>
                <p className="text-white/70 text-sm font-light mt-1.5">
                  Convert your inquiry into a confirmed, paid consultation
                </p>
              </div>
              {/* Trust badges — hidden on mobile to reduce clutter, shown on md+ */}
              <div className="hidden md:flex flex-wrap gap-2">
                {TRUST_BADGES.map((b) => (
                  <span
                    key={b.label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                  >
                    <span>{b.icon}</span>
                    {b.label}
                  </span>
                ))}
              </div>
              {/* Compact trust row on mobile */}
              <div className="flex md:hidden gap-2 flex-wrap">
                {TRUST_BADGES.slice(0, 2).map((b) => (
                  <span
                    key={b.label}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                  >
                    <span>{b.icon}</span>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Checkout body */}
        <section className="py-8 md:py-14 px-4 md:px-10">
          <div className="max-w-6xl mx-auto">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              }
            >
              <CheckoutContent />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
