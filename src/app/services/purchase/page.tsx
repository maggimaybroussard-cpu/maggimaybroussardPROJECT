'use client';

import React, { useState, FormEvent, Suspense } from 'react';
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

/* ─── Service Packages ───────────────────────────────────────────────── */
export interface ServicePackage {
  id: string;
  name: string;
  tagline: string;
  price: number;
  deliverable: string;
  turnaround: string;
  badge?: string;
  popular?: boolean;
  features: string[];
  category: string;
}

export const SERVICE_PACKAGES: ServicePackage[] = [
  {
    id: 'legal-research-memo',
    name: 'Legal Research Memo',
    tagline: 'Comprehensive case law & statutory analysis',
    price: 350,
    deliverable: 'Written research memo (10–20 pages)',
    turnaround: '3–5 business days',
    category: 'Research',
    features: [
      'Case law research on your specific issue',
      'Statutory & regulatory analysis',
      'Jurisdiction-specific findings',
      'Formatted legal memo with citations',
      'One round of follow-up questions',
    ],
  },
  {
    id: 'motion-drafting',
    name: 'Motion Drafting',
    tagline: 'Court-ready motions drafted to your specs',
    price: 500,
    deliverable: 'Fully drafted motion with supporting brief',
    turnaround: '3–5 business days',
    category: 'Drafting',
    popular: true,
    badge: 'Most Requested',
    features: [
      'Motion to dismiss, compel, or summary judgment',
      'Supporting memorandum of law',
      'Proper court formatting & citations',
      'Editable Word document delivered',
      'One revision included',
    ],
  },
  {
    id: 'discovery-package',
    name: 'Discovery Package',
    tagline: 'Interrogatories, RFPs & privilege log',
    price: 650,
    deliverable: 'Complete discovery set + privilege log template',
    turnaround: '5–7 business days',
    category: 'Discovery',
    features: [
      'Interrogatories (up to 25)',
      'Requests for production (up to 25)',
      'Requests for admission (up to 15)',
      'Privilege log template',
      'Tailored to your matter facts',
    ],
  },
  {
    id: 'contract-review',
    name: 'Contract Review & Summary',
    tagline: 'Plain-language summary with risk flags',
    price: 275,
    deliverable: 'Annotated contract + executive summary',
    turnaround: '2–3 business days',
    category: 'Contracts',
    features: [
      'Contracts up to 30 pages',
      'Key terms & obligations highlighted',
      'Risk flags and red-line suggestions',
      'Plain-language executive summary',
      'Delivered in Word & PDF',
    ],
  },
  {
    id: 'deposition-prep',
    name: 'Deposition Prep Package',
    tagline: 'Witness outlines & deposition summaries',
    price: 450,
    deliverable: 'Witness outline + deposition summary',
    turnaround: '3–5 business days',
    category: 'Litigation',
    features: [
      'Deposition summary (up to 200 pages transcript)',
      'Key testimony highlights',
      'Witness preparation outline',
      'Credibility & impeachment notes',
      'Formatted for trial use',
    ],
  },
  {
    id: 'client-intake-bundle',
    name: 'Client Intake Bundle',
    tagline: 'Intake questionnaire + welcome packet',
    price: 200,
    deliverable: 'Custom intake forms + onboarding docs',
    turnaround: '2–3 business days',
    category: 'Admin',
    features: [
      'Custom intake questionnaire (your practice area)',
      'Client welcome letter template',
      'Fee agreement template',
      'Engagement checklist',
      'Editable Word & PDF formats',
    ],
  },
];

const TRUST_BADGES = [
  { icon: '🔒', label: 'SSL Encrypted' },
  { icon: '⚡', label: 'Instant Confirmation' },
  { icon: '✅', label: 'Stripe Secured' },
  { icon: '📄', label: 'Receipt Emailed' },
];

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
  notes: string;
}

/* ─── Stripe Payment Form ────────────────────────────────────────────── */
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
      confirmParams: { return_url: `${window.location.origin}/payment-confirmation` },
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
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
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
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe · SSL encrypted · PCI compliant
      </p>
    </form>
  );
}

