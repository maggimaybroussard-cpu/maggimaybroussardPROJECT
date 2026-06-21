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
  full_quote: string;
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
  quote: 'Maggi May transformed how our firm handles overflow caseloads. Her research memos are meticulous, and she communicates like a true professional. An absolute asset.',
  full_quote: 'Maggi May transformed how our firm handles overflow caseloads. Her research memos are meticulous, and she communicates like a true professional. An absolute asset.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_129b52495-1772784244034.png",
  alt: 'Professional woman attorney in business attire, warm confident expression, bright office background',
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
  full_quote: 'I was skeptical about remote paralegals, but Maggi May exceeded every expectation. She handles my document drafting flawlessly and always meets deadlines.',
  rating: 5,
  service: 'Document Drafting',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_15d75124c-1772213059804.png",
  alt: 'Professional man in business casual attire, neutral background, warm natural lighting',
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
  full_quote: 'Her litigation support during our trial prep saved us weeks of work. Organized, thorough, and always one step ahead.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1c0007e95-1763295050768.png",
  alt: 'Professional woman attorney, confident expression, neutral light background, dark business attire',
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
  full_quote: "We've worked with Maggi May on contract review for two years. Her attention to risk factors and clear summaries have become indispensable to our team.",
  rating: 5,
  service: 'Contract Review',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1c32f95b5-1772166379673.png",
  alt: 'Professional man in business attire, confident expression, office setting, soft lighting',
  featured: false,
  sort_order: 4
},
{
  id: '5',
  name: 'Senior Associate',
  role: 'Senior Associate',
  firm: 'Multi-Attorney Firm',
  location: 'Houston, TX',
  quote: 'Maggi May stepped in mid-trial and organized our entire exhibit binder in under 48 hours. I cannot overstate how much that mattered. She is the real deal.',
  full_quote: 'Maggi May stepped in mid-trial and organized our entire exhibit binder in under 48 hours. I cannot overstate how much that mattered. She is the real deal.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f1dda5df-1772102218859.png",
  alt: 'Professional woman attorney with dark hair, confident expression, bright office background',
  featured: false,
  sort_order: 5
},
{
  id: '6',
  name: 'Partner, Litigation Practice',
  role: 'Partner',
  firm: 'Regional Law Firm',
  location: 'Baton Rouge, LA',
  quote: 'From deposition summaries to legal research memos, Maggi May delivers every time. She understands the urgency of litigation and never misses a beat.',
  full_quote: 'From deposition summaries to legal research memos, Maggi May delivers every time. She understands the urgency of litigation and never misses a beat.',
  rating: 5,
  service: 'Legal Research',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1b60771cf-1763296560649.png",
  alt: 'Professional man in suit, confident expression, law office background, warm lighting',
  featured: false,
  sort_order: 6
},
{
  id: '7',
  name: 'General Counsel',
  role: 'General Counsel',
  firm: 'Real Estate Holdings Company',
  location: 'Atlanta, GA',
  quote: 'Our in-house team was overwhelmed during a major acquisition. Maggi May handled all contract redlines and due diligence summaries with remarkable precision.',
  full_quote: 'Our in-house team was overwhelmed during a major acquisition. Maggi May handled all contract redlines and due diligence summaries with remarkable precision.',
  rating: 5,
  service: 'Contract Review',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10c73e8e2-1763301564654.png",
  alt: 'Professional woman in business attire, poised expression, modern office environment',
  featured: false,
  sort_order: 7
},
{
  id: '8',
  name: 'Criminal Defense Attorney',
  role: 'Criminal Defense Attorney',
  firm: 'Solo Criminal Defense Practice',
  location: 'Nashville, TN',
  quote: 'I needed a paralegal who could keep up with a fast-moving criminal defense docket. Maggi May was thorough, discreet, and always prepared. Highly recommend.',
  full_quote: 'I needed a paralegal who could keep up with a fast-moving criminal defense docket. Maggi May was thorough, discreet, and always prepared. Highly recommend.',
  rating: 5,
  service: 'Litigation Support',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12fc6cbe7-1772369417485.png",
  alt: 'Professional man in dark suit, serious expression, courthouse or office background',
  featured: false,
  sort_order: 8
}];


