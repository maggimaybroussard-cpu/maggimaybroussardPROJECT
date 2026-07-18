import React from 'react';

export default function ContactHero() {
  return (
    <section className="relative bg-primary overflow-hidden pt-28 pb-12 md:pt-44 md:pb-20">
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(ellipse at 30% 60%, var(--accent) 0%, transparent 55%)' }} />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 md:mb-5 flex items-center gap-3">
          <span className="w-6 h-px bg-accent" />
          Get in Touch
        </p>
        <h1 className="text-hero-display text-primary-foreground max-w-2xl">
          Let's start a
          <br />
          <span className="italic opacity-85">conversation</span>
        </h1>
        <p className="text-primary-foreground/65 text-base md:text-lg font-light leading-relaxed max-w-lg mt-5 md:mt-6">
          Available for contract engagements with law firms and solo attorneys across all 50 states.
          Response within one business day.
        </p>
      </div>
    </section>
  );
}