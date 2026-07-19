'use client';

import React, { useState, use } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BookConsultationModal from '@/components/BookConsultationModal';

const PRACTICE_AREAS: Record<string, {
  slug: string;
  title: string;
  headline: string;
  description: string;
  services: string[];
  faqs: { q: string; a: string }[];
  icon: string;
  color: string;
}> = {
  'family-law': {
    slug: 'family-law',
    title: 'Family Law Paralegal Support',
    headline: 'Expert Paralegal Assistance for Family Law Matters',
    description: 'Broussard Legal Services provides comprehensive paralegal support for family law attorneys — from divorce filings and custody agreements to adoption paperwork and protective orders. Remote, reliable, and nationwide.',
    services: [
      'Divorce petition drafting & filing preparation',
      'Child custody & support agreement drafting',
      'Adoption paperwork & home study coordination',
      'Protective order preparation',
      'Property settlement agreement drafting',
      'Parenting plan preparation',
      'Mediation summary preparation',
      'Client intake & questionnaire management',
    ],
    faqs: [
      { q: 'Can a paralegal draft divorce papers?', a: 'Yes. Under attorney supervision, a paralegal can draft divorce petitions, property settlement agreements, and parenting plans. All documents are reviewed by a licensed attorney before filing.' },
      { q: 'How long does family law document preparation take?', a: 'Standard turnaround is 24–48 hours for most family law documents. Complex matters such as contested divorces may require 3–5 business days.' },
      { q: 'Do you handle emergency protective orders?', a: 'Yes. We offer expedited preparation for emergency protective orders and temporary restraining orders. Contact us immediately for urgent matters.' },
    ],
    icon: '👨‍👩‍👧',
    color: 'from-rose-50 to-pink-50',
  },
  'contracts': {
    slug: 'contracts',
    title: 'Contract Review & Drafting Paralegal Support',
    headline: 'Precise Contract Review and Drafting Assistance',
    description: 'Thorough contract review, redlining, and drafting support for business and personal agreements. Broussard Legal Services helps attorneys deliver faster, more accurate contract work at scale.',
    services: [
      'Contract review & redlining',
      'NDA drafting & review',
      'Service agreement preparation',
      'Lease agreement review',
      'Employment contract review',
      'Vendor agreement drafting',
      'Contract summary memos',
      'Clause library management',
    ],
    faqs: [
      { q: 'What types of contracts can you review?', a: 'We review commercial contracts, NDAs, service agreements, employment contracts, lease agreements, vendor agreements, and more — all under attorney supervision.' },
      { q: 'How quickly can you turn around a contract review?', a: 'Standard contract reviews are completed within 24–48 hours. Rush reviews for urgent matters can be completed same-day.' },
      { q: 'Do you provide redlined documents?', a: 'Yes. We provide fully redlined documents with tracked changes and a summary memo highlighting key issues and recommended revisions.' },
    ],
    icon: '📄',
    color: 'from-blue-50 to-indigo-50',
  },
  'business': {
    slug: 'business',
    title: 'Business & Corporate Paralegal Support',
    headline: 'Corporate Paralegal Services for Business Attorneys',
    description: 'From entity formation to corporate governance, Broussard Legal Services supports business and corporate attorneys with precise, efficient paralegal work — remote and nationwide.',
    services: [
      'Entity formation document preparation',
      'Operating agreement drafting',
      'Corporate minute book maintenance',
      'Annual report preparation',
      'Registered agent coordination',
      'Business license research',
      'Due diligence document review',
      'Merger & acquisition document support',
    ],
    faqs: [
      { q: 'Can you help with LLC formation documents?', a: 'Yes. We prepare articles of organization, operating agreements, and initial resolutions for LLCs, corporations, and other business entities under attorney supervision.' },
      { q: 'Do you handle corporate minute books?', a: 'Yes. We maintain and update corporate minute books, including annual meeting minutes, resolutions, and officer/director records.' },
      { q: 'Can you assist with due diligence reviews?', a: 'Yes. We organize and review due diligence documents, prepare summaries, and flag key issues for attorney review in M&A and financing transactions.' },
    ],
    icon: '🏢',
    color: 'from-amber-50 to-yellow-50',
  },
  'litigation': {
    slug: 'litigation',
    title: 'Litigation Support Paralegal Services',
    headline: 'Full-Service Litigation Support for Trial Attorneys',
    description: 'Comprehensive litigation support from complaint drafting through trial preparation. Broussard Legal Services helps litigation attorneys stay organized, meet deadlines, and win cases.',
    services: [
      'Complaint & answer drafting',
      'Discovery request preparation',
      'Deposition summary preparation',
      'Trial exhibit organization',
      'Case chronology preparation',
      'Legal research & memo drafting',
      'Court filing coordination',
      'Settlement demand letter drafting',
    ],
    faqs: [
      { q: 'What litigation support services do you offer?', a: 'We offer complaint drafting, discovery preparation, deposition summaries, trial exhibit organization, case chronologies, legal research, court filing coordination, and settlement demand letters.' },
      { q: 'Can you help with e-discovery?', a: 'Yes. We assist with document review, privilege log preparation, and e-discovery organization under attorney supervision.' },
      { q: 'Do you prepare deposition summaries?', a: 'Yes. We prepare comprehensive deposition summaries with page-line references, key testimony highlights, and contradiction analysis.' },
    ],
    icon: '⚖️',
    color: 'from-slate-50 to-gray-50',
  },
  'estate-planning': {
    slug: 'estate-planning',
    title: 'Estate Planning Paralegal Support',
    headline: 'Estate Planning Document Preparation & Probate Support',
    description: 'Broussard Legal Services supports estate planning and probate attorneys with precise document preparation, client intake management, and probate administration assistance.',
    services: [
      'Will & trust drafting assistance',
      'Power of attorney preparation',
      'Healthcare directive drafting',
      'Probate petition preparation',
      'Estate inventory preparation',
      'Beneficiary designation review',
      'Client intake & asset questionnaires',
      'Trust administration support',
    ],
    faqs: [
      { q: 'Can a paralegal prepare a will?', a: 'Under attorney supervision, a paralegal can draft will documents based on attorney instructions and client information. All documents are reviewed and signed off by a licensed attorney.' },
      { q: 'Do you handle probate administration?', a: 'Yes. We assist with probate petition preparation, estate inventory, creditor notices, and court filing coordination under attorney supervision.' },
      { q: 'Can you prepare trust documents?', a: 'Yes. We prepare revocable living trusts, irrevocable trusts, special needs trusts, and other trust documents under attorney direction.' },
    ],
    icon: '🏛️',
    color: 'from-emerald-50 to-teal-50',
  },
  'real-estate': {
    slug: 'real-estate',
    title: 'Real Estate Paralegal Support',
    headline: 'Real Estate Transaction & Closing Support',
    description: 'From purchase agreements to closing coordination, Broussard Legal Services provides expert paralegal support for real estate attorneys handling residential and commercial transactions.',
    services: [
      'Purchase agreement review & preparation',
      'Title search coordination',
      'Closing document preparation',
      'Deed drafting & recording coordination',
      'Lease agreement review',
      'Mortgage document review',
      'HOA document review',
      'Real estate due diligence support',
    ],
    faqs: [
      { q: 'Can you help with real estate closings?', a: 'Yes. We prepare closing documents, coordinate with title companies, review HUD-1/ALTA settlement statements, and organize all closing materials under attorney supervision.' },
      { q: 'Do you handle commercial real estate transactions?', a: 'Yes. We support commercial real estate transactions including purchase agreements, lease negotiations, due diligence reviews, and closing coordination.' },
      { q: 'Can you prepare deeds?', a: 'Yes. We draft warranty deeds, quitclaim deeds, and other deed types under attorney supervision, and coordinate recording with the appropriate county clerk.' },
    ],
    icon: '🏠',
    color: 'from-cyan-50 to-sky-50',
  },
};

