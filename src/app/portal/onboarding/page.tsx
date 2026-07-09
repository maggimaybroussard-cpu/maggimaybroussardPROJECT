'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OnboardingState {
  id?: string;
  email_verified: boolean;
  profile_completed: boolean;
  retainer_accepted: boolean;
  payment_linked: boolean;
  case_confirmed: boolean;
  onboarding_complete: boolean;
  firm_name?: string;
  practice_area?: string;
  phone?: string;
}

interface Inquiry {
  id: string;
  name: string;
  firm: string;
  service: string;
  status: string;
  created_at: string;
}

const PRACTICE_AREAS = [
  'Family Law',
  'Immigration Law',
  'Criminal Defense',
  'Personal Injury',
  'Estate Planning',
  'Business / Corporate',
  'Real Estate',
  'Employment Law',
  'Bankruptcy',
  'Civil Litigation',
  'Other',
];

const STEPS = [
  { id: 1, label: 'Verify Email', icon: 'mail' },
  { id: 2, label: 'Your Profile', icon: 'user' },
  { id: 3, label: 'Retainer Terms', icon: 'file-text' },
  { id: 4, label: 'Payment Method', icon: 'credit-card' },
  { id: 5, label: 'Case Details', icon: 'briefcase' },
  { id: 6, label: 'All Set!', icon: 'check-circle' },
];

