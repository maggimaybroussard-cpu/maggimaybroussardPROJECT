'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { PAYMENT_OPTIONS } from '@/components/PaymentModal';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface ServiceRecommendation {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeColor: string;
  href: string;
  cta: string;
  highlight?: boolean;
}

interface CaseTypeConfig {
  heading: string;
  subheading: string;
  context: string;
  recommendations: ServiceRecommendation[];
}

/* ─── Icons ──────────────────────────────────────────────────────────── */
const IconResearch = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const IconDocument = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconCalendar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconBriefcase = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconLayers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const IconClock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconStar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ─── Recommendations by payment type ───────────────────────────────── */
const CASE_TYPE_CONFIGS: Record<string, CaseTypeConfig> = {
  consultation_deposit: {
    heading: 'Make the most of your consultation',
    subheading: 'Clients who prepare ahead get 3× more value from their session.',
    context: 'You\'ve secured your consultation slot. Here\'s how to arrive prepared and hit the ground running.',
    recommendations: [
      {
        id: 'intake',
        icon: <IconDocument />,
        title: 'Complete Your Intake Form',
        subtitle: 'Case background & goals',
        description: 'Submit your case details before the call so we can skip the basics and dive straight into strategy. Takes 5 minutes — saves 20.',
        badge: 'Recommended First',
        badgeColor: '#355E3B',
        href: '/intake',
        cta: 'Start Intake Form',
        highlight: true,
      },
      {
        id: 'research',
        icon: <IconResearch />,
        title: 'Legal Research Add-On',
        subtitle: 'Pre-consultation memo',
        description: 'Have a targeted research memo ready before your call. We\'ll identify key statutes, case law, and risk factors specific to your matter.',
        badge: 'Popular Add-On',
        badgeColor: '#C8965A',
        href: '/pricing',
        cta: 'Add Research',
      },
      {
        id: 'documents',
        icon: <IconLayers />,
        title: 'Document Review Package',
        subtitle: 'Contracts, filings & pleadings',
        description: 'Send us your existing documents ahead of the consultation. We\'ll flag issues, inconsistencies, and opportunities before you arrive.',
        badge: 'Save Time',
        badgeColor: '#6B7280',
        href: '/services',
        cta: 'Learn More',
      },
      {
        id: 'retainer',
        icon: <IconBriefcase />,
        title: 'Monthly Retainer',
        subtitle: 'Ongoing paralegal support',
        description: 'Most clients who consult with us move to a retainer within 30 days. Lock in your rate now and skip the onboarding process after your call.',
        badge: 'Best Value',
        badgeColor: '#355E3B',
        href: '/checkout?type=retainer',
        cta: 'View Retainer Plans',
      },
    ],
  },
  retainer: {
    heading: 'Your retainer is active — here\'s what\'s next',
    subheading: 'Maximize your monthly hours with these high-impact services.',
    context: 'Your retainer gives you priority access to the full suite of paralegal services. Here\'s how to get the most from your engagement.',
    recommendations: [
      {
        id: 'onboarding',
        icon: <IconCalendar />,
        title: 'Schedule Your Onboarding Call',
        subtitle: 'Align on priorities & timelines',
        description: 'Book your onboarding session to map out active matters, set deadlines, and establish your preferred communication workflow.',
        badge: 'Do This First',
        badgeColor: '#355E3B',
        href: '/availability',
        cta: 'Book Onboarding Call',
        highlight: true,
      },
      {
        id: 'portal',
        icon: <IconShield />,
        title: 'Access Your Client Portal',
        subtitle: 'Documents, invoices & cases',
        description: 'Your secure portal is ready. Upload case files, track deliverables, review invoices, and sign documents — all in one place.',
        badge: 'Included',
        badgeColor: '#355E3B',
        href: '/portal/dashboard',
        cta: 'Open Portal',
      },
      {
        id: 'trial-prep',
        icon: <IconStar />,
        title: 'Trial Prep Bundle',
        subtitle: 'Exhibit binders, witness outlines & timeline',
        description: 'If you have an upcoming trial, let\'s start prep now. Exhibit organization, witness outlines, and trial timelines — all covered under your retainer.',
        badge: 'High Impact',
        badgeColor: '#C8965A',
        href: '/services',
        cta: 'Start Trial Prep',
      },
      {
        id: 'rush',
        icon: <IconClock />,
        title: 'Rush Delivery Add-On',
        subtitle: 'Same-day or next-morning turnaround',
        description: 'Need something fast? Add rush delivery to any deliverable in your retainer. Available for research memos, motions, and document reviews.',
        badge: 'Available Now',
        badgeColor: '#6B7280',
        href: '/pricing',
        cta: 'Add Rush Delivery',
      },
    ],
  },
};

const DEFAULT_CONFIG = CASE_TYPE_CONFIGS.consultation_deposit;

/* ─── Recommendation Card ────────────────────────────────────────────── */
interface RecommendationCardProps {
  rec: ServiceRecommendation;
  index: number;
}

