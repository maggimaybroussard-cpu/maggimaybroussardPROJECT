'use client';

import React, { useEffect, useRef, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';

// ── Testimonial Submission Form ───────────────────────────────────────────────

interface SubmissionForm {
  name: string;
  role: string;
  firm: string;
  location: string;
  service: string;
  rating: number;
  quote: string;
}

const SERVICES = [
'Litigation Support',
'Document Drafting',
'Legal Research',
'Contract Review',
'Case Management',
'Intake & Onboarding',
'Other'];


function TestimonialSubmissionForm() {
  const [form, setForm] = React.useState<SubmissionForm>({
    name: '', role: '', firm: '', location: '', service: '', rating: 5, quote: ''
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRating = (r: number) => setForm((prev) => ({ ...prev, rating: r }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.quote || !form.service) {
      setError('Please fill in your name, service, and review.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase.from('testimonials').insert({
        name: form.name,
        role: form.role,
        firm: form.firm,
        location: form.location,
        service: form.service,
        rating: form.rating,
        quote: form.quote.slice(0, 160),
        full_quote: form.quote,
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1ad86056c-1765741890853.png",
        alt: 'Client testimonial photo',
        featured: false,
        active: false,
        sort_order: 999
      });
      if (dbError) throw dbError;
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B76E79" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="font-serif text-2xl text-foreground mb-2">Thank you for your review!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Your testimonial has been submitted and will appear after review. We appreciate you taking the time to share your experience.</p>
      </div>);

  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Star Rating */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Your Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) =>
          <button
            key={star}
            type="button"
            onClick={() => handleRating(star)}
            className="focus:outline-none"
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}>
            
              <svg width="24" height="24" viewBox="0 0 24 24"
            fill={star <= form.rating ? '#C8965A' : 'none'}
            stroke={star <= form.rating ? '#C8965A' : '#C8965A40'}
            strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Name + Role */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="sub-name" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Name *</label>
          <input
            id="sub-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Jane Smith"
            required
            className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all" />
          
        </div>
        <div>
          <label htmlFor="sub-role" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Title / Role</label>
          <input
            id="sub-role"
            name="role"
            value={form.role}
            onChange={handleChange}
            placeholder="Partner, Solo Practitioner..."
            className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all" />
          
        </div>
      </div>

      {/* Firm + Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="sub-firm" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Firm / Organization</label>
          <input
            id="sub-firm"
            name="firm"
            value={form.firm}
            onChange={handleChange}
            placeholder="Smith & Associates"
            className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all" />
          
        </div>
        <div>
          <label htmlFor="sub-location" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">City, State</label>
          <input
            id="sub-location"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="New Orleans, LA"
            className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all" />
          
        </div>
      </div>

      {/* Service */}
      <div>
        <label htmlFor="sub-service" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Service Used *</label>
        <select
          id="sub-service"
          name="service"
          value={form.service}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all">
          
          <option value="">Select a service...</option>
          {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Review */}
      <div>
        <label htmlFor="sub-quote" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Your Review *</label>
        <textarea
          id="sub-quote"
          name="quote"
          value={form.quote}
          onChange={handleChange}
          rows={5}
          required
          placeholder="Share your experience working with Maggi May Broussard..."
          className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all resize-none" />
        
      </div>

      {error &&
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      }

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        
        {submitting ?
        <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Submitting...
          </> :
        'Submit Review'}
      </button>
    </form>);

}

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

