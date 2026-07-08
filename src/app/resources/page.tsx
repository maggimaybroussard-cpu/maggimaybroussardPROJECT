'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { trackEvent } from '@/lib/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'guide' | 'template' | 'checklist' | 'faq' | 'article';
  href: string;
  external?: boolean;
  badge?: string;
  readTime?: string;
  icon: string;
}

interface Category {
  id: string;
  label: string;
  count: number;
}

// ─── Resources Data ───────────────────────────────────────────────────────────
const RESOURCES: Resource[] = [
  {
    id: 'intake-checklist',
    title: 'Client Intake Checklist',
    description: 'Everything you need to prepare before your first consultation — documents, case facts, and key questions to bring.',
    category: 'Getting Started',
    type: 'checklist',
    href: '/portal/intake',
    badge: 'Essential',
    readTime: '3 min',
    icon: '📋',
  },
  {
    id: 'paralegal-vs-attorney',
    title: 'Paralegal vs. Attorney: What\'s the Difference?',
    description: 'Understand exactly what a contract paralegal can and cannot do, and how working with one saves you time and money.',
    category: 'Getting Started',
    type: 'guide',
    href: '/blog',
    readTime: '5 min',
    icon: '⚖️',
  },
  {
    id: 'discovery-guide',
    title: 'Discovery Process Guide',
    description: 'A plain-language walkthrough of interrogatories, requests for production, depositions, and privilege logs.',
    category: 'Litigation Support',
    type: 'guide',
    href: '/services',
    readTime: '8 min',
    icon: '🔍',
  },
  {
    id: 'motion-drafting-tips',
    title: 'Motion Drafting Best Practices',
    description: 'Key formatting rules, citation standards, and structural tips for court-ready motions in Louisiana and federal courts.',
    category: 'Litigation Support',
    type: 'article',
    href: '/services',
    readTime: '6 min',
    icon: '📄',
  },
  {
    id: 'retainer-agreement-guide',
    title: 'Understanding Your Retainer Agreement',
    description: 'What\'s included in a monthly retainer, how hours are tracked, and what happens when you need more support.',
    category: 'Billing & Retainers',
    type: 'guide',
    href: '/retainer-contract',
    badge: 'Popular',
    readTime: '4 min',
    icon: '🤝',
  },
  {
    id: 'invoice-payment-guide',
    title: 'How to Pay Your Invoice',
    description: 'Step-by-step guide to paying via the client portal, ACH, or credit card — and what to do if you have a billing question.',
    category: 'Billing & Retainers',
    type: 'guide',
    href: '/portal/invoices',
    readTime: '2 min',
    icon: '💳',
  },
  {
    id: 'document-prep-checklist',
    title: 'Document Preparation Checklist',
    description: 'Before submitting documents for drafting or review, use this checklist to ensure nothing is missing.',
    category: 'Document Services',
    type: 'checklist',
    href: '/services',
    readTime: '3 min',
    icon: '✅',
  },
  {
    id: 'legal-research-request',
    title: 'How to Submit a Legal Research Request',
    description: 'What information to include, how to frame your research question, and what to expect in your memo.',
    category: 'Document Services',
    type: 'guide',
    href: '/services',
    readTime: '4 min',
    icon: '📚',
  },
  {
    id: 'case-management-faq',
    title: 'Case Management FAQ',
    description: 'Answers to the most common questions about case timelines, status updates, document access, and communication.',
    category: 'Case Management',
    type: 'faq',
    href: '/portal/cases',
    badge: 'New',
    readTime: '5 min',
    icon: '❓',
  },
  {
    id: 'portal-guide',
    title: 'Client Portal Quick-Start Guide',
    description: 'How to log in, view your case status, download documents, send messages, and pay invoices — all in one place.',
    category: 'Case Management',
    type: 'guide',
    href: '/portal/dashboard',
    readTime: '4 min',
    icon: '🖥️',
  },
  {
    id: 'consultation-prep',
    title: 'How to Prepare for Your Consultation',
    description: 'Maximize your 30-minute consultation by knowing what to bring, what to say, and what questions to ask.',
    category: 'Getting Started',
    type: 'checklist',
    href: '/availability',
    badge: 'Essential',
    readTime: '3 min',
    icon: '🗓️',
  },
  {
    id: 'contract-review-guide',
    title: 'Contract Review: What to Look For',
    description: 'Red flags, key clauses, and common pitfalls in contracts — what a paralegal review covers and why it matters.',
    category: 'Document Services',
    type: 'article',
    href: '/services',
    readTime: '7 min',
    icon: '🔎',
  },
];

