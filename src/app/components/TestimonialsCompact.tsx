'use client';

import React, { useEffect, useState } from 'react';
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
  featured: boolean;
  sort_order: number;
}

const FALLBACK: Testimonial[] = [
{
  id: '1',
  name: 'Partner, Litigation Firm',
  role: 'Partner',
  firm: 'Regional Litigation Firm',
  location: 'Austin, TX',
  quote: 'Maggi May transformed how our firm handles overflow caseloads. Her research memos are meticulous, and she communicates like a true professional.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10c73e8e2-1763301564654.png",
  alt: 'Professional woman attorney in business attire, warm confident expression',
  featured: true,
  sort_order: 1
},
{
  id: '2',
  name: 'Solo Practitioner',
  role: 'Solo Practitioner',
  firm: 'Family Law Practice',
  location: 'New Orleans, LA',
  quote: 'I was skeptical about remote paralegals, but Maggi May exceeded every expectation. She handles my document drafting flawlessly and always meets deadlines.',
  rating: 5,
  service: 'Document Drafting',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_15d75124c-1772213059804.png',
  alt: 'Professional man in business casual attire, neutral background',
  featured: false,
  sort_order: 2
},
{
  id: '3',
  name: 'Managing Attorney',
  role: 'Managing Attorney',
  firm: 'Boutique Litigation Group',
  location: 'Miami, FL',
  quote: 'Her litigation support during our trial prep saved us weeks of work. Organized, thorough, and always one step ahead.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10c73e8e2-1763301564654.png",
  alt: 'Professional woman attorney, confident expression, neutral light background',
  featured: false,
  sort_order: 3
},
{
  id: '4',
  name: 'Director of Legal Affairs',
  role: 'Director of Legal Affairs',
  firm: 'In-House Legal Team',
  location: 'Chicago, IL',
  quote: "We've worked with Maggi May on contract review for two years. Her attention to risk factors and clear summaries have become indispensable to our team.",
  rating: 5,
  service: 'Contract Review',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12fc6cbe7-1772369417485.png",
  alt: 'Professional man in business attire, confident expression, office setting',
  featured: false,
  sort_order: 4
}];


interface Props {
  limit?: number;
  heading?: string;
}

export default function TestimonialsCompact({ limit = 4, heading = 'What Attorneys Say' }: Props) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK.slice(0, limit));

  useEffect(() => {
    const supabase = createClient();
    supabase.
    from('testimonials').
    select('*').
    eq('active', true).
    order('sort_order', { ascending: true }).
    limit(limit).
    then(({ data }) => {
      if (data && data.length > 0) {
        setTestimonials(data as Testimonial[]);
      }
    });
  }, [limit]);

  return (
    <section className="py-14 md:py-20 bg-muted/30" aria-label="Client testimonials">
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-3 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-accent/70" />
            Client Voices
            <span className="w-8 h-px bg-accent/70" />
          </p>
          <h2 className="font-serif text-2xl md:text-3xl text-foreground">{heading}</h2>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t) =>
          <div
            key={t.id}
            className="bg-card border border-border/70 rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow duration-200">
            
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) =>
              <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#C8965A" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
              )}
              </div>

              {/* Quote */}
              <p className="text-sm text-muted-foreground leading-relaxed italic flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-accent/20">
                  <AppImage
                  src={t.image}
                  alt={t.alt}
                  fill
                  loading="lazy"
                  className="object-cover"
                  sizes="36px" />
                
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{t.role}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.location}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Service tags row */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {Array.from(new Set(testimonials.map((t) => t.service))).map((svc) =>
          <span
            key={svc}
            className="px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-accent/10 text-accent">
            
              {svc}
            </span>
          )}
        </div>
      </div>
    </section>);

}