export default function PracticeAreaPage({ params }: { params: Promise<{ 'practice-area': string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams['practice-area'];
  const area = PRACTICE_AREAS[slug];
  const [bookingOpen, setBookingOpen] = useState(false);

  if (!area) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: area.title,
    description: area.description,
    provider: {
      '@type': 'ProfessionalService',
      name: 'Broussard Legal Services',
      url: baseUrl,
      telephone: '',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'New Orleans',
        addressRegion: 'LA',
        addressCountry: 'US',
      },
    },
    serviceType: 'Paralegal Services',
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    url: `${baseUrl}/services/${slug}`,
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: area.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <Header />

      {/* Hero */}
      <section className={`bg-gradient-to-br ${area.color} pt-32 pb-16 px-5 md:px-10`}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/services" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Services</Link>
            <span className="text-slate-400">/</span>
            <span className="text-sm text-slate-700 font-medium">{area.title}</span>
          </div>
          <div className="text-5xl mb-4">{area.icon}</div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-[#1b2a4a] mb-4 leading-tight">
            {area.headline}
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mb-8 leading-relaxed">
            {area.description}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#1b2a4a] text-white rounded-full text-sm font-semibold hover:bg-[#1b2a4a]/90 transition-all duration-300"
            >
              Book a Free Consultation
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 border border-[#1b2a4a]/30 text-[#1b2a4a] rounded-full text-sm font-semibold hover:border-[#1b2a4a] transition-all duration-300"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Paralegal Disclaimer */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-3">
          <p className="text-amber-800 text-xs text-center leading-relaxed">
            <strong>Paralegal Disclaimer:</strong> All paralegal services are provided under the supervision of a licensed attorney. This does not constitute legal advice.{' '}
            <Link href="/disclaimers" className="underline hover:text-amber-900">View full disclaimer →</Link>
          </p>
        </div>
      </div>

      {/* Services List */}
      <section className="py-16 px-5 md:px-10 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-[#1b2a4a] mb-8">What We Handle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {area.services.map((service, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50">
                <span className="text-emerald-500 mt-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <span className="text-sm text-slate-700 font-medium">{service}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-5 md:px-10 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-[#1b2a4a] mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {area.faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-[#1b2a4a] mb-2">{faq.q}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-5 md:px-10 bg-[#1b2a4a]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-serif font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-white/70 mb-8">Book a free consultation to discuss your {area.title.toLowerCase()} needs.</p>
          <button
            onClick={() => setBookingOpen(true)}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#1b2a4a] rounded-full text-sm font-bold hover:bg-white/90 transition-all duration-300"
          >
            Book Free Consultation
          </button>
        </div>
      </section>

      {/* All Practice Areas */}
      <section className="py-12 px-5 md:px-10 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-6">All Practice Areas</h3>
          <div className="flex flex-wrap gap-3">
            {Object.values(PRACTICE_AREAS).map((pa) => (
              <Link
                key={pa.slug}
                href={`/services/${pa.slug}`}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                  pa.slug === slug
                    ? 'bg-[#1b2a4a] text-white border-[#1b2a4a]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#1b2a4a] hover:text-[#1b2a4a]'
                }`}
              >
                <span>{pa.icon}</span>
                {pa.title.split(' Paralegal')[0].split(' Support')[0]}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />

      {bookingOpen && (
        <BookConsultationModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} />
      )}
    </>
  );
}
