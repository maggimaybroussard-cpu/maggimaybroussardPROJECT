'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function MobileAppSection() {
  return (
    <section className="py-16 md:py-24 bg-secondary/40" aria-label="Mobile App Download">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Left — Content */}
            <div className="p-8 md:p-12 flex flex-col justify-center gap-6">
              {/* Label */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] flex items-center gap-3" style={{ color: '#8B3A45' }}>
                <span className="w-8 h-px inline-block" style={{ background: 'rgba(139,58,69,0.7)' }} />
                Client Portal App
              </p>

              <div>
                <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-3">
                  Your legal matters,
                  <br />
                  <span className="italic" style={{ opacity: 0.75 }}>always at hand</span>
                </h2>
                <p className="text-base font-light leading-relaxed" style={{ color: '#4A6B58' }}>
                  Install the Broussard Legal client portal on your phone or tablet. Access your cases, documents, invoices, and messages — anywhere, anytime.
                </p>
              </div>

              {/* Feature list */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '📁', label: 'Deliverable Hub' },
                  { icon: '💬', label: 'Direct Messaging' },
                  { icon: '🧾', label: 'Invoice Payments' },
                  { icon: '✍️', label: 'E-Signatures' },
                  { icon: '📅', label: 'Book Appointments' },
                  { icon: '🤖', label: 'AI Legal Secretary' },
                ]?.map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="text-base">{icon}</span>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Install buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/mobile-download"
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/20"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Install App
                </Link>
                <Link
                  href="/client-deliverable-hub"
                  className="inline-flex items-center gap-2.5 px-6 py-3 border border-border text-foreground rounded-full text-xs font-semibold uppercase tracking-[0.15em] hover:border-accent hover:text-accent transition-all duration-300"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  Deliverable Hub
                </Link>
              </div>

              {/* Install hint */}
              <p className="text-[11px] text-muted-foreground font-light">
                No app store needed. On iOS: tap <span className="font-semibold">Share → Add to Home Screen</span>. On Android: tap <span className="font-semibold">Menu → Install App</span>.
              </p>
            </div>

            {/* Right — Visual with attorney photo */}
            <div className="relative bg-gradient-to-br from-primary/90 to-primary flex items-center justify-center p-10 md:p-14 min-h-[320px] overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-6 right-6 w-32 h-32 rounded-full bg-accent/10 blur-2xl" />
              <div className="absolute bottom-6 left-6 w-24 h-24 rounded-full bg-accent/8 blur-xl" />

              {/* Attorney photo + phone mockup */}
              <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs">
                {/* Attorney headshot */}
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 shadow-2xl" style={{ borderColor: 'rgba(200,150,90,0.6)' }}>
                  <Image
                    src="/assets/images/HEADSHOT-1779495779687.png"
                    alt="Maggi May Broussard — Contract Paralegal, Broussard Legal Services"
                    fill
                    className="object-cover object-top"
                    sizes="112px"
                  />
                </div>

                {/* Name + title */}
                <div className="text-center">
                  <p className="text-primary-foreground font-semibold text-sm">Maggi May Broussard</p>
                  <p className="text-primary-foreground/60 text-[11px] mt-0.5">Contract Paralegal · New Orleans, LA</p>
                </div>

                {/* Phone mockup */}
                <div className="w-36 h-60 bg-primary-foreground/10 border-2 border-primary-foreground/20 rounded-3xl flex flex-col overflow-hidden shadow-2xl">
                  {/* Phone notch */}
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-primary-foreground/30 rounded-full" />
                  </div>
                  {/* Screen content */}
                  <div className="flex-1 px-3 pb-3 flex flex-col gap-2">
                    <div className="w-full h-6 bg-accent/30 rounded-lg" />
                    <div className="grid grid-cols-2 gap-1.5 flex-1">
                      {[1, 2, 3, 4]?.map((i) => (
                        <div key={i} className="bg-primary-foreground/10 rounded-xl flex items-center justify-center">
                          <div className="w-4 h-4 bg-accent/40 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="w-full h-4 bg-primary-foreground/15 rounded-lg" />
                    <div className="w-3/4 h-4 bg-primary-foreground/10 rounded-lg" />
                  </div>
                  {/* Home bar */}
                  <div className="flex justify-center pb-2">
                    <div className="w-10 h-1 bg-primary-foreground/30 rounded-full" />
                  </div>
                </div>

                {/* Platform badges */}
                <div className="flex gap-2">
                  {['iOS', 'Android', 'Desktop']?.map((platform) => (
                    <span
                      key={platform}
                      className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}
                    >
                      {platform}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href="/mobile-download"
                  className="mt-1 px-5 py-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-full text-[11px] font-semibold text-primary-foreground uppercase tracking-wider transition-all duration-200"
                >
                  View Install Guide →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