// ── Icon helpers ──────────────────────────────────────────────────────────────
function StepIcon({ name, size = 20 }: { name: string; size?: number }) {
  const s = size;
  if (name === 'mail') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
  if (name === 'user') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
  if (name === 'file-text') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  );
  if (name === 'credit-card') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
  if (name === 'briefcase') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
  if (name === 'check-circle') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
  if (name === 'check') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  if (name === 'arrow-right') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
  if (name === 'refresh') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
  if (name === 'shield') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
  if (name === 'lock') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
  return null;
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function StepProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between relative">
        {/* Connector line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary z-0 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map((step) => {
          const done = currentStep > step.id;
          const active = currentStep === step.id;
          return (
            <div key={step.id} className="flex flex-col items-center gap-2 z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  done
                    ? 'bg-primary border-primary text-primary-foreground'
                    : active
                    ? 'bg-card border-primary text-primary shadow-md shadow-primary/20'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {done ? <StepIcon name="check" size={16} /> : <StepIcon name={step.icon} size={16} />}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1: Verify Email ──────────────────────────────────────────────────────
function StepVerifyEmail({
  user,
  onNext,
  onResend,
  resending,
  resendSent,
}: {
  user: any;
  onNext: () => void;
  onResend: () => void;
  resending: boolean;
  resendSent: boolean;
}) {
  const isVerified = !!user?.email_confirmed_at;

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isVerified ? 'bg-emerald-50' : 'bg-primary/8'}`}>
          <StepIcon name={isVerified ? 'check-circle' : 'mail'} size={36} />
        </div>
      </div>
      <div>
        <h2 className="font-serif text-2xl text-foreground mb-2">
          {isVerified ? 'Email Verified!' : 'Verify Your Email'}
        </h2>
        <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
          {isVerified
            ? 'Your email address has been confirmed. You\'re ready to continue.'
            : `We sent a confirmation link to `}
          {!isVerified && <span className="font-medium text-foreground">{user?.email}</span>}
          {!isVerified && '. Click the link in that email to verify your account.'}
        </p>
      </div>

      {!isVerified && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 max-w-sm mx-auto">
          <p className="font-medium mb-1">Didn't receive the email?</p>
          <p className="text-xs text-amber-700 mb-3">Check your spam folder, or resend the verification link below.</p>
          <button
            onClick={onResend}
            disabled={resending || resendSent}
            className="inline-flex items-center gap-2 text-xs font-semibold text-amber-900 hover:underline disabled:opacity-60"
          >
            {resending ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <StepIcon name="refresh" size={12} />
            )}
            {resendSent ? 'Email sent!' : 'Resend verification email'}
          </button>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!isVerified}
        className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue <StepIcon name="arrow-right" size={16} />
      </button>

      {!isVerified && (
        <p className="text-xs text-muted-foreground">
          Already verified?{' '}
          <button onClick={() => window.location.reload()} className="text-primary hover:underline font-medium">
            Refresh this page
          </button>
        </p>
      )}
    </div>
  );
}

// ── Step 2: Profile Setup ─────────────────────────────────────────────────────
function StepProfile({
  onNext,
  saving,
  defaultValues,
}: {
  onNext: (data: { firmName: string; practiceArea: string; phone: string }) => void;
  saving: boolean;
  defaultValues: { firmName: string; practiceArea: string; phone: string };
}) {
  const [firmName, setFirmName] = useState(defaultValues.firmName);
  const [practiceArea, setPracticeArea] = useState(defaultValues.practiceArea);
  const [phone, setPhone] = useState(defaultValues.phone);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({ firmName, practiceArea, phone });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-serif text-2xl text-foreground mb-2">Set Up Your Profile</h2>
        <p className="text-sm text-muted-foreground font-light">
          Tell us a bit about yourself so we can personalize your experience.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Law Firm / Organization
          </label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="e.g. Smith & Associates"
            className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
          <p className="text-xs text-muted-foreground mt-1.5">Leave blank if you are an individual client.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Practice Area <span className="text-red-500">*</span>
          </label>
          <select
            value={practiceArea}
            onChange={(e) => setPracticeArea(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          >
            <option value="">Select a practice area…</option>
            {PRACTICE_AREAS.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            className="w-full px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !practiceArea}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <>Save & Continue <StepIcon name="arrow-right" size={16} /></>
          )}
        </button>
      </form>
    </div>
  );
}

// ── Step 3: Retainer Terms ────────────────────────────────────────────────────
function StepRetainerTerms({ onNext, saving }: { onNext: () => void; saving: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [acceptedPaymentTerms, setAcceptedPaymentTerms] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolled(true);
    }
  };

  const allAccepted = acceptedAgreement && acceptedPaymentTerms;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="font-serif text-2xl text-foreground mb-2">Review Retainer Agreement &amp; Payment Terms</h2>
        <p className="text-sm text-muted-foreground font-light">
          Please read the full agreement and payment terms carefully before proceeding to payment.
        </p>
      </div>

      {/* Payment Terms Summary Card */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 overflow-hidden">
        <div className="px-5 py-3 bg-primary/10 border-b border-primary/20 flex items-center gap-2">
          <StepIcon name="credit-card" size={16} />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground">Payment Terms Summary</span>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-card border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Billing Cycle</p>
              <p className="text-sm font-semibold text-foreground">Monthly</p>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Due Date</p>
              <p className="text-sm font-semibold text-foreground">1st of each month</p>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Overage Rate</p>
              <p className="text-sm font-semibold text-foreground">Per hourly tier</p>
            </div>
            <div className="rounded-lg bg-card border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Overage Invoice Due</p>
              <p className="text-sm font-semibold text-foreground">Within 14 days</p>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2 text-xs text-foreground/80">
              <StepIcon name="check" size={12} />
              <span>Initial retainer fee is charged at the time of payment setup (Step 4).</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-foreground/80">
              <StepIcon name="check" size={12} />
              <span>All fees are <strong>non-refundable</strong> once services have commenced.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-foreground/80">
              <StepIcon name="check" size={12} />
              <span>Unused retainer hours do <strong>not roll over</strong> to the following month.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-foreground/80">
              <StepIcon name="check" size={12} />
              <span>You will be notified when <strong>80% of included hours</strong> have been consumed.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-foreground/80">
              <StepIcon name="check" size={12} />
              <span>Your saved payment method will be charged automatically for recurring retainer fees and approved overages.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-foreground/80">
              <StepIcon name="check" size={12} />
              <span>Either party may terminate with <strong>30 days' written notice</strong>; unused prepaid amounts are refunded pro-rata.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable full retainer agreement */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Full Retainer Agreement</p>
        <div
          onScroll={handleScroll}
          className="h-64 overflow-y-auto rounded-xl border border-border bg-muted/30 p-5 text-sm text-foreground/80 space-y-4 leading-relaxed"
        >
          <h3 className="font-serif text-base font-semibold text-foreground">Paralegal Services Retainer Agreement</h3>
          <p className="text-xs text-muted-foreground">Broussard Legal Services · Effective June 1, 2026</p>

          <p><strong>1. Scope of Services.</strong> Broussard Legal Services ("Paralegal") agrees to provide paralegal support services as described in the applicable service order, including but not limited to document preparation, legal research, case management support, and administrative assistance. All services are performed under the supervision of a licensed attorney.</p>

          <p><strong>2. Retainer Fee.</strong> Client agrees to pay a monthly retainer fee as set forth in the selected service tier. The retainer is due on the first day of each billing period. Unused hours do not roll over to the following month unless otherwise agreed in writing.</p>

          <p><strong>3. Hourly Rates &amp; Overages.</strong> Services rendered beyond the included retainer hours will be billed at the applicable hourly rate. Paralegal will notify Client when 80% of included hours have been consumed. Overage invoices are due within 14 days of issuance.</p>

          <p><strong>4. Payment Terms.</strong> All fees are non-refundable once services have commenced. Client authorizes Paralegal to charge the payment method on file for recurring retainer fees and approved overage charges. The initial retainer fee is due at the time of payment setup. Subsequent monthly retainer fees are automatically charged on the first day of each billing period. Late payments may result in a temporary suspension of services until the outstanding balance is resolved.</p>

          <p><strong>5. Automatic Renewal.</strong> This retainer agreement renews automatically on a month-to-month basis unless either party provides written notice of termination at least 30 days prior to the next billing date. Renewal fees will be charged to the payment method on file at the then-current retainer rate.</p>

          <p><strong>6. Confidentiality.</strong> Paralegal agrees to maintain strict confidentiality of all client information and work product. Client information will not be disclosed to third parties without written consent, except as required by law.</p>

          <p><strong>7. No Attorney-Client Relationship.</strong> This agreement does not create an attorney-client relationship. Paralegal services are provided in a support capacity only. Clients are encouraged to seek independent legal counsel for legal advice.</p>

          <p><strong>8. Termination.</strong> Either party may terminate this agreement with 30 days' written notice. Upon termination, Client will be invoiced for all services rendered through the termination date. Prepaid retainer amounts for unused periods will be refunded on a pro-rated basis.</p>

          <p><strong>9. Limitation of Liability.</strong> Paralegal's liability shall not exceed the total fees paid in the three months preceding any claim. Paralegal is not liable for consequential, incidental, or punitive damages.</p>

          <p><strong>10. Dispute Resolution.</strong> In the event of a billing dispute, Client must notify Paralegal in writing within 30 days of the invoice date. Paralegal will review and respond within 10 business days. Undisputed amounts remain due and payable during the dispute resolution process.</p>

          <p><strong>11. Governing Law.</strong> This agreement is governed by the laws of the State of Louisiana. Any disputes shall be resolved in the courts of Lafayette Parish, Louisiana.</p>

          <p><strong>12. Entire Agreement.</strong> This agreement, together with any applicable service order, constitutes the entire agreement between the parties and supersedes all prior understandings.</p>

          <p className="text-xs text-muted-foreground pt-2">By accepting below, you acknowledge that you have read, understood, and agree to be bound by these terms and the payment terms summarized above.</p>
        </div>

        {!scrolled && (
          <p className="text-xs text-center text-muted-foreground mt-2">↓ Scroll to the bottom of the agreement to enable acceptance</p>
        )}
      </div>

      {/* Acceptance checkboxes */}
      <div className={`space-y-3 ${!scrolled ? 'opacity-50 pointer-events-none' : ''}`}>
        <label className="flex items-start gap-3 cursor-pointer group">
          <div
            onClick={() => scrolled && setAcceptedAgreement(!acceptedAgreement)}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
              acceptedAgreement ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
            }`}
          >
            {acceptedAgreement && <StepIcon name="check" size={12} />}
          </div>
          <span className="text-sm text-foreground/80">
            I have read and agree to the <strong>Retainer Agreement</strong> and authorize Broussard Legal Services to provide paralegal services under these terms.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div
            onClick={() => scrolled && setAcceptedPaymentTerms(!acceptedPaymentTerms)}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
              acceptedPaymentTerms ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
            }`}
          >
            {acceptedPaymentTerms && <StepIcon name="check" size={12} />}
          </div>
          <span className="text-sm text-foreground/80">
            I understand and agree to the <strong>Payment Terms</strong>, including the monthly billing cycle, non-refundable fee policy, automatic renewal, and overage billing described above.
          </span>
        </label>
      </div>

      <button
        onClick={onNext}
        disabled={!allAccepted || saving}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        ) : (
          <>Accept &amp; Proceed to Payment <StepIcon name="arrow-right" size={16} /></>
        )}
      </button>
    </div>
  );
}

