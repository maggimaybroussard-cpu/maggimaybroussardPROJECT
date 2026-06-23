'use client';

import React, { useEffect, useRef } from 'react';

const differentiators = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Strict Confidentiality',
    body: 'Every engagement is governed by a signed NDA. Client matters, strategies, and documents are handled with the same discretion you expect from in-house staff.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: '48-Hour Turnaround',
    body: 'Most standard deliverables are completed within 48 hours. Rush timelines are available for urgent matters — just ask during your consultation.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Seamless Integration',
    body: "I work inside your existing tools — Clio, MyCase, Google Workspace, or whatever your firm uses. No onboarding friction, no learning curve on your end.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: 'Nationwide Remote Service',
    body: 'Based in New Orleans, serving law firms across all 50 states. Remote-first means faster delivery and no geographic limitations on who I can support.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Flexible Billing',
    body: 'Hourly, flat-fee, or retainer arrangements available. Pay only for what you need — scale up during busy seasons, scale back when things slow down.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'AI-Assisted Efficiency',
    body: 'Leveraging cutting-edge legal AI tools to accelerate research, drafting, and document review — while you retain full attorney oversight and final review.',
  },
];

export default function ServicesWhyBroussard() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const elements = sectionRef.current?.querySelectorAll('.scroll-reveal-hidden');
    if (!elements) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('revealed');
          }
        });
      },
      { threshold: 0.08 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-16 md:py-28 bg-secondary/40 border-y border-border">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {/* Header */}
        <div className="scroll-reveal-hidden mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
              <span className="w-6 h-px bg-accent" />
              Why Broussard Legal
            </p>
            <h2 className="text-section-heading text-foreground">
              The difference
              <br />
              <span className="italic opacity-80">you'll actually feel</span>
            </h2>
          </div>
          <p className="text-muted-foreground text-sm md:text-base font-light max-w-xs leading-relaxed md:text-right">
            Not just another paralegal service. A true extension of your legal team.
          </p>
        </div>

        {/* Asymmetric grid — 2 cols on md, 3 cols on lg */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {differentiators.map((item, index) => (
            <div
              key={item.title}
              className="scroll-reveal-hidden group bg-background border border-border card-rounded p-7 flex flex-col gap-4 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300"
              style={{ transitionDelay: `${index * 0.07}s` }}
            >
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-300">
                {item.icon}
              </div>
              <h3 className="font-semibold text-foreground text-base tracking-tight">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed font-light flex-1">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
