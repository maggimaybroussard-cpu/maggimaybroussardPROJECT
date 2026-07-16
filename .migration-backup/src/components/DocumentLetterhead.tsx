'use client';

import React from 'react';
import Image from 'next/image';

/**
 * DocumentLetterhead — shared header/footer wrapper for all printable documents.
 * Renders the branded letterhead image at the top and footer image at the bottom.
 * Wrap any invoice, contract, or form content with this component.
 */
interface DocumentLetterheadProps {
  children: React.ReactNode;
  /** Extra className applied to the outer wrapper */
  className?: string;
}

export default function DocumentLetterhead({ children, className = '' }: DocumentLetterheadProps) {
  return (
    <div className={`bg-white ${className}`}>
      {/* ── Letterhead header ── */}
      <div className="w-full">
        <Image
          src="/assets/images/letterhead-1780100512052.png"
          alt="Broussard Legal Services letterhead"
          width={1200}
          height={200}
          className="w-full h-auto block"
          priority
        />
      </div>

      {/* ── Document body ── */}
      <div className="px-8 py-6">
        {children}
      </div>

      {/* ── Footer ── */}
      <div className="w-full mt-4">
        <Image
          src="/assets/images/footer-1780100663536.png"
          alt="Broussard Legal Services footer"
          width={1200}
          height={120}
          className="w-full h-auto block"
        />
      </div>
    </div>
  );
}
