'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface AttorneyDisclaimerProps {
  variant?: 'banner' | 'inline' | 'footer';
  className?: string;
}

export default function AttorneyDisclaimer({ variant = 'banner', className = '' }: AttorneyDisclaimerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (variant === 'banner' && dismissed) return null;

  const disclaimerText = (
    <>
      <strong>Attorney Disclaimer:</strong> Broussard Legal Services provides paralegal support services only. We are not a law firm and do not provide legal advice, legal representation, or attorney-client relationships. All work is performed under the supervision of a licensed attorney.{' '}
      <Link href="/disclaimers" className="underline underline-offset-2 hover:no-underline whitespace-nowrap">
        Full Disclaimer →
      </Link>
    </>
  );

  if (variant === 'footer') {
    return (
      <div className={`text-[11px] text-muted-foreground/70 leading-relaxed max-w-3xl mx-auto text-center px-4 ${className}`}>
        <p>
          <strong className="text-muted-foreground/90">Attorney Disclaimer:</strong>{' '}
          Broussard Legal Services provides paralegal support services only and does not constitute legal advice or create an attorney-client relationship. All services are performed under attorney supervision.{' '}
          <Link href="/disclaimers" className="underline underline-offset-2 hover:text-foreground transition-colors duration-200">
            Full Disclaimer
          </Link>
        </p>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200/70 text-[12px] text-amber-900/80 leading-relaxed ${className}`} role="note" aria-label="Attorney disclaimer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>{disclaimerText}</p>
      </div>
    );
  }

  // banner variant
  return (
    <div
      className={`fixed top-0 left-0 w-full z-40 bg-[#355E3B]/5 border-b border-[#355E3B]/15 ${className}`}
      role="note"
      aria-label="Attorney disclaimer notice"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-2 text-[11px] text-[#355E3B]/80 leading-relaxed">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 sm:mt-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            <strong>Paralegal Services Only</strong> — Not a law firm. No attorney-client relationship is formed. All services performed under attorney supervision.{' '}
            <Link href="/disclaimers" className="underline underline-offset-2 hover:no-underline font-medium">
              Full Disclaimer
            </Link>
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss disclaimer"
          className="shrink-0 text-[#355E3B]/50 hover:text-[#355E3B]/80 transition-colors duration-200 p-1 -mr-1 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#355E3B]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
