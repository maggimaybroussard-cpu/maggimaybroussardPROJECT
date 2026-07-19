'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BookConsultationModal from '@/components/BookConsultationModal';

interface PracticeArea {
  slug: string;
  title: string;
  headline: string;
  description: string;
  services: string[];
  faqs: { q: string; a: string }[];
  icon: string;
  color: string;
}

interface Props {
  area: PracticeArea;
  allAreas: PracticeArea[];
  slug: string;
}

export default function PracticeAreaClient({ area, allAreas, slug }: Props) {
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <>
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
            {allAreas.map((pa) => (
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
