import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// ── Practice area data ─────────────────────────────────────────────────────────

interface PracticeArea {
  slug: string;
  title: string;
  headline: string;
  description: string;
  longDescription: string;
  services: string[];
  faqs: { question: string; answer: string }[];
  icon: string;
  color: string;
}

const PRACTICE_AREAS: PracticeArea[] = [
  {
    slug: 'family-law',
    title: 'Family Law',
    headline: 'Family Law Paralegal Support — Divorce, Custody & More',
    description: 'Expert paralegal support for family law matters including divorce, child custody, adoption, and domestic relations.',
    longDescription: 'Family law matters are among the most emotionally charged legal proceedings. Broussard Legal Services provides experienced paralegal support for family law attorneys handling divorce, child custody and support, adoption, guardianship, domestic violence protective orders, and property division. We handle document drafting, research, case management, and client intake so your attorneys can focus on advocacy.',
    services: [
      'Divorce petition drafting and filing preparation',
      'Child custody agreement drafting',
      'Child support calculation worksheets',
      'Adoption paperwork and home study coordination',
      'Domestic violence protective order preparation',
      'Property division analysis and documentation',
      'Parenting plan drafting',
      'Mediation preparation and summaries',
    ],
    faqs: [
      {
        question: 'What family law documents can a paralegal draft?',
        answer: 'A paralegal can draft divorce petitions, custody agreements, child support worksheets, parenting plans, property settlement agreements, and adoption paperwork — all under attorney supervision.',
      },
      {
        question: 'How does paralegal support reduce family law costs?',
        answer: 'Paralegals handle document-intensive tasks at a lower billing rate than attorneys, reducing overall legal fees while maintaining quality. Research, drafting, and case management are all handled efficiently.',
      },
      {
        question: 'Can you help with emergency protective orders?',
        answer: 'Yes. We can assist with emergency protective order paperwork preparation on an expedited basis. Contact us directly for urgent family law matters.',
      },
    ],
    icon: '👨‍👩‍👧',
    color: '#355E3B',
  },
  {
    slug: 'contracts',
    title: 'Contracts & Business Agreements',
    headline: 'Contract Review & Drafting Paralegal Support',
    description: 'Professional paralegal support for contract drafting, review, and negotiation across all business agreement types.',
    longDescription: 'Contracts are the foundation of every business relationship. Broussard Legal Services provides thorough paralegal support for contract attorneys handling commercial agreements, vendor contracts, employment agreements, NDAs, licensing agreements, and more. We draft, review, redline, and organize contracts with precision and speed.',
    services: [
      'Commercial contract drafting and redlining',
      'NDA and confidentiality agreement preparation',
      'Employment agreement and offer letter drafting',
      'Vendor and supplier contract review',
      'Licensing and IP agreement support',
      'Contract clause library management',
      'Contract comparison and summary memos',
      'Signature coordination and execution tracking',
    ],
    faqs: [
      {
        question: 'What types of contracts can a paralegal review?',
        answer: 'Paralegals can review commercial contracts, NDAs, employment agreements, vendor contracts, licensing agreements, service agreements, and more — flagging issues for attorney review.',
      },
      {
        question: 'How quickly can contract review be completed?',
        answer: 'Standard contract review turnaround is 24–48 hours. Rush review is available for urgent matters. Complex multi-party agreements may require additional time.',
      },
      {
        question: 'Do you handle contract redlining?',
        answer: 'Yes. We provide detailed redline markups with tracked changes and a summary memo explaining each proposed modification and its rationale.',
      },
    ],
    icon: '📄',
    color: '#1d4ed8',
  },
  {
    slug: 'business-law',
    title: 'Business Law',
    headline: 'Business Law Paralegal Support — Formation to Compliance',
    description: 'Comprehensive paralegal support for business law attorneys handling entity formation, corporate governance, and compliance.',
    longDescription: 'From startup formation to ongoing corporate compliance, Broussard Legal Services supports business law attorneys with entity formation documents, operating agreements, corporate minutes, regulatory filings, and transactional support. We handle the document-intensive work so your attorneys can focus on strategy and client relationships.',
    services: [
      'LLC and corporation formation documents',
      'Operating agreement and bylaw drafting',
      'Corporate minutes and resolutions',
      'Annual report and compliance filing preparation',
      'Business purchase and sale agreement support',
      'Due diligence checklist management',
      'Regulatory research and compliance memos',
      'UCC filing preparation',
    ],
    faqs: [
      {
        question: 'What business formation documents can a paralegal prepare?',
        answer: 'Paralegals can prepare articles of incorporation, articles of organization, operating agreements, bylaws, initial resolutions, and EIN application materials under attorney supervision.',
      },
      {
        question: 'Can you assist with business acquisitions?',
        answer: 'Yes. We support M&A transactions with due diligence checklists, document organization, entity research, and drafting of ancillary transaction documents.',
      },
      {
        question: 'Do you handle ongoing corporate compliance?',
        answer: 'Yes. We track annual report deadlines, prepare corporate minutes, draft resolutions, and maintain corporate record books for ongoing compliance.',
      },
    ],
    icon: '🏢',
    color: '#7c3aed',
  },
  {
    slug: 'litigation-support',
    title: 'Litigation Support',
    headline: 'Litigation Support Paralegal Services — Trial Ready',
    description: 'Full-service litigation support including discovery management, deposition prep, trial preparation, and court filing assistance.',
    longDescription: 'Litigation is document-intensive and deadline-driven. Broussard Legal Services provides comprehensive litigation support including discovery management, deposition preparation, trial exhibit organization, court filing coordination, legal research, and case timeline management. We keep your cases organized and your deadlines met.',
    services: [
      'Discovery request and response drafting',
      'Document review and privilege log preparation',
      'Deposition summary and outline preparation',
      'Trial exhibit organization and indexing',
      'Court filing preparation and coordination',
      'Case chronology and timeline creation',
      'Legal research memos and case law summaries',
      'Witness list and contact management',
    ],
    faqs: [
      {
        question: 'What litigation support tasks can a paralegal handle?',
        answer: 'Paralegals handle discovery drafting and responses, document review, deposition prep, exhibit organization, court filing coordination, legal research, and case management.',
      },
      {
        question: 'Can you assist with e-discovery?',
        answer: 'Yes. We assist with document collection, review, privilege log preparation, and production coordination for electronic discovery matters.',
      },
      {
        question: 'Do you handle multi-jurisdiction litigation?',
        answer: 'Yes. We support litigation in federal and state courts across all 50 states, with experience in multi-district litigation and complex commercial cases.',
      },
    ],
    icon: '⚖️',
    color: '#b45309',
  },
  {
    slug: 'estate-planning',
    title: 'Estate Planning & Probate',
    headline: 'Estate Planning Paralegal Support — Wills, Trusts & Probate',
    description: 'Paralegal support for estate planning attorneys handling wills, trusts, powers of attorney, and probate administration.',
    longDescription: 'Estate planning requires careful document preparation and client communication. Broussard Legal Services supports estate planning attorneys with will and trust drafting, beneficiary designation reviews, power of attorney preparation, healthcare directive drafting, and probate administration support.',
    services: [
      'Will and testament drafting',
      'Revocable and irrevocable trust preparation',
      'Power of attorney document drafting',
      'Healthcare directive and living will preparation',
      'Beneficiary designation review and coordination',
      'Probate petition and inventory preparation',
      'Estate administration correspondence',
      'Asset transfer documentation',
    ],
    faqs: [
      {
        question: 'What estate planning documents can a paralegal draft?',
        answer: 'Paralegals draft wills, trusts, powers of attorney, healthcare directives, living wills, and beneficiary designation forms under attorney supervision.',
      },
      {
        question: 'Can you assist with probate administration?',
        answer: 'Yes. We assist with probate petitions, inventory preparation, creditor notices, estate accounting, and distribution documentation.',
      },
      {
        question: 'Do you handle special needs trusts?',
        answer: 'Yes. We support drafting of special needs trusts, supplemental needs trusts, and other specialized estate planning instruments.',
      },
    ],
    icon: '📋',
    color: '#0f766e',
  },
  {
    slug: 'real-estate',
    title: 'Real Estate Law',
    headline: 'Real Estate Paralegal Support — Transactions & Closings',
    description: 'Paralegal support for real estate attorneys handling residential and commercial transactions, closings, and title matters.',
    longDescription: 'Real estate transactions require precise documentation and tight deadline management. Broussard Legal Services supports real estate attorneys with purchase agreement review, title search coordination, closing document preparation, deed drafting, and post-closing follow-up.',
    services: [
      'Purchase and sale agreement review',
      'Title search coordination and review',
      'Closing document preparation and checklist',
      'Deed drafting and recording preparation',
      'Mortgage document review',
      'Lease agreement drafting and review',
      'HOA document review and summary',
      'Post-closing document organization',
    ],
    faqs: [
      {
        question: 'What real estate documents can a paralegal prepare?',
        answer: 'Paralegals prepare deeds, closing checklists, purchase agreement summaries, lease agreements, title commitment reviews, and post-closing document packages.',
      },
      {
        question: 'Can you assist with commercial real estate transactions?',
        answer: 'Yes. We support commercial purchases, sales, leases, and financing transactions with document preparation, due diligence support, and closing coordination.',
      },
      {
        question: 'Do you handle landlord-tenant matters?',
        answer: 'Yes. We assist with lease drafting, eviction notice preparation, security deposit documentation, and landlord-tenant compliance research.',
      },
    ],
    icon: '🏠',
    color: '#0369a1',
  },
];

