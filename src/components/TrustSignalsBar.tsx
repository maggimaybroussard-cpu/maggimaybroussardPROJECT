'use client';

import React from 'react';

interface TrustBadge {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
}

const ShieldCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const BadgeCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const CertificateIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      className={`w-full relative overflow-hidden ${isDark ? 'bg-[#111d2e]' : 'bg-[#f4ede8]'} border-y ${isDark ? 'border-white/8' : 'border-[#B76E79]/12'} ${className}`}
      aria-label="Trust and security credentials"
    >
      {/* Subtle gradient accent line */}
      <div className={`absolute top-0 left-0 w-full h-px ${isDark ? 'bg-gradient-to-r from-transparent via-accent/40 to-transparent' : 'bg-gradient-to-r from-transparent via-[#B76E79]/30 to-transparent'}`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-3.5">
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 sm:gap-x-10 md:gap-x-14">
          {TRUST_BADGES.map((badge, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 group cursor-default"
              title={badge.sublabel}
            >
              <span className={`shrink-0 transition-all duration-300 group-hover:scale-110 ${isDark ? 'text-[#9ecf9e]' : 'text-[#B76E79]'} opacity-75 group-hover:opacity-100`}>
                {badge.icon}
              </span>
              <div className="flex flex-col leading-tight">
                <span className={`text-[11px] font-semibold uppercase tracking-wider transition-colors duration-200 ${isDark ? 'text-white/75 group-hover:text-white' : 'text-[#1B2A4A]/70 group-hover:text-[#1B2A4A]'}`}>
                  {badge.label}
                </span>
                {badge.sublabel && (
                  <span className={`text-[9.5px] hidden sm:block transition-colors duration-200 ${isDark ? 'text-white/35 group-hover:text-white/50' : 'text-[#1B2A4A]/40 group-hover:text-[#1B2A4A]/55'}`}>
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