// ── Step 4: Payment Method (real Stripe PaymentElement) ───────────────────────
interface RetainerPaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onSkip: () => void;
}

function RetainerPaymentForm({
  clientSecret,
  amount,
  onSuccess,
  onSkip,
}: RetainerPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setPaymentError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/portal/onboarding`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setPaymentError(error.message ?? 'Payment failed. Please try again.');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else {
      setPaymentError('Payment could not be confirmed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-2">
        <StepIcon name="lock" size={12} />
        <span>256-bit SSL encryption · Powered by Stripe</span>
        <StepIcon name="shield" size={12} />
      </div>

      {/* Retainer amount badge */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
        <span className="text-sm font-medium text-foreground">Initial Retainer Fee</span>
        <span className="text-lg font-bold text-primary">${amount.toFixed(2)}</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {paymentError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {paymentError}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <>
            <StepIcon name="lock" size={14} /> Pay ${amount.toFixed(2)} &amp; Continue
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
      >
        Skip for now — I'll pay later
      </button>
    </form>
  );
}

interface StepPaymentMethodProps {
  onNext: () => void;
  onSkip: () => void;
  saving: boolean;
  user: { id: string; email?: string } | null;
  onboardingProfile: { firmName: string } | null;
}

function StepPaymentMethod({
  onNext,
  onSkip,
  saving,
  user,
  onboardingProfile,
}: StepPaymentMethodProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState(500);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(true);
  const stripePromise = getStripe();

  useEffect(() => {
    if (!user) return;

    const fetchIntent = async () => {
      setLoadingIntent(true);
      setLoadError(null);
      try {
        const nameParts = (user.email ?? '').split('@')[0].split('.');
        const firstName = nameParts[0] ?? 'Client';
        const lastName = nameParts[1] ?? 'User';

        const res = await fetch('/api/onboarding/retainer-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, lastName }),
        });

        const data = await res.json() as { clientSecret?: string; amount?: number; error?: string };

        if (!res.ok || data.error) {
          throw new Error(data.error ?? 'Failed to initialize payment');
        }

        setClientSecret(data.clientSecret ?? null);
        if (data.amount) setAmount(data.amount);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Payment setup failed';
        setLoadError(msg);
      } finally {
        setLoadingIntent(false);
      }
    };

    fetchIntent();
  }, [user]);

  if (loadingIntent) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="font-serif text-2xl text-foreground mb-2">Link a Payment Method</h2>
          <p className="text-sm text-muted-foreground font-light">
            Securely save a card for retainer billing and invoice payments.
          </p>
        </div>
        <div className="flex justify-center py-10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="font-serif text-2xl text-foreground mb-2">Payment Setup</h2>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700 text-center">
          <p className="font-medium mb-1">Unable to initialize payment</p>
          <p className="text-xs">{loadError}</p>
        </div>
        <button
          onClick={onSkip}
          className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
        >
          Skip for now — I'll pay later
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="font-serif text-2xl text-foreground mb-2">Link a Payment Method</h2>
        <p className="text-sm text-muted-foreground font-light">
          Securely pay your initial retainer fee to activate your portal.
        </p>
      </div>

      {clientSecret ? (
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
          <RetainerPaymentForm
            clientSecret={clientSecret}
            amount={amount}
            onSuccess={onNext}
            onSkip={onSkip}
          />
        </Elements>
      ) : (
        <button
          onClick={onSkip}
          className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
        >
          Skip for now — I'll pay later
        </button>
      )}
    </div>
  );
}

// ── Step 5: Case Details ──────────────────────────────────────────────────────
function StepCaseDetails({
  inquiry,
  onNext,
  saving,
}: {
  inquiry: Inquiry | null;
  onNext: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-serif text-2xl text-foreground mb-2">Confirm Your Case</h2>
        <p className="text-sm text-muted-foreground font-light">
          Review the case details linked to your portal account.
        </p>
      </div>

      {inquiry ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Case header */}
          <div className="px-5 py-4 bg-primary/5 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Active Case</p>
                <h3 className="font-serif text-lg text-foreground">{inquiry.name}</h3>
                {inquiry.firm && (
                  <p className="text-sm text-muted-foreground">{inquiry.firm}</p>
                )}
              </div>
              <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                inquiry.status === 'contacted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                inquiry.status === 'in_review'? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {inquiry.status === 'contacted' ? 'In Progress' : inquiry.status === 'in_review' ? 'In Review' : 'Received'}
              </span>
            </div>
          </div>

          {/* Case details */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Service Requested</span>
              <span className="font-medium text-foreground">{inquiry.service}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Case Opened</span>
              <span className="font-medium text-foreground">
                {new Date(inquiry.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <StepIcon name="briefcase" size={32} />
          <p className="mt-3 text-sm text-muted-foreground">
            No case has been linked to your account yet. Your attorney will connect your case after your consultation.
          </p>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground/80">
        <p className="font-medium mb-1">What happens next?</p>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2"><StepIcon name="check" size={12} /><span>Your portal dashboard will be activated with full case access</span></li>
          <li className="flex items-start gap-2"><StepIcon name="check" size={12} /><span>You can view documents, invoices, and case timeline</span></li>
          <li className="flex items-start gap-2"><StepIcon name="check" size={12} /><span>Maggi May will be notified that you've completed onboarding</span></li>
        </ul>
      </div>

      <button
        onClick={onNext}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        ) : (
          <>Confirm &amp; Finish <StepIcon name="arrow-right" size={16} /></>
        )}
      </button>
    </div>
  );
}

// ── Step 6: All Done ──────────────────────────────────────────────────────────
function StepAllDone({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <StepIcon name="check-circle" size={44} />
          </div>
          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
            <StepIcon name="check" size={14} />
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-3xl text-foreground mb-3">Welcome to Your Portal!</h2>
        <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
          Your account is fully set up. You now have access to your case files, documents, invoices, and retainer status — all in one place.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
        {[
          { label: 'Cases', icon: 'briefcase' },
          { label: 'Documents', icon: 'file-text' },
          { label: 'Billing', icon: 'credit-card' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center text-primary">
              <StepIcon name={item.icon} size={18} />
            </div>
            <span className="text-xs font-medium text-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onGoToDashboard}
        className="inline-flex items-center gap-2 px-10 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 shadow-md shadow-primary/20"
      >
        Go to My Dashboard <StepIcon name="arrow-right" size={16} />
      </button>
    </div>
  );
}

// ── Main Onboarding Page ──────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  // Load or create onboarding record
  const loadOnboarding = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();

      // Load or create onboarding record
      let { data: ob, error: obErr } = await supabase
        .from('client_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (obErr) throw obErr;

      if (!ob) {
        const { data: newOb, error: insertErr } = await supabase
          .from('client_onboarding')
          .insert({ user_id: user.id, email_verified: !!user.email_confirmed_at })
          .select()
          .single();
        if (insertErr) throw insertErr;
        ob = newOb;
      }

      setOnboarding(ob);

      // Determine current step from saved state
      if (ob.onboarding_complete) {
        router.replace('/portal/dashboard');
        return;
      }

      if (!ob.email_verified || !user.email_confirmed_at) {
        setCurrentStep(1);
      } else if (!ob.profile_completed) {
        setCurrentStep(2);
      } else if (!ob.retainer_accepted) {
        setCurrentStep(3);
      } else if (!ob.payment_linked) {
        setCurrentStep(4);
      } else if (!ob.case_confirmed) {
        setCurrentStep(5);
      } else {
        setCurrentStep(6);
      }

      // Load linked inquiry
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessData?.inquiry_id) {
        const { data: inq } = await supabase
          .from('contact_inquiries')
          .select('id, name, firm, service, status, created_at')
          .eq('id', accessData.inquiry_id)
          .single();
        if (inq) setInquiry(inq);
      }
    } catch (err) {
      console.error('Onboarding load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/portal/login');
    }
    if (!authLoading && user) {
      loadOnboarding();
    }
  }, [user, authLoading, loadOnboarding, router]);

  const updateOnboarding = async (patch: Partial<OnboardingState>) => {
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('client_onboarding')
      .update(patch)
      .eq('user_id', user.id);
    if (error) throw error;
    setOnboarding((prev) => prev ? { ...prev, ...patch } : prev);
  };

  // Step handlers
  const handleEmailVerified = async () => {
    setSaving(true);
    try {
      await updateOnboarding({ email_verified: true });
      setCurrentStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (data: { firmName: string; practiceArea: string; phone: string }) => {
    setSaving(true);
    try {
      await updateOnboarding({
        profile_completed: true,
        firm_name: data.firmName,
        practice_area: data.practiceArea,
        phone: data.phone,
      });
      setCurrentStep(3);
    } finally {
      setSaving(false);
    }
  };

  const handleRetainerAccepted = async () => {
    setSaving(true);
    try {
      await updateOnboarding({ retainer_accepted: true });
      setCurrentStep(4);
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentLinked = async () => {
    setSaving(true);
    try {
      await updateOnboarding({ payment_linked: true });
      setCurrentStep(5);
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSkipped = async () => {
    setSaving(true);
    try {
      await updateOnboarding({ payment_linked: true });
      setCurrentStep(5);
    } finally {
      setSaving(false);
    }
  };

  const handleCaseConfirmed = async () => {
    setSaving(true);
    try {
      await updateOnboarding({ case_confirmed: true, onboarding_complete: true });
      setCurrentStep(6);

      // Send branded welcome email with portal login details, retainer terms, and quick-start guide
      if (user?.email) {
        const firstName = (user.user_metadata?.full_name || user.email).split(/[\s@]/)[0];
        fetch('/api/onboarding/welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            firstName,
            firmName: onboarding?.firm_name ?? '',
            practiceArea: onboarding?.practice_area ?? '',
            service: inquiry?.service ?? '',
          }),
        }).catch((err) => console.error('Welcome email failed (non-blocking):', err));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: 'signup', email: user.email });
      setResendSent(true);
      setTimeout(() => setResendSent(false), 8000);
    } finally {
      setResending(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 md:px-10 py-5 border-b border-border/40">
        <div className="flex items-center justify-between max-w-3xl mx-auto w-full">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <AppLogo size={32} className="transition-transform duration-300 group-hover:scale-105" />
            <span className="font-serif text-base tracking-tight" style={{ color: '#355E3B' }}>
              Maggi May Broussard
            </span>
          </Link>
          <span className="text-xs text-muted-foreground font-medium">
            Step {currentStep} of {STEPS.length}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 py-10">
        <div className="w-full max-w-2xl">
          {/* Welcome badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-xs font-semibold uppercase tracking-widest text-primary">
              <StepIcon name="check-circle" size={12} />
              Account Setup
            </span>
          </div>

          {/* Progress bar */}
          <StepProgressBar currentStep={currentStep} />

          {/* Step card */}
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            {currentStep === 1 && (
              <StepVerifyEmail
                user={user}
                onNext={handleEmailVerified}
                onResend={handleResendVerification}
                resending={resending}
                resendSent={resendSent}
              />
            )}
            {currentStep === 2 && (
              <StepProfile
                onNext={handleProfileSave}
                saving={saving}
                defaultValues={{
                  firmName: onboarding?.firm_name ?? '',
                  practiceArea: onboarding?.practice_area ?? '',
                  phone: onboarding?.phone ?? '',
                }}
              />
            )}
            {currentStep === 3 && (
              <StepRetainerTerms onNext={handleRetainerAccepted} saving={saving} />
            )}
            {currentStep === 4 && (
              <StepPaymentMethod onNext={handlePaymentLinked} onSkip={handlePaymentSkipped} saving={saving} user={user} onboardingProfile={onboarding} />
            )}
            {currentStep === 5 && (
              <StepCaseDetails inquiry={inquiry} onNext={handleCaseConfirmed} saving={saving} />
            )}
            {currentStep === 6 && (
              <StepAllDone onGoToDashboard={() => {
                // Mark onboarding complete in localStorage so dashboard doesn't redirect again
                try {
                  if (user?.id) {
                    localStorage.setItem(`onboarding_complete_${user.id}`, 'true');
                  }
                } catch { /* ignore */ }
                router.push('/portal/welcome');
              }} />
            )}
          </div>

          {/* Footer note */}
          {currentStep < 6 && (
            <p className="text-center text-xs text-muted-foreground mt-6">
              Need help?{' '}
              <a href="mailto:broussardlegalservices@gmail.com" className="text-primary hover:underline font-medium">
                Contact support
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
