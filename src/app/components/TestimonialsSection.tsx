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
  case_outcome?: string;
  outcome_type?: 'favorable' | 'settled' | 'dismissed' | 'won' | 'resolved';
}

const OUTCOME_BADGE: Record<string, {label: string;color: string;bg: string;}> = {
  favorable: { label: 'Favorable Outcome', color: '#2d6a4f', bg: '#d8f3dc' },
  settled: { label: 'Settled', color: '#1d4e89', bg: '#dbeafe' },
  dismissed: { label: 'Case Dismissed', color: '#6b21a8', bg: '#f3e8ff' },
  won: { label: 'Case Won', color: '#92400e', bg: '#fef3c7' },
  resolved: { label: 'Matter Resolved', color: '#374151', bg: '#f3f4f6' }
};

const FALLBACK: Testimonial[] = [
{
  id: '1',
  name: 'Partner, Litigation Firm',
  role: 'Partner',
  firm: 'Regional Litigation Firm',
  location: 'Austin, TX',
  quote: 'Maggi May transformed how our firm handles overflow caseloads. Her research memos are meticulous, and she communicates like a true professional. An absolute asset.',
  full_quote: 'Maggi May transformed how our firm handles overflow caseloads. Her research memos are meticulous, and she communicates like a true professional. An absolute asset. We have relied on her support across multiple complex matters and she has never missed a deadline.',
  rating: 5,
  service: 'Litigation Support',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_129b52495-1772784244034.png',
  alt: 'Professional woman attorney in business attire, warm confident expression, bright office background',
  featured: true,
  sort_order: 1,
  case_outcome: 'Favorable Outcome',
  outcome_type: 'favorable'
},
{
  id: '2',
  name: 'Solo Practitioner',
  role: 'Solo Practitioner',
  firm: 'Family Law Practice',
  location: 'New Orleans, LA',
  quote: 'I was skeptical about remote paralegals, but Maggi May exceeded every expectation. She handles my document drafting flawlessly and always meets deadlines.',
  full_quote: 'I was skeptical about remote paralegals, but Maggi May exceeded every expectation. She handles my document drafting flawlessly and always meets deadlines. My clients have noticed the improvement in turnaround time.',
  rating: 5,
  service: 'Document Drafting',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_15d75124c-1772213059804.png',
  alt: 'Professional man in business casual attire, neutral background, warm natural lighting',
  featured: false,
  sort_order: 2,
  case_outcome: 'Matter Resolved',
  outcome_type: 'resolved'
},
{
  id: '3',
  name: 'Managing Attorney',
  role: 'Managing Attorney',
  firm: 'Boutique Litigation Group',
  location: 'Miami, FL',
  quote: 'Her litigation support during our trial prep saved us weeks of work. Organized, thorough, and always one step ahead.',
  full_quote: 'Her litigation support during our trial prep saved us weeks of work. Organized, thorough, and always one step ahead. She coordinated our entire exhibit binder and deposition summaries without a single error.',
  rating: 5,
  service: 'Litigation Support',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1c0007e95-1763295050768.png',
  alt: 'Professional woman attorney, confident expression, neutral light background, dark business attire',
  featured: false,
  sort_order: 3,
  case_outcome: 'Case Won',
  outcome_type: 'won'
},
{
  id: '4',
  name: 'Director of Legal Affairs',
  role: 'Director of Legal Affairs',
  firm: 'In-House Legal Team',
  location: 'Chicago, IL',
  quote: "We've worked with Maggi May on contract review for two years. Her attention to risk factors and clear summaries have become indispensable to our team.",
  full_quote: "We've worked with Maggi May on contract review for two years. Her attention to risk factors and clear summaries have become indispensable to our team. She has reviewed over 200 contracts for us with zero material errors.",
  rating: 5,
  service: 'Contract Review',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1c32f95b5-1772166379673.png',
  alt: 'Professional man in business attire, confident expression, office setting, soft lighting',
  featured: false,
  sort_order: 4,
  case_outcome: 'Settled',
  outcome_type: 'settled'
},
{
  id: '5',
  name: 'Senior Associate',
  role: 'Senior Associate',
  firm: 'Multi-Attorney Firm',
  location: 'Houston, TX',
  quote: 'Maggi May stepped in mid-trial and organized our entire exhibit binder in under 48 hours. I cannot overstate how much that mattered. She is the real deal.',
  full_quote: 'Maggi May stepped in mid-trial and organized our entire exhibit binder in under 48 hours. I cannot overstate how much that mattered. She is the real deal. Her calm under pressure is exactly what a trial team needs.',
  rating: 5,
  service: 'Litigation Support',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1f1dda5df-1772102218859.png',
  alt: 'Professional woman attorney with dark hair, confident expression, bright office background',
  featured: false,
  sort_order: 5,
  case_outcome: 'Favorable Outcome',
  outcome_type: 'favorable'
},
{
  id: '6',
  name: 'Partner, Litigation Practice',
  role: 'Partner',
  firm: 'Regional Law Firm',
  location: 'Baton Rouge, LA',
  quote: 'From deposition summaries to legal research memos, Maggi May delivers every time. She understands the urgency of litigation and never misses a beat.',
  full_quote: 'From deposition summaries to legal research memos, Maggi May delivers every time. She understands the urgency of litigation and never misses a beat. We consider her an extension of our team.',
  rating: 5,
  service: 'Legal Research',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1b60771cf-1763296560649.png',
  alt: 'Professional man in suit, confident expression, law office background, warm lighting',
  featured: false,
  sort_order: 6,
  case_outcome: 'Case Dismissed',
  outcome_type: 'dismissed'
},
{
  id: '7',
  name: 'General Counsel',
  role: 'General Counsel',
  firm: 'Real Estate Holdings Company',
  location: 'Atlanta, GA',
  quote: 'Our in-house team was overwhelmed during a major acquisition. Maggi May handled all contract redlines and due diligence summaries with remarkable precision.',
  full_quote: 'Our in-house team was overwhelmed during a major acquisition. Maggi May handled all contract redlines and due diligence summaries with remarkable precision. The deal closed on time largely because of her contribution.',
  rating: 5,
  service: 'Contract Review',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_10c73e8e2-1763301564654.png',
  alt: 'Professional woman in business attire, poised expression, modern office environment',
  featured: false,
  sort_order: 7,
  case_outcome: 'Matter Resolved',
  outcome_type: 'resolved'
},
{
  id: '8',
  name: 'Criminal Defense Attorney',
  role: 'Criminal Defense Attorney',
  firm: 'Solo Criminal Defense Practice',
  location: 'Nashville, TN',
  quote: 'I needed a paralegal who could keep up with a fast-moving criminal defense docket. Maggi May was thorough, discreet, and always prepared. Highly recommend.',
  full_quote: 'I needed a paralegal who could keep up with a fast-moving criminal defense docket. Maggi May was thorough, discreet, and always prepared. Highly recommend. She helped me secure a dismissal on a complex case.',
  rating: 5,
  service: 'Litigation Support',
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_12fc6cbe7-1772369417485.png',
  alt: 'Professional man in dark suit, serious expression, courthouse or office background',
  featured: false,
  sort_order: 8,
  case_outcome: 'Case Dismissed',
  outcome_type: 'dismissed'
}];


