'use client';

import React from 'react';

interface TrustBadge {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
}

const ShieldCheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const LockIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l4 8a4 4 0 0 1-8 0z" />
    <path d="M21 6l4 8a4 4 0 0 1-8 0z" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </svg>
);

const BadgeCheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const CertificateIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

const TRUST_BADGES: TrustBadge[] = [
  {
    icon: <BadgeCheckIcon />,
    label: 'NALA Member',
    sublabel: 'Nat\'l Assoc. of Legal Assistants',
  },
  {
    icon: <CertificateIcon />,
    label: 'NFPA Member',
    sublabel: 'Nat\'l Federation of Paralegal Assoc.',
  },
  {
    icon: <LockIcon />,
    label: 'SSL Secured',
    sublabel: '256-bit TLS Encryption',
  },
  {
    icon: <ShieldCheckIcon />,
    label: 'PCI Compliant',
    sublabel: 'Stripe Secure Payments',
  },
];

interface TrustSignalsBarProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export default function TrustSignalsBar({ variant = 'light', className = '' }: TrustSignalsBarProps) {
  const isDark = variant === 'dark';

  return (
    <div
      className={`w-full ${isDark ? 'bg-[#1a2e1c]' : 'bg-[#f5f7f5]'} border-y ${isDark ? 'border-white/10' : 'border-[#355E3B]/10'} ${className}`}
      aria-label="Trust and security credentials"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 sm:gap-x-8 md:gap-x-10">
          {TRUST_BADGES.map((badge, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 group"
              title={badge.sublabel}
            >
              <span className={`shrink-0 ${isDark ? 'text-[#7ab87a]' : 'text-[#355E3B]'} opacity-80 group-hover:opacity-100 transition-opacity duration-200`}>
                {badge.icon}
              </span>
              <div className="flex flex-col leading-tight">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-white/80' : 'text-[#355E3B]'}`}>
                  {badge.label}
                </span>
                {badge.sublabel && (
                  <span className={`text-[10px] ${isDark ? 'text-white/40' : 'text-muted-foreground/70'} hidden sm:block`}>
                    {badge.sublabel}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
