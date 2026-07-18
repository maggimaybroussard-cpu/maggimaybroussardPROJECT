'use client';

import React, { useEffect, useRef, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  firm: string;
  location: string;
  quote: string;
  rating: number;
  service: string;
  image: string;
  alt: string;
  outcome_type?: string;
  case_outcome?: string;
}

const FALLBACK: Testimonial[] = [
{
  id: '1',
  name: 'Partner, Litigation Firm',
  role: 'Partner',
  firm: 'Small Litigation Firm',
  location: 'Baton Rouge, LA',
  quote: 'Maggi May stepped in during a busy stretch and handled our research and document prep with real care. She communicates clearly and delivers on time.',
  rating: 5,
  service: 'Litigation Support',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_10c73e8e2-1763301564654.png',
  alt: 'Professional woman attorney in business attire, warm confident expression',
  outcome_type: 'favorable',
  case_outcome: 'Favorable Outcome'
},
{
  id: '2',
  name: 'Solo Practitioner',
  role: 'Solo Practitioner',
  firm: 'Family Law Practice',
  location: 'New Orleans, LA',
  quote: 'I was skeptical about remote paralegals, but Maggi May exceeded my expectations. She handled my document drafting well and met the deadline I needed.',
  rating: 5,
  service: 'Document Drafting',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_15d75124c-1772213059804.png',
  alt: 'Professional man in business casual attire, neutral background',
  outcome_type: 'resolved',
  case_outcome: 'Matter Resolved'
},
{
  id: '3',
  name: 'Managing Attorney',
  role: 'Managing Attorney',
  firm: 'Boutique Litigation Group',
  location: 'New Orleans, LA',
  quote: 'Her help with trial prep saved me a lot of time. Organized, thorough, and easy to work with.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10c73e8e2-1763301564654.png",
  alt: 'Professional woman attorney, confident expression, neutral light background',
  outcome_type: 'won',
  case_outcome: 'Case Won'
},
{
  id: '4',
  name: 'In-House Counsel',
  role: 'In-House Counsel',
  firm: 'Small Business',
  location: 'Houston, TX',
  quote: 'Maggi May reviewed several vendor contracts for us and flagged issues we hadn\'t caught. Her summaries were clear and useful.',
  rating: 5,
  service: 'Contract Review',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_12fc6cbe7-1772369417485.png',
  alt: 'Professional man in business attire, confident expression, office setting',
  outcome_type: 'settled',
  case_outcome: 'Settled'
},
{
  id: '5',
  name: 'Associate Attorney',
  role: 'Associate Attorney',
  firm: 'Regional Law Firm',
  location: 'Houston, TX',
  quote: 'Maggi May helped us get organized before a hearing and it made a real difference. Reliable and professional.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_163aea1ab-1772495906669.png",
  alt: 'Professional woman attorney with dark hair, confident expression',
  outcome_type: 'favorable',
  case_outcome: 'Favorable Outcome'
},
{
  id: '6',
  name: 'Solo Practitioner',
  role: 'Attorney',
  firm: 'Solo Practice',
  location: 'Baton Rouge, LA',
  quote: 'Good research memo, delivered when she said she would. I\'ll use her again for overflow work.',
  rating: 5,
  service: 'Legal Research',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1c32f95b5-1772166379673.png",
  alt: 'Professional man in suit, confident expression, law office background',
  outcome_type: 'dismissed',
  case_outcome: 'Case Dismissed'
}];


const OUTCOME_COLORS: Record<string, {color: string;bg: string;}> = {
  favorable: { color: '#2d6a4f', bg: '#d8f3dc' },
  settled: { color: '#1d4e89', bg: '#dbeafe' },
  dismissed: { color: '#6b21a8', bg: '#f3e8ff' },
  won: { color: '#92400e', bg: '#fef3c7' },
  resolved: { color: '#374151', bg: '#f3f4f6' }
};

function StarRow({ rating }: {rating: number;}) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) =>
      <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i < rating ? '#C8965A' : '#e5e7eb'} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
    </div>);

}

export default function TestimonialsCarousel() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK);
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.
    from('testimonials').
    select('*').
    eq('active', true).
    order('sort_order', { ascending: true }).
    then(({ data }) => {
      if (data && data.length > 0) setTestimonials(data as Testimonial[]);
    });
  }, []);

  // Duplicate for seamless loop
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="py-16 md:py-20 overflow-hidden bg-muted/20" aria-label="Client testimonials carousel">
      <div className="max-w-7xl mx-auto px-5 md:px-10 mb-10">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-3 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-accent/70" />
            What Attorneys Say
            <span className="w-8 h-px bg-accent/70" />
          </p>
          <h2 className="font-serif text-2xl md:text-3xl text-foreground">
            Trusted by attorneys <span className="italic opacity-75">nationwide</span>
          </h2>
        </div>
      </div>

      {/* Carousel track */}
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}>
        
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, var(--background, #FAF7F2), transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, var(--background, #FAF7F2), transparent)' }} />

        <div
          ref={trackRef}
          className="flex gap-4 md:gap-5"
          style={{
            animation: isPaused ? 'none' : 'testimonials-scroll 40s linear infinite',
            width: 'max-content'
          }}>
          
          {doubled.map((t, idx) => {
            const outcomeCfg = t.outcome_type ? OUTCOME_COLORS[t.outcome_type] : null;
            return (
              <div
                key={`${t.id}-${idx}`}
                className="shrink-0 w-[280px] md:w-[320px] bg-card border border-border/70 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
                
                {/* Stars */}
                <StarRow rating={t.rating} />

                {/* Quote */}
                <p className="text-xs text-muted-foreground leading-relaxed italic flex-1 line-clamp-4">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Outcome badge */}
                {outcomeCfg && t.case_outcome &&
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide w-fit"
                  style={{ color: outcomeCfg.color, background: outcomeCfg.bg }}>
                  
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: outcomeCfg.color }} />
                    {t.case_outcome}
                  </span>
                }

                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-accent/20">
                    <AppImage src={t.image} alt={t.alt} fill loading="lazy" className="object-cover" sizes="36px" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{t.role}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.firm} · {t.location}</p>
                  </div>
                  <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider bg-accent/10 text-accent">
                    {t.service}
                  </span>
                </div>
              </div>);

          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes testimonials-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>);

}