const TRUST_INDICATORS = [
{
  id: 'nala',
  name: 'NALA',
  full: 'National Association of Legal Assistants',
  icon: '⚖️',
  type: 'association'
},
{
  id: 'nfpa',
  name: 'NFPA',
  full: 'National Federation of Paralegal Associations',
  icon: '📋',
  type: 'association'
},
{
  id: 'lsba',
  name: 'LSBA',
  full: 'Louisiana State Bar Association',
  icon: '🏛️',
  type: 'bar'
},
{
  id: 'cp',
  name: 'CP Certified',
  full: 'Certified Paralegal — NALA',
  icon: '🎓',
  type: 'certification'
},
{
  id: 'pp',
  name: 'PP Certified',
  full: 'Professional Paralegal — NFPA',
  icon: '✅',
  type: 'certification'
},
{
  id: 'aba',
  name: 'ABA Approved',
  full: 'American Bar Association Approved Program',
  icon: '🔖',
  type: 'bar'
}];


function OutcomeBadge({ type, label }: {type?: string;label?: string;}) {
  if (!type && !label) return null;
  const key = type ?? 'resolved';
  const badge = OUTCOME_BADGE[key] ?? OUTCOME_BADGE.resolved;
  const text = label ?? badge.label;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
      style={{ color: badge.color, background: badge.bg }}>
      
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: badge.color }} />
      {text}
    </span>);

}