const FALLBACK_TESTIMONIALS: Testimonial[] = [
{
  id: '1', name: 'Partner, Litigation Firm', role: 'Partner', firm: 'Regional Litigation Firm', location: 'Austin, TX', service: 'Litigation Support', rating: 5,
  quote: 'Maggi May transformed how our firm handles overflow caseloads.',
  full_quote: 'Maggi May transformed how our firm handles overflow caseloads. Her research memos are meticulous, and she communicates like a true professional. We brought her on during a particularly demanding trial season and she delivered without a single missed deadline. An absolute asset to any legal team.',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_10c73e8e2-1763301564654.png",
  alt: 'Professional woman attorney in business attire, warm confident expression, bright office background', featured: true, sort_order: 1
},
{
  id: '2', name: 'Solo Practitioner', role: 'Solo Practitioner', firm: 'Family Law Practice', location: 'New Orleans, LA', service: 'Document Drafting', rating: 5,
  quote: 'She handles my document drafting flawlessly and always meets deadlines.',
  full_quote: "I was skeptical about remote paralegals, but Maggi May exceeded every expectation. She handles my document drafting flawlessly and always meets deadlines. Her turnaround time is remarkable — I submitted a complex motion on a Friday afternoon and had a polished draft by Monday morning. I've since referred her to two colleagues.",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_15d75124c-1772213059804.png",
  alt: 'Professional man in business casual attire, neutral background, warm natural lighting', featured: true, sort_order: 2
},
{
  id: '3', name: 'Managing Attorney', role: 'Managing Attorney', firm: 'Boutique Litigation Group', location: 'Miami, FL', service: 'Litigation Support', rating: 5,
  quote: 'Her litigation support during our trial prep saved us weeks of work.',
  full_quote: "Her litigation support during our trial prep saved us weeks of work. Organized, thorough, and always one step ahead. Maggi May assembled our exhibit binders, maintained the witness list, and flagged three inconsistencies in opposing counsel's filings that we had missed. She thinks like a litigator.",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f1dda5df-1772102218859.png",
  alt: 'Professional woman attorney, confident expression, neutral light background, dark business attire', featured: true, sort_order: 3
},
{
  id: '4', name: 'Director of Legal Affairs', role: 'Director of Legal Affairs', firm: 'In-House Legal Team', location: 'Chicago, IL', service: 'Contract Review', rating: 5,
  quote: 'Her attention to risk factors and clear summaries have become indispensable.',
  full_quote: "We've worked with Maggi May on contract review for two years. Her attention to risk factors and clear summaries have become indispensable to our team. She developed a custom risk matrix for our vendor agreements that our in-house counsel now uses as the standard template. Exceptional value for the quality delivered.",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12fc6cbe7-1772369417485.png",
  alt: 'Professional man in business attire, confident expression, office setting, soft lighting', featured: false, sort_order: 4
},
{
  id: '5', name: 'Senior Associate', role: 'Senior Associate', firm: 'Multi-Attorney Firm', location: 'Dallas, TX', service: 'Legal Research', rating: 5,
  quote: 'The research memo she delivered was better than what our associates produce.',
  full_quote: 'The research memo she delivered was better than what our associates produce in twice the time. Maggi May has a rare ability to distill complex case law into actionable summaries. She cited 22 cases across three jurisdictions and organized them by relevance to our specific argument. I will be using her for every research-heavy matter going forward.',
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f1dda5df-1772102218859.png",
  alt: 'Professional woman attorney, confident expression, neutral light background, dark business attire', featured: false, sort_order: 5
},
{
  id: '6', name: 'General Counsel', role: 'General Counsel', firm: 'Real Estate Holdings Company', location: 'Baton Rouge, LA', service: 'Document Drafting', rating: 5,
  quote: 'She drafted our entire lease template suite in under a week.',
  full_quote: "She drafted our entire lease template suite in under a week — commercial, residential, and short-term rental — all tailored to Louisiana law. Each document was clean, well-organized, and required minimal revision. Maggi May saved us thousands in outside counsel fees and delivered a product we're proud to put in front of clients.",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_15d75124c-1772213059804.png",
  alt: 'Professional man in business casual attire, neutral background, warm natural lighting', featured: false, sort_order: 6
},
{
  id: '7', name: 'Partner, Litigation Practice', role: 'Partner', firm: 'Regional Law Firm', location: 'Nashville, TN', service: 'Case Management', rating: 5,
  quote: 'Our case management has never been more organized.',
  full_quote: "Our case management has never been more organized. Maggi May built out our entire matter tracking system, set up deadline calendars, and created intake templates that cut our onboarding time in half. She's proactive, communicates clearly, and treats every case as if it's her own. I can't imagine running our practice without her support.",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_129b52495-1772784244034.png",
  alt: 'Professional woman attorney, poised expression, modern office environment', featured: false, sort_order: 7
},
{
  id: '8', name: 'Immigration Attorney', role: 'Immigration Attorney', firm: 'Immigration Law Office', location: 'Houston, TX', service: 'Document Drafting', rating: 5,
  quote: 'She prepared 40 client files for an asylum hearing with zero errors.',
  full_quote: "She prepared 40 client files for an asylum hearing with zero errors and two days to spare. Immigration work is detail-intensive and unforgiving — Maggi May understood that from day one. Her organizational system, cross-referencing, and document labeling were exactly what we needed. She's now my first call for any high-volume filing.",
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12fc6cbe7-1772369417485.png",
  alt: 'Professional man in business attire, confident expression, office setting', featured: false, sort_order: 8
}];


const stats = [
{ value: '200+', label: 'Cases Supported' },
{ value: '98%', label: 'On-Time Delivery' },
{ value: '5.0', label: 'Average Rating' },
{ value: '4+', label: 'Years Experience' }];


