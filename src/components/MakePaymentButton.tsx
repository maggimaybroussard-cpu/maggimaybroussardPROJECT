'use client';

import React, { useState } from 'react';
import { getStripe } from '@/lib/stripe/client';


interface MakePaymentButtonProps {
  /** Amount in dollars (e.g. 200 for $200.00) */
  amount?: number;
  /** Description shown on the Stripe checkout */
  description?: string;
  /** Customer name pre-fill */
  customerName?: string;
  /** Customer email pre-fill */
  customerEmail?: string;
  /** Payment type for tracking */
  paymentType?: string;
  /** Optional: override the button label */
  label?: string;
  /** Optional: full-width */
  fullWidth?: boolean;
  /** Optional: show card logos below the button */
  showCardLogos?: boolean;
}

export default function MakePaymentButton({
  amount = 0,
  description = 'Legal Services Payment',
  customerName = '',
  customerEmail = '',
  paymentType = 'general',
  label = 'Make Payment',
  fullWidth = false,
  showCardLogos = true,
}: MakePaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      // Create a Stripe checkout session via the existing invoices API
      const res = await fetch('/api/invoices/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // cents
          description,
          customer_name: customerName,
          customer_email: customerEmail,
          payment_type: paymentType,
          success_url: `${window.location.origin}/payment-success`,
          cancel_url: window.location.href,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create payment session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Fallback: use Stripe.js redirect
      if (data.sessionId) {
        const stripe = await getStripe();
        if (!stripe) throw new Error('Stripe failed to load');
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (stripeError) throw new Error(stripeError.message);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-0 ${fullWidth ? 'w-full' : 'inline-flex'}`}>
      {/* Make Payment Button */}
      <button
        onClick={handleClick}
        disabled={loading}
        className={`
          relative flex items-center justify-center gap-3
          px-8 py-4 rounded-t-2xl rounded-b-none
          bg-[#1a6fd4] hover:bg-[#1560bc] active:bg-[#1254a8]
          text-white font-bold text-xl
          shadow-md hover:shadow-lg
          transition-all duration-200
          disabled:opacity-70 disabled:cursor-not-allowed
          ${fullWidth ? 'w-full' : 'min-w-[280px]'}
        `}
        style={{ letterSpacing: '-0.01em' }}
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Processing…</span>
          </>
        ) : (
          <>
            {/* Lock icon */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              className="opacity-90"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.5"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="16" r="1.5" fill="white"/>
            </svg>
            <span>{label}</span>
          </>
        )}
      </button>

      {/* Card Logos Strip */}
      {showCardLogos && (
        <div
          className={`
            flex flex-col items-center gap-2
            bg-white border border-t-0 border-gray-200
            rounded-b-2xl px-6 py-4
            shadow-md
            ${fullWidth ? 'w-full' : 'min-w-[280px]'}
          `}
        >
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase px-2">Accepted</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {/* Visa */}
            <span className="font-extrabold text-[#1a1f71] text-lg tracking-tight" style={{ fontFamily: 'serif', letterSpacing: '-0.02em' }}>
              VISA
            </span>

            {/* Mastercard */}
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-[#eb001b]" style={{ marginRight: -8 }} />
              <div className="w-6 h-6 rounded-full bg-[#f79e1b] opacity-90" />
            </div>

            {/* Discover */}
            <span className="font-black text-sm text-gray-900 tracking-tight" style={{ letterSpacing: '-0.03em' }}>
              DISCOVER<span className="text-[#f76f20]">·</span>
            </span>

            {/* Amex */}
            <div className="flex items-center justify-center bg-[#2557d6] rounded px-1.5 py-0.5">
              <span className="text-white font-black text-[10px] leading-none tracking-tight">AM<br />EX</span>
            </div>

            {/* eCheck */}
            <span className="font-semibold text-sm text-gray-700">eCheck</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-red-500 text-center max-w-[280px]">{error}</p>
      )}
    </div>
  );
}