const PRACTICE_AREA_MAP = new Map(PRACTICE_AREAS.map((pa) => [pa.slug, pa]));

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ 'practice-area': string }>;
}): Promise<Metadata> {
  const { 'practice-area': slug } = await params;
  const area = PRACTICE_AREA_MAP.get(slug);
  if (!area) return { title: 'Not Found' };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
  return {
    title: `${area.headline} — Broussard Legal Services`,
    description: area.description,
    alternates: { canonical: `${baseUrl}/services/${slug}` },
    openGraph: {
      title: `${area.headline} — Broussard Legal Services`,
      description: area.description,
      url: `${baseUrl}/services/${slug}`,
      type: 'website',
      images: [{ url: '/assets/images/og-image.png', width: 1200, height: 630, alt: area.title }],
    },
  };
}

export function generateStaticParams() {
  return PRACTICE_AREAS.map((pa) => ({ 'practice-area': pa.slug }));
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PracticeAreaPage({
  params,
}: {
  params: Promise<{ 'practice-area': string }>;
}) {
  const { 'practice-area': slug } = await params;
  const area = PRACTICE_AREA_MAP.get(slug);
  if (!area) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/broussardlegal';

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: area.headline,
    description: area.longDescription,
    provider: {
      '@type': 'ProfessionalService',
      name: 'Broussard Legal Services',
      url: baseUrl,
      telephone: '+1-504-458-2831',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '900 Camp Street Suite 3rd Fl. PMB 70111',
        addressLocality: 'New Orleans',
        addressRegion: 'LA',
        postalCode: '70130',
        addressCountry: 'US',
      },
    },
    areaServed: { '@type': 'Country', name: 'US' },
    url: `${baseUrl}/services/${slug}`,
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: area.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${baseUrl}/services` },
      { '@type': 'ListItem', position: 3, name: area.title, item: `${baseUrl}/services/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <Header />

      <main className="min-h-screen" style={{ background: '#FAF7F2' }}>
        {/* Hero */}
        <section className="pt-24 pb-16 px-4" style={{ background: `linear-gradient(135deg, #FAF7F2 0%, #F5EDE0 100%)` }}>
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm mb-8" style={{ color: '#7A6B5D' }}>
              <Link href="/" className="hover:underline">Home</Link>
              <span>/</span>
              <Link href="/services" className="hover:underline">Services</Link>
              <span>/</span>
              <span style={{ color: '#4A3728' }}>{area.title}</span>
            </nav>

            <div className="flex items-center gap-4 mb-6">
              <span className="text-5xl">{area.icon}</span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: area.color }}>
                  Practice Area
                </p>
                <h1 className="text-4xl font-bold leading-tight" style={{ color: '#2C1F14' }}>
                  {area.title}
                </h1>
              </div>
            </div>

            <p className="text-xl leading-relaxed mb-8 max-w-3xl" style={{ color: '#4A3728' }}>
              {area.longDescription}
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href={calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ background: area.color }}
              >
                Book a Free Consultation
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border transition-all hover:bg-white"
                style={{ color: '#4A3728', borderColor: '#D9D0C5' }}
              >
                All Services
              </Link>
            </div>
          </div>
        </section>

        {/* Services list */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8" style={{ color: '#2C1F14' }}>
              {area.title} Paralegal Services
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {area.services.map((service, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-xl border bg-white"
                  style={{ borderColor: '#D9D0C5' }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-xs font-bold"
                    style={{ background: area.color }}
                  >
                    ✓
                  </span>
                  <span style={{ color: '#2C1F14' }}>{service}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4" style={{ background: '#F5EDE0' }}>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-8" style={{ color: '#2C1F14' }}>
              Frequently Asked Questions — {area.title}
            </h2>
            <div className="space-y-4">
              {area.faqs.map((faq, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border" style={{ borderColor: '#D9D0C5' }}>
                  <h3 className="font-semibold mb-2" style={{ color: '#2C1F14' }}>{faq.question}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#4A3728' }}>{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#2C1F14' }}>
              Ready to Get Started with {area.title} Support?
            </h2>
            <p className="mb-8" style={{ color: '#4A3728' }}>
              Book a free 15-minute consultation to discuss your {area.title.toLowerCase()} paralegal needs.
            </p>
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all hover:opacity-90"
              style={{ background: area.color }}
            >
              Book Free Consultation
            </a>
          </div>
        </section>

        {/* Other practice areas */}
        <section className="py-16 px-4 border-t" style={{ borderColor: '#D9D0C5' }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1F14' }}>Other Practice Areas</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {PRACTICE_AREAS.filter((pa) => pa.slug !== slug).map((pa) => (
                <Link
                  key={pa.slug}
                  href={`/services/${pa.slug}`}
                  className="flex items-center gap-3 p-4 rounded-xl border bg-white hover:shadow-sm transition-all"
                  style={{ borderColor: '#D9D0C5' }}
                >
                  <span className="text-2xl">{pa.icon}</span>
                  <span className="font-medium text-sm" style={{ color: '#2C1F14' }}>{pa.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