function RecommendationCard({ rec, index }: RecommendationCardProps) {
  return (
    <div
      className="group relative rounded-2xl border bg-background transition-all duration-300 hover:shadow-md overflow-hidden flex flex-col"
      style={{
        borderColor: rec.highlight ? 'rgba(53,94,59,0.35)' : 'var(--border)',
        background: rec.highlight ? 'rgba(53,94,59,0.025)' : undefined,
        animationDelay: `${index * 80}ms`,
      }}
    >
      {rec.highlight && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #355E3B, rgba(53,94,59,0.3))' }}
        />
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 group-hover:scale-105"
            style={{
              background: rec.highlight ? 'rgba(53,94,59,0.12)' : 'rgba(53,94,59,0.07)',
              color: '#355E3B',
              transform: 'scale(1)',
              transition: 'transform 0.2s ease',
            }}
          >
            {rec.icon}
          </div>
          <span
            className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0"
            style={{ background: `${rec.badgeColor}18`, color: rec.badgeColor }}
          >
            {rec.badge}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-1">
            {rec.subtitle}
          </p>
          <h3 className="font-serif text-lg text-foreground mb-2 leading-snug">
            {rec.title}
          </h3>
          <p className="text-sm text-muted-foreground font-light leading-relaxed">
            {rec.description}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-5 pt-4 border-t border-border">
          <Link
            href={rec.href}
            className="inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 group/link"
            style={{ color: '#355E3B' }}
          >
            {rec.cta}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-200 group-hover/link:translate-x-1"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Main content ───────────────────────────────────────────────────── */
function FollowUpContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<CaseTypeConfig>(DEFAULT_CONFIG);
  const [paymentLabel, setPaymentLabel] = useState('');
  const [clientName, setClientName] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const paymentType = searchParams.get('payment_type') ?? 'consultation_deposit';
    const name = searchParams.get('name') ?? '';
    const option = PAYMENT_OPTIONS.find((o) => o.type === paymentType);

    setPaymentLabel(option?.label ?? 'your service');
    setClientName(name ? name.split(' ')[0] : '');
    setConfig(CASE_TYPE_CONFIGS[paymentType] ?? DEFAULT_CONFIG);
  }, [searchParams]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const highlightedRec = config.recommendations.find((r) => r.highlight);
  const otherRecs = config.recommendations.filter((r) => !r.highlight);

  return (
    <main className="pt-28 pb-24 px-6 md:px-10 max-w-4xl mx-auto">

      {/* Breadcrumb trail */}
      <div className="flex items-center gap-2 mb-10 text-xs text-muted-foreground font-light">
        <Link href="/payment-confirmation" className="hover:text-foreground transition-colors flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Payment Confirmed
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-foreground font-medium">Recommended Next Steps</span>
      </div>

      {/* Hero section */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
          >
            <IconStar />
          </div>
          <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
            Personalized for {paymentLabel}
          </span>
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3 leading-tight">
          {clientName ? `${clientName}, ` : ''}{config.heading}
        </h1>
        <p className="text-muted-foreground font-light leading-relaxed max-w-xl text-base">
          {config.subheading}
        </p>
      </div>

      {/* Context strip */}
      <div
        className="rounded-xl px-5 py-4 mb-10 flex items-start gap-3"
        style={{ background: 'rgba(53,94,59,0.06)', border: '1px solid rgba(53,94,59,0.12)' }}
      >
        <div className="shrink-0 mt-0.5" style={{ color: '#355E3B' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm text-foreground font-light leading-relaxed">
          {config.context}
        </p>
      </div>

      {/* Highlighted recommendation — full width */}
      {highlightedRec && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">
            Start Here
          </p>
          <div
            className="group relative rounded-2xl border overflow-hidden"
            style={{ borderColor: 'rgba(53,94,59,0.35)', background: 'rgba(53,94,59,0.025)' }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{ background: 'linear-gradient(90deg, #355E3B, rgba(53,94,59,0.3))' }}
            />
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
              >
                {highlightedRec.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
                  >
                    {highlightedRec.badge}
                  </span>
                  <span className="text-xs text-muted-foreground font-light">{highlightedRec.subtitle}</span>
                </div>
                <h2 className="font-serif text-xl md:text-2xl text-foreground mb-2">
                  {highlightedRec.title}
                </h2>
                <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-lg">
                  {highlightedRec.description}
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  href={highlightedRec.href}
                  className="inline-flex items-center gap-2.5 px-7 py-3 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90 shadow-md whitespace-nowrap"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {highlightedRec.cta}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other recommendations grid */}
      {otherRecs.length > 0 && (
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">
            Also Recommended
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherRecs.map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav strip */}
      <div
        className="rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ background: 'rgba(53,94,59,0.04)', border: '1px solid rgba(53,94,59,0.1)' }}
      >
        <div>
          <p className="text-sm font-semibold text-foreground mb-0.5">Not sure where to start?</p>
          <p className="text-xs text-muted-foreground font-light">
            We respond within one business day — reach out and we&apos;ll guide you.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest border transition-all duration-200 hover:bg-white/60 text-foreground"
            style={{ borderColor: 'rgba(53,94,59,0.25)', background: 'rgba(255,255,255,0.4)' }}
          >
            Contact Us
          </Link>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
            style={{ background: '#355E3B', color: '#fff' }}
          >
            View All Services
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentFollowUpPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center pt-28">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        }
      >
        <FollowUpContent />
      </Suspense>
      <Footer />
    </>
  );
}