function StarRating({ rating }: {rating: number;}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) =>
      <svg key={i} width="14" height="14" viewBox="0 0 24 24"
      fill={i < rating ? '#C8965A' : 'none'}
      stroke={i < rating ? '#C8965A' : '#C8965A40'}
      strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
    </div>);

}

export default function TestimonialsPage() {
  const sectionRef = useRef<HTMLElement>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(FALLBACK_TESTIMONIALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.
    from('testimonials').
    select('*').
    eq('active', true).
    order('sort_order', { ascending: true }).
    then(({ data }) => {
      if (data && data.length > 0) setTestimonials(data as Testimonial[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading) return;
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
  }, [loading, testimonials]);

  const featured = testimonials.filter((t) => t.featured);
  const rest = testimonials.filter((t) => !t.featured);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Client Testimonials',
            description: 'Read reviews from attorneys and law firms who trust Broussard Legal Services for litigation support, legal research, document drafting, and case management.',
            url: `${baseUrl}/testimonials`,
            image: `${baseUrl}/assets/images/og-image.png`,
            publisher: {
              '@type': 'Organization',
              name: 'Broussard Legal Services',
              logo: { '@type': 'ImageObject', url: `${baseUrl}/assets/images/app_logo.png` }
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '5.0',
              ratingCount: testimonials.length.toString(),
              bestRating: '5',
              worstRating: '1'
            }
          })
        }} />
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: 'Broussard Legal Services — Contract Paralegal Services',
            description: 'Remote contract paralegal services for law firms nationwide with 200+ cases supported and 5.0 rating.',
            url: baseUrl,
            image: `${baseUrl}/assets/images/app_logo.png`,
            areaServed: { '@type': 'Country', name: 'US' },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '5.0',
              ratingCount: testimonials.length.toString(),
              bestRating: '5',
              worstRating: '1'
            }
          })
        }} />
      

      <Header />
      <main ref={sectionRef} className="bg-background min-h-screen">

        {/* Hero */}
        <section className="relative pt-28 pb-16 md:pt-44 md:pb-28 bg-primary overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-accent/5 blur-2xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-5 md:px-10 relative z-10">
            <div className="scroll-reveal-hidden max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 md:mb-5 flex items-center gap-3">
                <span className="w-6 h-px bg-accent" />
                Client Testimonials
              </p>
              <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-primary-foreground leading-[1.05] mb-5 md:mb-6">
                Words from those
                <br />
                <span className="italic opacity-75">I've served</span>
              </h1>
              <p className="text-base md:text-lg text-primary-foreground/60 leading-relaxed max-w-xl">
                Real feedback from attorneys and legal teams who trust Broussard Legal Services for their most demanding paralegal work.
              </p>
            </div>

            {/* Stats row */}
            <div className="scroll-reveal-hidden mt-10 md:mt-14 grid grid-cols-2 sm:flex sm:flex-wrap gap-6 sm:gap-10 md:gap-16" style={{ transitionDelay: '0.15s' }}>
              {stats.map((s) =>
              <div key={s.label}>
                  <p className="font-serif text-3xl md:text-5xl text-accent">{s.value}</p>
                  <p className="text-xs uppercase tracking-widest text-primary-foreground/50 mt-1">{s.label}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Featured Testimonials */}
        <section className="py-16 md:py-28 bg-background">
          <div className="max-w-7xl mx-auto px-5 md:px-10">
            <div className="scroll-reveal-hidden mb-10 md:mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
                <span className="w-6 h-px bg-accent" />
                Featured Reviews
              </p>
              <h2 className="font-serif text-3xl md:text-4xl text-foreground">In their own words</h2>
            </div>

            {featured.length > 0 &&
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
                {/* Large featured card */}
                <div className="scroll-reveal-hidden lg:col-span-2 bg-card border border-border card-rounded p-7 md:p-12 flex flex-col justify-between" style={{ transitionDelay: '0.1s' }}>
                  <div>
                    <StarRating rating={featured[0].rating} />
                    <p className="font-serif text-5xl text-accent/25 leading-none mt-6 mb-4">"</p>
                    <p className="text-base md:text-lg text-foreground/80 leading-relaxed font-light italic">
                      {featured[0].full_quote}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-10 pt-8 border-t border-border">
                    <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 ring-2 ring-accent/20">
                      <AppImage src={featured[0].image} alt={featured[0].alt} width={56} height={56} className="object-cover w-full h-full" />
                    </div>
                    <div>
                      <p className="font-serif text-lg text-foreground">{featured[0].name}</p>
                      <p className="text-xs text-muted-foreground">{featured[0].role}, {featured[0].firm}</p>
                      <p className="text-xs text-accent font-medium mt-0.5">{featured[0].location}</p>
                    </div>
                    <span className="ml-auto text-xs font-semibold uppercase tracking-widest text-accent/60 bg-accent/8 px-3 py-1.5 rounded-full border border-accent/20">
                      {featured[0].service}
                    </span>
                  </div>
                </div>

                {/* Stacked right column */}
                <div className="flex flex-col gap-5 md:gap-6">
                  {featured.slice(1).map((t, i) =>
                <div key={t.id} className="scroll-reveal-hidden bg-secondary/50 border border-border card-rounded p-6 md:p-8 flex flex-col justify-between flex-1" style={{ transitionDelay: `${0.15 + i * 0.1}s` }}>
                      <div>
                        <StarRating rating={t.rating} />
                        <p className="font-serif text-3xl text-accent/25 leading-none mt-4 mb-3">"</p>
                        <p className="text-sm text-foreground/75 leading-relaxed font-light italic">{t.quote}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                          <AppImage src={t.image} alt={t.alt} width={40} height={40} className="object-cover w-full h-full" />
                        </div>
                        <div>
                          <p className="font-serif text-base text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.role}, {t.firm}</p>
                        </div>
                      </div>
                    </div>
                )}
                </div>
              </div>
            }
          </div>
        </section>

        {/* Divider */}
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="h-px bg-border" />
        </div>

        {/* All Testimonials Grid */}
        {rest.length > 0 &&
        <section className="py-16 md:py-28 bg-background">
            <div className="max-w-7xl mx-auto px-5 md:px-10">
              <div className="scroll-reveal-hidden mb-10 md:mb-14">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center gap-3">
                  <span className="w-6 h-px bg-accent" />
                  More Reviews
                </p>
                <h2 className="font-serif text-3xl md:text-4xl text-foreground">Across every practice area</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                {rest.map((t, i) =>
              <div key={t.id} className="scroll-reveal-hidden bg-card border border-border card-rounded p-7 flex flex-col" style={{ transitionDelay: `${i * 0.08}s` }}>
                    <StarRating rating={t.rating} />
                    <p className="font-serif text-3xl text-accent/25 leading-none mt-4 mb-3">"</p>
                    <p className="text-sm text-muted-foreground leading-relaxed font-light italic flex-1">{t.full_quote}</p>
                    <div className="mt-6 pt-5 border-t border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                          <AppImage src={t.image} alt={t.alt} width={36} height={36} className="object-cover w-full h-full" />
                        </div>
                        <div>
                          <p className="font-serif text-sm text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground/70">{t.location}</p>
                        <span className="text-xs font-medium text-accent/70 bg-accent/8 px-2.5 py-1 rounded-full border border-accent/15">{t.service}</span>
                      </div>
                    </div>
                  </div>
              )}
              </div>
            </div>
          </section>
        }

        {/* CTA Section */}
        <section className="py-20 md:py-28 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-accent/8 blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
            <div className="scroll-reveal-hidden max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent mb-5 flex items-center gap-3">
                <span className="w-6 h-px bg-accent" />
                Ready to work together?
              </p>
              <h2 className="font-serif text-4xl md:text-5xl text-primary-foreground leading-tight mb-6">
                Join the attorneys
                <br />
                <span className="italic opacity-75">who trust Maggi May</span>
              </h2>
              <p className="text-base text-primary-foreground/60 leading-relaxed mb-10 max-w-lg">
                From solo practitioners to multi-attorney firms — get the paralegal support your practice deserves, without the overhead.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent text-accent-foreground rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity">
                  Start a Conversation
                </Link>
                <Link href="/case-studies" className="inline-flex items-center gap-2 px-8 py-3.5 border border-primary-foreground/20 text-primary-foreground/80 rounded-full text-xs font-semibold uppercase tracking-widest hover:border-primary-foreground/40 hover:text-primary-foreground transition-all">
                  View Case Studies
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Submit a Testimonial */}
        <section className="py-16 md:py-24 bg-secondary/40">
          <div className="max-w-2xl mx-auto px-5 md:px-10">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent mb-4 flex items-center justify-center gap-3">
                <span className="w-6 h-px bg-accent" />
                Share Your Experience
              </p>
              <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">Leave a Review</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Worked with Maggi May? We'd love to hear about your experience. Your review helps other attorneys find the right paralegal support.
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-7 md:p-10">
              <TestimonialSubmissionForm />
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>);

}