const TYPE_LABELS: Record<Resource['type'], string> = {
  guide: 'Guide',
  template: 'Template',
  checklist: 'Checklist',
  faq: 'FAQ',
  article: 'Article',
};

const TYPE_COLORS: Record<Resource['type'], string> = {
  guide: 'bg-[#EAF2EB] text-[#355E3B]',
  template: 'bg-[#F5EDE0] text-[#8B6020]',
  checklist: 'bg-[#EDE8E0] text-[#4A3728]',
  faq: 'bg-[#F0EAF5] text-[#6B3FA0]',
  article: 'bg-[#E8F0F5] text-[#1B4A6B]',
};

const BADGE_COLORS: Record<string, string> = {
  Essential: 'bg-[#8B3A45] text-white',
  Popular: 'bg-[#C8965A] text-white',
  New: 'bg-[#355E3B] text-white',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ResourcesHubPage() {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeType, setActiveType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Track page view in GA
    trackEvent('resources_hub_view', {
      event_category: 'engagement',
      event_label: 'Resources Hub Page',
      page: 'resources',
    });
  }, []);

  // Build category list
  const categories: Category[] = [
    { id: 'All', label: 'All Resources', count: RESOURCES.length },
    ...Array.from(new Set(RESOURCES.map((r) => r.category))).map((cat) => ({
      id: cat,
      label: cat,
      count: RESOURCES.filter((r) => r.category === cat).length,
    })),
  ];

  const types = ['All', ...Array.from(new Set(RESOURCES.map((r) => r.type)))];

  // Filter resources
  const filtered = RESOURCES.filter((r) => {
    const matchCat = activeCategory === 'All' || r.category === activeCategory;
    const matchType = activeType === 'All' || r.type === activeType;
    const matchSearch =
      !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchType && matchSearch;
  });

  const handleResourceClick = (resource: Resource) => {
    trackEvent('resource_click', {
      event_category: 'engagement',
      event_label: resource.title,
      resource_id: resource.id,
      resource_type: resource.type,
      resource_category: resource.category,
    });
  };

  if (!mounted) return null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FAF7F2]">
        {/* ── Hero ── */}
        <section className="relative pt-32 pb-16 px-4 overflow-hidden">
          {/* Background texture */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, rgba(200,150,90,0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(53,94,59,0.1) 0%, transparent 40%)`,
            }}
          />
          <div className="relative max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block w-8 h-px bg-[#C8965A]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C8965A]">
                Knowledge Base
              </span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl text-[#2C1F14] mb-4 leading-tight">
              Resources Hub
            </h1>
            <p className="text-[#7A6B5D] text-lg max-w-2xl leading-relaxed mb-8">
              Guides, checklists, and answers to help you navigate your legal support journey — from your first consultation to case close.
            </p>

            {/* Search */}
            <div className="relative max-w-lg">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7A6B5D]"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Search resources…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 2) {
                    trackEvent('resources_search', {
                      event_category: 'engagement',
                      search_term: e.target.value,
                    });
                  }
                }}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#D9D0C5] bg-white text-[#2C1F14] placeholder-[#B0A090] text-sm focus:outline-none focus:ring-2 focus:ring-[#C8965A]/40 focus:border-[#C8965A] transition-all"
              />
            </div>
          </div>
        </section>

        {/* ── Filters ── */}
        <section className="px-4 pb-8">
          <div className="max-w-5xl mx-auto">
            {/* Category pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    trackEvent('resources_filter_category', {
                      event_category: 'engagement',
                      filter_value: cat.id,
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                    activeCategory === cat.id
                      ? 'bg-[#4A3728] text-white shadow-sm'
                      : 'bg-white text-[#7A6B5D] border border-[#D9D0C5] hover:border-[#C8965A] hover:text-[#4A3728]'
                  }`}
                >
                  {cat.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-[#EDE8E0] text-[#7A6B5D]'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    activeType === type
                      ? 'bg-[#C8965A] text-white'
                      : 'bg-[#EDE8E0] text-[#7A6B5D] hover:bg-[#D9D0C5]'
                  }`}
                >
                  {type === 'All' ? 'All Types' : TYPE_LABELS[type as Resource['type']] ?? type}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Resource Grid ── */}
        <section className="px-4 pb-20">
          <div className="max-w-5xl mx-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🔍</p>
                <p className="text-[#7A6B5D] text-lg">No resources match your search.</p>
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('All'); setActiveType('All'); }}
                  className="mt-4 text-[#C8965A] text-sm font-semibold hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <p className="text-[#7A6B5D] text-sm mb-6">
                  Showing <span className="font-semibold text-[#4A3728]">{filtered.length}</span> resource{filtered.length !== 1 ? 's' : ''}
                </p>

                {/* Bento-style grid — varied sizes */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((resource, idx) => {
                    const isFeatured = idx === 0 && activeCategory === 'All' && !searchQuery;
                    return (
                      <Link
                        key={resource.id}
                        href={resource.href}
                        onClick={() => handleResourceClick(resource)}
                        className={`group relative bg-white rounded-2xl border border-[#D9D0C5] p-6 hover:border-[#C8965A] hover:shadow-lg transition-all duration-300 flex flex-col ${
                          isFeatured ? 'md:col-span-2 lg:col-span-2' : ''
                        }`}
                        target={resource.external ? '_blank' : undefined}
                        rel={resource.external ? 'noopener noreferrer' : undefined}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between mb-4">
                          <span className="text-3xl" role="img" aria-label={resource.title}>
                            {resource.icon}
                          </span>
                          <div className="flex items-center gap-2">
                            {resource.badge && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${BADGE_COLORS[resource.badge] ?? 'bg-[#EDE8E0] text-[#4A3728]'}`}>
                                {resource.badge}
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${TYPE_COLORS[resource.type]}`}>
                              {TYPE_LABELS[resource.type]}
                            </span>
                          </div>
                        </div>

                        {/* Category */}
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#C8965A] mb-2">
                          {resource.category}
                        </p>

                        {/* Title */}
                        <h2 className="font-serif text-lg text-[#2C1F14] mb-2 leading-snug group-hover:text-[#8B3A45] transition-colors duration-200">
                          {resource.title}
                        </h2>

                        {/* Description */}
                        <p className="text-[#7A6B5D] text-sm leading-relaxed flex-1 mb-4">
                          {resource.description}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#EDE8E0]">
                          {resource.readTime && (
                            <span className="text-[11px] text-[#B0A090] flex items-center gap-1">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              {resource.readTime} read
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-[#C8965A] flex items-center gap-1 group-hover:gap-2 transition-all duration-200">
                            Read more
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="px-4 pb-20">
          <div className="max-w-5xl mx-auto">
            <div
              className="relative rounded-2xl overflow-hidden p-8 md:p-12"
              style={{ background: 'linear-gradient(135deg, #4A3728 0%, #2C1F14 60%, #355E3B 100%)' }}
            >
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `radial-gradient(circle at 70% 30%, rgba(200,150,90,0.6) 0%, transparent 50%)`,
                }}
              />
              <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C8965A] mb-2">
                    Ready to get started?
                  </p>
                  <h2 className="font-serif text-2xl md:text-3xl text-white mb-2">
                    Book a Free 30-Min Consultation
                  </h2>
                  <p className="text-white/70 text-sm max-w-md">
                    Discuss your legal support needs with Maggi May directly — no commitment required.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <Link
                    href="/availability"
                    onClick={() => trackEvent('resources_cta_book_consultation', { event_category: 'conversion', event_label: 'Resources Hub CTA' })}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#C8965A] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Book Consultation
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                  <Link
                    href="/services"
                    onClick={() => trackEvent('resources_cta_view_services', { event_category: 'engagement', event_label: 'Resources Hub CTA' })}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                  >
                    View Services
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