function StarRow({ rating }: {rating: number;}) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) =>
      <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < rating ? '#C8965A' : '#e5e7eb'} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
    </div>);

}

function TestimonialModal({ t, onClose }: {t: Testimonial;onClose: () => void;}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {if (e.key === 'Escape') onClose();};
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Testimonial from ${t.name}`}>
      
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose} />
      
      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl p-7 md:p-10 flex flex-col gap-5">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          aria-label="Close testimonial">
          
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Avatar + identity */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 ring-2 ring-accent/30 shadow-md">
            <AppImage src={t.image} alt={t.alt} fill loading="lazy" className="object-cover" sizes="64px" />
          </div>
          <div>
            <p className="font-serif text-base text-foreground leading-tight">{t.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t.role}</p>
            <p className="text-[11px] text-accent font-semibold mt-0.5">{t.firm} · {t.location}</p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2 items-center">
          <StarRow rating={t.rating} />
          {t.outcome_type && <OutcomeBadge type={t.outcome_type} label={t.case_outcome} />}
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-accent/10 text-accent">
            {t.service}
          </span>
        </div>

        {/* Full quote */}
        <div>
          <p className="font-serif text-3xl text-accent/25 leading-none select-none mb-2">"</p>
          <p className="text-sm md:text-[15px] text-muted-foreground leading-[1.9] font-light italic">
            {t.full_quote || t.quote}
          </p>
        </div>
      </div>
    </div>);

}

export default function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK);
  const [activeModal, setActiveModal] = useState<Testimonial | null>(null);

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
  const gridCards = testimonials.filter((t) => t.id !== featured?.id);

  return (
    <>
      <section
        ref={sectionRef}
        className="py-20 md:py-32 bg-background overflow-hidden"
        id="testimonials"
        aria-label="Client testimonials">
        
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
              <span className="italic" style={{ opacity: 0.75 }}>I&apos;ve served</span>
            </h2>
          </div>

          {/* Testimonial Layout — hero */}
          <div className="relative flex items-center justify-center min-h-[420px] md:min-h-[620px]">

            {/* Left portrait cards */}
            {sideImages[0] &&
            <button
              onClick={() => setActiveModal(sideImages[0])}
              className="scroll-reveal-hidden absolute left-0 top-1/2 -translate-y-1/2 -rotate-[10deg] w-36 md:w-48 h-52 md:h-64 card-rounded overflow-hidden shadow-2xl shadow-primary/15 hidden sm:block group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={`View testimonial from ${sideImages[0].name}`}>
              
                <div className="relative w-full h-full">
                  <AppImage
                  src={sideImages[0].image}
                  alt={sideImages[0].alt}
                  fill
                  loading="lazy"
                  className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  sizes="(max-width: 768px) 144px, 192px" />
                
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  {sideImages[0].outcome_type &&
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                      <OutcomeBadge type={sideImages[0].outcome_type} label={sideImages[0].case_outcome} />
                    </div>
                }
                </div>
              </button>
            }
            {sideImages[1] &&
            <button
              onClick={() => setActiveModal(sideImages[1])}
              className="scroll-reveal-hidden absolute left-20 md:left-32 top-1/2 -translate-y-1/3 rotate-[5deg] w-36 md:w-44 h-52 md:h-60 card-rounded overflow-hidden shadow-xl shadow-primary/10 hidden md:block group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ transitionDelay: '0.1s' }}
              aria-label={`View testimonial from ${sideImages[1].name}`}>
              
                <div className="relative w-full h-full">
                  <AppImage
                  src={sideImages[1].image}
                  alt={sideImages[1].alt}
                  fill
                  loading="lazy"
                  className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  sizes="176px" />
                
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  {sideImages[1].outcome_type &&
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                      <OutcomeBadge type={sideImages[1].outcome_type} label={sideImages[1].case_outcome} />
                    </div>
                }
                </div>
              </button>
            }

            {/* Center Quote Card */}
            {featured &&
            <button
              onClick={() => setActiveModal(featured)}
              className="scroll-reveal-hidden relative z-10 w-full max-w-[90vw] sm:max-w-[480px] bg-card border border-border/80 p-7 md:p-14 card-rounded shadow-2xl shadow-primary/12 text-center mx-auto group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent hover:shadow-primary/20 transition-shadow duration-300"
              style={{ transitionDelay: '0.2s' }}
              aria-label={`View full testimonial from ${featured.name}`}>
              
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
                <p className="text-[11px] text-accent font-semibold tracking-wide mb-3">{featured.location}</p>

                {/* Outcome badge */}
                {featured.outcome_type &&
              <div className="flex justify-center mb-4">
                    <OutcomeBadge type={featured.outcome_type} label={featured.case_outcome} />
                  </div>
              }

                <p className="font-serif text-4xl md:text-5xl text-accent/30 mb-2 md:mb-3 leading-none select-none">&ldquo;</p>
                <p className="text-sm md:text-[15px] text-muted-foreground leading-[1.85] font-light italic">
                  {featured.quote}
                </p>

                {/* Read more hint */}
                <p className="mt-4 text-[10px] uppercase tracking-widest text-accent/60 group-hover:text-accent transition-colors duration-200">
                  Read full testimonial →
                </p>
              </button>
            }

            {/* Right portrait cards */}
            {sideImages[2] &&
            <button
              onClick={() => setActiveModal(sideImages[2])}
              className="scroll-reveal-hidden absolute right-20 md:right-32 top-1/2 -translate-y-1/3 -rotate-[5deg] w-36 md:w-44 h-52 md:h-60 card-rounded overflow-hidden shadow-xl shadow-primary/10 hidden md:block group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ transitionDelay: '0.3s' }}
              aria-label={`View testimonial from ${sideImages[2].name}`}>
              
                <div className="relative w-full h-full">
                  <AppImage
                  src={sideImages[2].image}
                  alt={sideImages[2].alt}
                  fill
                  loading="lazy"
                  className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  sizes="176px" />
                
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  {sideImages[2].outcome_type &&
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                      <OutcomeBadge type={sideImages[2].outcome_type} label={sideImages[2].case_outcome} />
                    </div>
                }
                </div>
              </button>
            }
            {sideImages[3] &&
            <button
              onClick={() => setActiveModal(sideImages[3])}
              className="scroll-reveal-hidden absolute right-0 top-1/2 -translate-y-1/2 rotate-[10deg] w-36 md:w-48 h-52 md:h-64 card-rounded overflow-hidden shadow-2xl shadow-primary/15 hidden sm:block group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ transitionDelay: '0.4s' }}
              aria-label={`View testimonial from ${sideImages[3].name}`}>
              
                <div className="relative w-full h-full">
                  <AppImage
                  src={sideImages[3].image}
                  alt={sideImages[3].alt}
                  fill
                  loading="lazy"
                  className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  sizes="(max-width: 768px) 144px, 192px" />
                
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  {sideImages[3].outcome_type &&
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                      <OutcomeBadge type={sideImages[3].outcome_type} label={sideImages[3].case_outcome} />
                    </div>
                }
                </div>
              </button>
            }
          </div>

          {/* Clickable avatar card grid */}
          <div className="scroll-reveal-hidden mt-16 md:mt-20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5" style={{ transitionDelay: '0.1s' }}>
            {gridCards.slice(0, 8).map((t, i) =>
            <button
              key={t.id}
              onClick={() => setActiveModal(t)}
              className="group relative bg-card border border-border/70 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-accent/30 transition-all duration-200 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ transitionDelay: `${i * 0.05}s` }}
              aria-label={`View testimonial from ${t.name}`}>
              
                {/* Avatar + stars row */}
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-accent/20 group-hover:ring-accent/50 transition-all duration-200">
                    <AppImage
                    src={t.image}
                    alt={t.alt}
                    fill
                    loading="lazy"
                    className="object-cover"
                    sizes="40px" />
                  
                  </div>
                  <StarRow rating={t.rating} />
                </div>

                {/* Quote snippet */}
                <p className="text-xs text-muted-foreground leading-relaxed italic line-clamp-3 flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Outcome badge */}
                {t.outcome_type &&
              <OutcomeBadge type={t.outcome_type} label={t.case_outcome} />
              }

                {/* Footer */}
                <div className="pt-2 border-t border-border/40">
                  <p className="text-[11px] font-semibold text-foreground truncate">{t.role}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.firm}</p>
                  <p className="text-[10px] text-accent/70 truncate">{t.location}</p>
                </div>

                {/* Service tag */}
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider bg-accent/10 text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {t.service}
                </span>
              </button>
            )}
          </div>

          {/* Horizontal scroll strip — original rest cards */}
          <div
            className="scroll-reveal-hidden mt-10 md:mt-14 overflow-x-auto no-scrollbar flex gap-4 md:gap-5 pb-4"
            style={{ transitionDelay: '0.2s' }}>
            
            {rest.map((t, i) =>
            <button
              key={t.id}
              onClick={() => setActiveModal(t)}
              className="shrink-0 w-[85vw] sm:w-[88vw] md:w-[380px] bg-secondary/50 border border-border/70 card-rounded p-6 md:p-8 flex flex-col gap-4 md:gap-5 text-left cursor-pointer hover:border-accent/30 hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ transitionDelay: `${i * 0.1}s` }}
              aria-label={`View testimonial from ${t.name}`}>
              
                <p className="font-serif text-4xl text-accent/30 leading-none select-none">&ldquo;</p>
                <p className="text-sm text-muted-foreground leading-[1.85] font-light italic flex-1">
                  {t.quote}
                </p>
                {t.outcome_type &&
              <OutcomeBadge type={t.outcome_type} label={t.case_outcome} />
              }
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
              </button>
            )}
          </div>

          {/* ── Trust Indicators ── */}
          <div className="scroll-reveal-hidden mt-16 md:mt-24 border-t border-border/40 pt-10 md:pt-14" style={{ transitionDelay: '0.15s' }}>
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground mb-8">
              Memberships · Bar Affiliations · Certifications
            </p>

            <div className="flex flex-wrap justify-center gap-3 md:gap-4">
              {TRUST_INDICATORS.map((ti) =>
              <div
                key={ti.id}
                title={ti.full}
                className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border/60 bg-card hover:border-accent/40 hover:bg-accent/5 transition-all duration-200 cursor-default">
                
                  <span className="text-base leading-none" aria-hidden="true">{ti.icon}</span>
                  <div>
                    <p className="text-[11px] font-semibold text-foreground leading-tight">{ti.name}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight max-w-[140px] truncate">{ti.full}</p>
                  </div>
                  <span
                  className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                  ti.type === 'certification' ?
                  'bg-amber-100 text-amber-700' :
                  ti.type === 'bar' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`
                  }>
                  
                    {ti.type === 'certification' ? 'Cert' : ti.type === 'bar' ? 'Bar' : 'Assoc'}
                  </span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
              { value: '200+', label: 'Attorneys Served' },
              { value: '98%', label: 'Client Satisfaction' },
              { value: '10+', label: 'Years Experience' },
              { value: '5★', label: 'Average Rating' }].
              map((stat) =>
              <div key={stat.label} className="text-center py-4 px-3 rounded-xl bg-secondary/40 border border-border/40">
                  <p className="font-serif text-2xl md:text-3xl text-accent font-light">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{stat.label}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Modal */}
      {activeModal &&
      <TestimonialModal t={activeModal} onClose={() => setActiveModal(null)} />
      }
    </>);

}