export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK);

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
  }, [testimonials]);

  const featured = testimonials.find((t) => t.featured) ?? testimonials[0];
  const rest = testimonials.filter((t) => t.id !== featured?.id).slice(0, 3);
  const sideImages = testimonials.filter((t) => t.id !== featured?.id);

  return (
    <section ref={sectionRef} className="py-20 md:py-32 bg-background overflow-hidden" id="testimonials" aria-label="Client testimonials">
      <div className="max-w-7xl mx-auto px-5 md:px-10">

        {/* Header */}
        <div className="scroll-reveal-hidden text-center mb-14 md:mb-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 md:mb-5 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-accent/70" />
            Client Words
            <span className="w-8 h-px bg-accent/70" />
          </p>
          <h2 className="text-section-heading text-foreground">
            Voices of those
            <br />
            <span className="italic" style={{ opacity: 0.75 }}>I've served</span>
          </h2>
        </div>

        {/* Testimonial Layout */}
        <div className="relative flex items-center justify-center min-h-[420px] md:min-h-[620px]">

          {/* Left portrait cards */}
          {sideImages[0] &&
          <div className="scroll-reveal-hidden absolute left-0 top-1/2 -translate-y-1/2 -rotate-[10deg] w-36 md:w-48 h-52 md:h-64 card-rounded overflow-hidden shadow-2xl shadow-primary/15 hidden sm:block">
              <div className="relative w-full h-full">
                <AppImage
                src={sideImages[0].image}
                alt={sideImages[0].alt}
                fill
                loading="lazy"
                className="object-cover grayscale"
                sizes="(max-width: 768px) 144px, 192px" />
              </div>
            </div>
          }
          {sideImages[1] &&
          <div className="scroll-reveal-hidden absolute left-20 md:left-32 top-1/2 -translate-y-1/3 rotate-[5deg] w-36 md:w-44 h-52 md:h-60 card-rounded overflow-hidden shadow-xl shadow-primary/10 hidden md:block" style={{ transitionDelay: '0.1s' }}>
              <div className="relative w-full h-full">
                <AppImage
                src={sideImages[1].image}
                alt={sideImages[1].alt}
                fill
                loading="lazy"
                className="object-cover grayscale"
                sizes="176px" />
              </div>
            </div>
          }

          {/* Center Quote Card */}
          {featured &&
          <div className="scroll-reveal-hidden relative z-10 w-full max-w-[90vw] sm:max-w-[480px] bg-card border border-border/80 p-7 md:p-14 card-rounded shadow-2xl shadow-primary/12 text-center mx-auto" style={{ transitionDelay: '0.2s' }}>
              {/* Avatar */}
              <div className="relative w-[64px] md:w-[72px] h-[64px] md:h-[72px] mx-auto mb-5 md:mb-6 rounded-full overflow-hidden border-[3px] border-background shadow-lg ring-2 ring-accent/25">
                <AppImage
                src={featured.image}
                alt={featured.alt}
                fill
                loading="lazy"
                className="object-cover"
                sizes="72px" />
              </div>
              <h4 className="font-serif text-lg md:text-xl text-foreground mb-1 leading-tight">{featured.name}</h4>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{featured.role}</p>
              <p className="text-[11px] text-accent font-semibold tracking-wide mb-6 md:mb-8">{featured.location}</p>
              <p className="font-serif text-4xl md:text-5xl text-accent/30 mb-2 md:mb-3 leading-none select-none">"</p>
              <p className="text-sm md:text-[15px] text-muted-foreground leading-[1.85] font-light italic">
                {featured.quote}
              </p>
            </div>
          }

          {/* Right portrait cards */}
          {sideImages[2] &&
          <div className="scroll-reveal-hidden absolute right-20 md:right-32 top-1/2 -translate-y-1/3 -rotate-[5deg] w-36 md:w-44 h-52 md:h-60 card-rounded overflow-hidden shadow-xl shadow-primary/10 hidden md:block" style={{ transitionDelay: '0.3s' }}>
              <div className="relative w-full h-full">
                <AppImage
                src={sideImages[2].image}
                alt={sideImages[2].alt}
                fill
                loading="lazy"
                className="object-cover grayscale"
                sizes="176px" />
              </div>
            </div>
          }
          {sideImages[3] &&
          <div className="scroll-reveal-hidden absolute right-0 top-1/2 -translate-y-1/2 rotate-[10deg] w-36 md:w-48 h-52 md:h-64 card-rounded overflow-hidden shadow-2xl shadow-primary/15 hidden sm:block" style={{ transitionDelay: '0.4s' }}>
              <div className="relative w-full h-full">
                <AppImage
                src={sideImages[3].image}
                alt={sideImages[3].alt}
                fill
                loading="lazy"
                className="object-cover grayscale"
                sizes="(max-width: 768px) 144px, 192px" />
              </div>
            </div>
          }
        </div>

        {/* Additional testimonials — horizontal scroll */}
        <div className="scroll-reveal-hidden mt-14 md:mt-20 overflow-x-auto no-scrollbar flex gap-4 md:gap-5 pb-4" style={{ transitionDelay: '0.2s' }}>
          {rest.map((t, i) =>
          <div
            key={t.id}
            className="shrink-0 w-[85vw] sm:w-[88vw] md:w-[380px] bg-secondary/50 border border-border/70 card-rounded p-6 md:p-8 flex flex-col gap-4 md:gap-5"
            style={{ transitionDelay: `${i * 0.1}s` }}>
              <p className="font-serif text-4xl text-accent/30 leading-none select-none">"</p>
              <p className="text-sm text-muted-foreground leading-[1.85] font-light italic flex-1">
                {t.quote}
              </p>
              <div className="flex items-center gap-3.5 pt-4 md:pt-5 border-t border-border/60">
                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 ring-1 ring-border">
                  <AppImage
                  src={t.image}
                  alt={t.alt}
                  fill
                  loading="lazy"
                  className="object-cover"
                  sizes="40px" />
                </div>
                <div>
                  <p className="font-serif text-[15px] text-foreground leading-tight">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.role}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>);

}