/* ─── Main Purchase Content ──────────────────────────────────────────── */
function PurchaseContent() {
  const searchParams = useSearchParams();
  const preSelected = searchParams.get('service');

  const initialService = preSelected
    ? SERVICE_PACKAGES.find((s) => s.id === preSelected) ?? null
    : null;

  const [step, setStep] = useState<'browse' | 'details' | 'payment' | 'success'>(
    initialService ? 'details' : 'browse'
  );
  const [selectedService, setSelectedService] = useState<ServicePackage | null>(initialService);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [successIntent, setSuccessIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

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
    notes: '',
  });

  const stripePromise = getStripe();

  const categories = ['All', ...Array.from(new Set(SERVICE_PACKAGES.map((s) => s.category)))];
  const filteredServices =
    activeCategory === 'All'
      ? SERVICE_PACKAGES
      : SERVICE_PACKAGES.filter((s) => s.category === activeCategory);

  const handleSelectService = (service: ServicePackage) => {
    setSelectedService(service);
    setStep('details');
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDetailsSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedService) return;
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
            amount: selectedService.price,
            currency: 'usd',
            tableName: 'payments',
            description: `Paralegal Service: ${selectedService.name}`,
            additionalFields: {
              payment_type: 'paralegal_service',
              service_id: selectedService.id,
              service_name: selectedService.name,
              firm_name: formData.firmName,
              notes: formData.notes,
            },
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePaymentError = (msg: string) => {
    setError(msg);
  };

  /* ── Browse ── */
  if (step === 'browse') {
    return (
      <div>
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-5"
            style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
          >
            À La Carte Services
          </span>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight mb-4">
            Purchase Paralegal Services
            <br />
            <span className="italic" style={{ color: '#355E3B' }}>Directly Online</span>
          </h1>
          <p className="text-muted-foreground font-light leading-relaxed text-base md:text-lg max-w-2xl mx-auto">
            Select a service package below, complete your details, and pay securely via Stripe. Work begins within one business day of confirmed payment.
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 border"
              style={
                activeCategory === cat
                  ? { background: '#355E3B', color: '#fff', borderColor: '#355E3B' }
                  : { background: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="relative rounded-2xl border border-border bg-background p-6 flex flex-col shadow-sm hover:shadow-md transition-all duration-200"
              style={service.popular ? { borderColor: 'rgba(53,94,59,0.4)' } : {}}
            >
              {service.badge && (
                <span
                  className="absolute -top-3 left-5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {service.badge}
                </span>
              )}

              <div className="mb-4">
                <span
                  className="inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-3"
                  style={{ background: 'rgba(53,94,59,0.08)', color: '#355E3B' }}
                >
                  {service.category}
                </span>
                <h3 className="font-serif text-xl text-foreground mb-1">{service.name}</h3>
                <p className="text-sm text-muted-foreground font-light">{service.tagline}</p>
              </div>

              <div className="mb-4">
                <p className="text-3xl font-semibold" style={{ color: '#355E3B' }}>
                  ${service.price.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">flat fee · USD</p>
              </div>

              <div className="mb-4 space-y-1.5 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Includes</p>
                {service.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-foreground font-light">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </div>
                ))}
              </div>

              <div
                className="rounded-xl p-3 mb-5 text-xs text-muted-foreground"
                style={{ background: 'rgba(53,94,59,0.04)', border: '1px solid rgba(53,94,59,0.1)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="font-medium text-foreground">Deliverable:</span> {service.deliverable}
                </div>
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="font-medium text-foreground">Turnaround:</span> {service.turnaround}
                </div>
              </div>

              <button
                onClick={() => handleSelectService(service)}
                className="w-full py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                Purchase Now
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div
          className="mt-14 rounded-2xl p-8 text-center"
          style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.12)' }}
        >
          <p className="font-serif text-xl text-foreground mb-2">Need a custom scope?</p>
          <p className="text-sm text-muted-foreground font-light mb-5">
            Have a complex matter that doesn&apos;t fit a package? Book a consultation and we&apos;ll build a custom quote.
          </p>
          <Link
            href="/book-consultation"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border transition-all duration-200 hover:bg-primary/5"
            style={{ borderColor: '#355E3B', color: '#355E3B' }}
          >
            Book a Consultation
          </Link>
        </div>
      </div>
    );
  }

  /* ── Details ── */
  if (step === 'details' && selectedService) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => { setStep('browse'); setError(null); }}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Services
        </button>

        {/* Order summary */}
        <div
          className="rounded-2xl p-5 mb-7 flex items-start justify-between gap-4"
          style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}
        >
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              {selectedService.category}
            </p>
            <p className="font-serif text-lg text-foreground">{selectedService.name}</p>
            <p className="text-sm text-muted-foreground font-light mt-0.5">{selectedService.tagline}</p>
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-medium text-foreground">Turnaround:</span> {selectedService.turnaround}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-semibold" style={{ color: '#355E3B' }}>
              ${selectedService.price.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">USD · flat fee</p>
          </div>
        </div>

        <h2 className="font-serif text-2xl text-foreground mb-6">Your Details</h2>

        <form onSubmit={handleDetailsSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">First Name *</label>
              <input
                type="text" required
                value={formData.firstName}
                onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="Jane"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Last Name *</label>
              <input
                type="text" required
                value={formData.lastName}
                onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="Smith"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Email Address *</label>
            <input
              type="email" required
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="Smith & Associates LLP (optional)"
              autoComplete="organization"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Billing Address *</label>
            <input
              type="text" required
              value={formData.addressLine1}
              onChange={(e) => setFormData((p) => ({ ...p, addressLine1: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="123 Main Street"
              autoComplete="street-address"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">City *</label>
              <input
                type="text" required
                value={formData.city}
                onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="New Orleans"
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">State *</label>
              <input
                type="text" required
                value={formData.state}
                onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                placeholder="LA"
                maxLength={2}
                autoComplete="address-level1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">ZIP Code *</label>
              <input
                type="text" required
                value={formData.postalCode}
                onChange={(e) => setFormData((p) => ({ ...p, postalCode: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                autoComplete="country"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
              Matter Notes <span className="normal-case font-normal">(optional — describe your matter)</span>
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none"
              placeholder="Brief description of your matter, jurisdiction, or any specific instructions…"
            />
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
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
    );
  }

  /* ── Payment ── */
  if (step === 'payment' && clientSecret && selectedService) {
    return (
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => { setStep('details'); setError(null); setClientSecret(null); }}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Details
        </button>

        <div
          className="rounded-2xl p-5 mb-7 flex items-center justify-between"
          style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.15)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              {selectedService.name}
            </p>
            <p className="text-xs text-muted-foreground font-light">
              {formData.firstName} {formData.lastName} · {formData.email}
            </p>
          </div>
          <p className="text-2xl font-semibold shrink-0 ml-4" style={{ color: '#355E3B' }}>
            ${selectedService.price.toLocaleString()}
          </p>
        </div>

        <h2 className="font-serif text-2xl text-foreground mb-6">Payment Details</h2>

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

  /* ── Success ── */
  if (step === 'success' && selectedService) {
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
          Your purchase of <strong>{selectedService.name}</strong> for{' '}
          <strong>${selectedService.price.toLocaleString()}</strong> has been processed.
        </p>
        <p className="text-sm text-muted-foreground font-light mb-3">
          Work begins within <strong>1 business day</strong>. Deliverable expected in{' '}
          <strong>{selectedService.turnaround}</strong>.
        </p>
        <p className="text-sm text-muted-foreground font-light mb-8">
          A receipt has been sent to{' '}
          <span className="font-medium text-foreground">{formData.email}</span>.
        </p>

        {successIntent && (
          <p className="text-xs text-muted-foreground font-mono mb-8 bg-muted/40 rounded-lg px-4 py-2.5 inline-block">
            Ref: {successIntent.id.slice(-12).toUpperCase()}
          </p>
        )}

        <div className="flex flex-col gap-3 justify-center">
          <button
            onClick={() => {
              setStep('browse');
              setSelectedService(null);
              setClientSecret(null);
              setSuccessIntent(null);
              setFormData({ firstName: '', lastName: '', email: '', firmName: '', addressLine1: '', city: '', state: '', postalCode: '', country: 'US', notes: '' });
            }}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-md"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            Purchase Another Service
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold uppercase tracking-widest border border-border hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-foreground"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Page Wrapper ───────────────────────────────────────────────────── */
export default function ServicesPurchasePage() {
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
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 text-xs font-medium uppercase tracking-widest mb-3 transition-colors duration-200"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                  Back to Services
                </Link>
                <h1 className="font-serif text-2xl md:text-4xl text-white leading-tight">
                  Purchase Paralegal Services
                </h1>
                <p className="text-white/70 text-sm font-light mt-1.5">
                  Flat-fee packages · Secure Stripe checkout · Work begins within 1 business day
                </p>
              </div>
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
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-10 md:py-16 px-4 md:px-10">
          <div className="max-w-6xl mx-auto">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              }
            >
              <PurchaseContent />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
