import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PracticeAreaClient from './PracticeAreaClient';

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

type Props = {
  params: Promise<{ 'practice-area': string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'practice-area': slug } = await params;
  const area = PRACTICE_AREAS[slug];
  if (!area) return {};
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
  return {
    title: `${area.title} | Broussard Legal Services`,
    description: area.description,
    alternates: { canonical: `${baseUrl}/services/${slug}` },
  };
}

export default async function PracticeAreaPage({ params }: Props) {
  const { 'practice-area': slug } = await params;
  const area = PRACTICE_AREAS[slug];

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
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'New Orleans',
        addressRegion: 'LA',
        addressCountry: 'US',
      },
    },
    serviceType: 'Paralegal Services',
    areaServed: { '@type': 'Country', name: 'United States' },
    url: `${baseUrl}/services/${slug}`,
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: area.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <PracticeAreaClient
        area={area}
        allAreas={Object.values(PRACTICE_AREAS)}
        slug={slug}
      />
    </>
  );
}
