'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  accentLight: '#F5EDE0',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  green: '#355E3B',
  greenLight: '#EAF2EB',
};

interface StatusConfig {
  icon: string;
  iconBg: string;
  iconColor: string;
  heading: string;
  body: string;
  cta: { label: string; href: string } | null;
  showResend?: boolean;
  autoRedirect?: boolean;
  steps?: { label: string; done: boolean }[];
}

const STATUS_MAP: Record<string, StatusConfig> = {
  confirmed: {
    icon: '✓',
    iconBg: brand.greenLight,
    iconColor: brand.green,
    heading: 'Email Confirmed!',
    body: 'Your email address has been verified. Welcome to the Maggi May Broussard community — your Paralegal Readiness Checklist and resource series are on their way to your inbox.',
    cta: { label: 'Book a Free Consultation', href: '/availability' },
    autoRedirect: true,
    steps: [
      { label: 'Email submitted', done: true },
      { label: 'Confirmation sent', done: true },
      { label: 'Email verified', done: true },
      { label: 'Resources on the way', done: true },
    ],
  },
  already_confirmed: {
    icon: '✓',
    iconBg: brand.accentLight,
    iconColor: brand.accent,
    heading: 'Already Verified',
    body: 'Your email address was already confirmed. You\'re all set — keep an eye on your inbox for upcoming resources and legal tips.',
    cta: { label: 'Explore Services', href: '/services' },
    steps: [
      { label: 'Email submitted', done: true },
      { label: 'Confirmation sent', done: true },
      { label: 'Email verified', done: true },
      { label: 'Resources on the way', done: true },
    ],
  },
  invalid: {
    icon: '!',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    heading: 'Link Not Found',
    body: 'This confirmation link is invalid or has already been used. If you believe this is an error, you can re-subscribe using the form on the homepage, or contact us for help.',
    cta: { label: 'Return to Homepage', href: '/' },
    showResend: true,
  },
  error: {
    icon: '✕',
    iconBg: '#FEE2E2',
    iconColor: '#DC2626',
    heading: 'Verification Failed',
    body: 'We were unable to confirm your email at this time. Please try clicking the link in your email again, or use the resend option below.',
    cta: { label: 'Contact Us', href: '/contact' },
    showResend: true,
  },
};

function VerificationSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', margin: '0 0 28px', flexWrap: 'wrap' }}>
      {steps.map((step, i) => (
        <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: step.done ? brand.green : brand.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', color: step.done ? '#fff' : brand.muted,
              fontFamily: 'Georgia, serif', fontWeight: 'bold',
              transition: 'all 0.3s',
            }}>
              {step.done ? '✓' : String(i + 1)}
            </div>
            <p style={{ margin: 0, fontSize: '10px', color: step.done ? brand.green : brand.muted, fontFamily: 'Georgia, serif', whiteSpace: 'nowrap', maxWidth: '64px', textAlign: 'center', lineHeight: 1.3 }}>
              {step.label}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: '32px', height: '2px', background: step.done ? brand.green : brand.border, margin: '0 4px', marginBottom: '20px', flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function ResendForm() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/email-optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), resend: true }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setSendError(data?.error ?? 'Failed to resend. Please try again.');
      }
    } catch {
      setSendError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{ background: brand.greenLight, border: `1px solid rgba(53,94,59,0.25)`, borderRadius: '10px', padding: '16px 20px', marginTop: '20px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '13px', color: brand.green, fontFamily: 'Georgia, serif', fontWeight: 'bold' }}>
          ✓ Confirmation email sent!
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: brand.muted, fontFamily: 'Georgia, serif' }}>
          Check your inbox (and spam folder) for the verification link.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '20px', borderTop: `1px solid ${brand.border}`, paddingTop: '20px' }}>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: brand.muted, fontFamily: 'Georgia, serif', textAlign: 'center' }}>
        Need a new confirmation link?
      </p>
      <form onSubmit={handleResend} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          style={{
            flex: '1', minWidth: '180px', padding: '10px 14px',
            border: `1px solid ${brand.border}`, borderRadius: '7px',
            fontSize: '13px', fontFamily: 'Georgia, serif',
            background: brand.bg, color: brand.foreground,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={sending}
          style={{
            padding: '10px 20px', borderRadius: '7px',
            background: brand.accent, color: '#fff',
            border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontFamily: 'Georgia, serif',
            fontWeight: 'bold', opacity: sending ? 0.7 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {sending ? 'Sending…' : 'Resend Email'}
        </button>
      </form>
      {sendError && (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#DC2626', fontFamily: 'Georgia, serif', textAlign: 'center' }}>
          {sendError}
        </p>
      )}
    </div>
  );
}

function CountdownRedirect({ href, seconds = 10 }: { href: string; seconds?: number }) {
  const router = useRouter();
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (count <= 0) {
      router.push(href);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, href, router]);

  return (
    <p style={{ margin: '16px 0 0', fontSize: '12px', color: brand.muted, fontFamily: 'Georgia, serif' }}>
      Redirecting in{' '}
      <span style={{ fontWeight: 'bold', color: brand.accent }}>{count}s</span>
      {' '}·{' '}
      <a href={href} style={{ color: brand.accent, textDecoration: 'none' }}>Go now →</a>
    </p>
  );
}

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status') ?? 'invalid';
  const config = STATUS_MAP[status] ?? STATUS_MAP['invalid'];

  return (
    <main
      style={{ backgroundColor: brand.secondary, minHeight: '100vh' }}
      className="flex items-center justify-center px-4 py-20"
    >
      <div
        style={{
          backgroundColor: brand.bg,
          border: `1px solid ${brand.border}`,
          borderRadius: '14px',
          maxWidth: '540px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(74,55,40,0.10)',
        }}
      >
        {/* Header bar */}
        <div style={{ backgroundColor: brand.primary, padding: 0 }}>
          <div
            style={{
              height: '4px',
              background: `linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent})`,
            }}
          />
          <div style={{ padding: '20px 36px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                color: brand.accent,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontFamily: 'Georgia, serif',
              }}
            >
              Maggi May Broussard &middot; Paralegal Services
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontFamily: 'Georgia, serif', letterSpacing: '0.08em' }}>
              Email Verification
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '36px 36px 32px', textAlign: 'center' }}>
          {/* Icon */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: config.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '28px',
              color: config.iconColor,
              fontWeight: 'bold',
              fontFamily: 'Georgia, serif',
              border: `2px solid ${config.iconColor}22`,
            }}
          >
            {config.icon}
          </div>

          <h1
            style={{
              margin: '0 0 12px',
              fontSize: '26px',
              color: brand.foreground,
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 'normal',
              lineHeight: 1.3,
            }}
          >
            {config.heading}
          </h1>

          <p
            style={{
              margin: '0 0 24px',
              fontSize: '14px',
              color: brand.muted,
              lineHeight: 1.8,
              fontFamily: 'Georgia, serif',
            }}
          >
            {config.body}
          </p>

          {/* Verification steps */}
          {config.steps && <VerificationSteps steps={config.steps} />}

          {config.cta && (
            <Link
              href={config.cta.href}
              style={{
                display: 'inline-block',
                backgroundColor: status === 'confirmed' ? brand.green : brand.accent,
                color: '#FFFFFF',
                padding: '13px 32px',
                borderRadius: '7px',
                textDecoration: 'none',
                fontSize: '14px',
                fontFamily: 'Georgia, serif',
                fontWeight: 'bold',
                letterSpacing: '0.04em',
                boxShadow: `0 2px 8px ${status === 'confirmed' ? 'rgba(53,94,59,0.30)' : 'rgba(200,150,90,0.30)'}`,
              }}
            >
              {config.cta.label} &rarr;
            </Link>
          )}

          {/* Auto-redirect countdown for confirmed */}
          {config.autoRedirect && config.cta && (
            <CountdownRedirect href={config.cta.href} seconds={12} />
          )}

          {/* Resend form for error/invalid */}
          {config.showResend && <ResendForm />}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: brand.secondary,
            padding: '16px 36px',
            borderTop: `1px solid ${brand.border}`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              color: brand.muted,
              fontFamily: 'Georgia, serif',
              lineHeight: 1.7,
            }}
          >
            Questions?{' '}
            <a
              href="mailto:maggimaybroussard@gmail.com"
              style={{ color: brand.accent, textDecoration: 'none' }}
            >
              maggimaybroussard@gmail.com
            </a>
            {' '}·{' '}
            <a href="/" style={{ color: brand.muted, textDecoration: 'none' }}>broussardlegalservices.com</a>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={
      <main style={{ backgroundColor: '#EDE8E0', minHeight: '100vh' }} className="flex items-center justify-center">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            border: `3px solid ${brand.border}`, borderTopColor: brand.accent,
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ fontFamily: 'Georgia, serif', color: brand.muted, fontSize: '14px' }}>Verifying your email…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    }>
      <ConfirmEmailContent />
    </Suspense>
  );
}
