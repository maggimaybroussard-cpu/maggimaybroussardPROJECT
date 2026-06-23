'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  coverImage: string;
  author: string;
  publishedDate: string;
  readTime: string;
  contentHtml: string;
  jsonLd?: Record<string, unknown>;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Paralegal Tips': 'bg-blue-50 text-blue-700 border-blue-200',
  'Legal Guides': 'bg-purple-50 text-purple-700 border-purple-200',
  'Jurisdiction': 'bg-orange-50 text-orange-700 border-orange-200',
  'Resources': 'bg-green-50 text-green-700 border-green-200',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogArticlePage() {
  const params = useParams();
  const pageId = params?.pageId as string;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pageId) return;
    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/blog/${pageId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch article');
        setPost(data.post);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load article');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [pageId]);

  return (
    <>
      <Header />
      {/* JSON-LD structured data for SEO */}
      {post?.jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(post.jsonLd) }}
        />
      )}
      <main className="min-h-screen bg-background">
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-8 h-8 border-2 border-[#355E3B] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading article…</p>
          </div>
        )}

        {error && (
          <div className="max-w-lg mx-auto text-center py-32 px-5">
            <p className="text-sm font-medium text-red-600 mb-2">Could not load article</p>
            <p className="text-xs text-muted-foreground mb-6">{error}</p>
            <Link
              href="/blog"
              className="px-5 py-2.5 text-xs font-semibold uppercase tracking-widest rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              ← Back to Blog
            </Link>
          </div>
        )}

        {!loading && !error && post && (
          <>
            {/* Hero */}
            <div className="pt-24 pb-0">
              {post.coverImage && (
                <div className="relative h-64 md:h-96 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                </div>
              )}
            </div>

            {/* Article */}
            <article className="max-w-3xl mx-auto px-5 md:px-10 pb-20">
              {/* Back */}
              <div className={`${post.coverImage ? '-mt-10 relative z-10' : 'pt-32'} mb-8`}>
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors duration-200"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  All Articles
                </Link>
              </div>

              {/* Meta */}
              <header className="mb-10">
                {post.category && (
                  <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-4 ${CATEGORY_COLORS[post.category] ?? 'bg-muted text-muted-foreground border-border'}`}>
                    {post.category}
                  </span>
                )}
                <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight mb-5">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="text-base text-muted-foreground leading-relaxed mb-6 border-l-2 border-accent pl-4">
                    {post.excerpt}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground/70 pb-6 border-b border-border/60">
                  {post.author && (
                    <span className="flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {post.author}
                    </span>
                  )}
                  {post.publishedDate && (
                    <span className="flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {formatDate(post.publishedDate)}
                    </span>
                  )}
                  {post.readTime && (
                    <span className="flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {post.readTime}
                    </span>
                  )}
                  {/* Share buttons */}
                  <div className="ml-auto flex items-center gap-2">
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium"
                      aria-label="Share on Twitter"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Share
                    </a>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-blue-50 hover:text-blue-700 transition-colors text-[11px] font-medium"
                      aria-label="Share on LinkedIn"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
                        <circle cx="4" cy="4" r="2"/>
                      </svg>
                      LinkedIn
                    </a>
                  </div>
                </div>
              </header>

              {/* Body */}
              <div
                className="notion-content prose-blog"
                dangerouslySetInnerHTML={{ __html: post.contentHtml }}
              />

              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="mt-10 pt-6 border-t border-border/60 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-medium px-3 py-1 rounded-full bg-muted text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div className="mt-12 p-7 rounded-2xl bg-secondary border border-accent/20 text-center">
                <h3 className="font-serif text-xl text-primary mb-2">Have questions about your situation?</h3>
                <p className="text-sm text-muted-foreground mb-5">
                  Book a consultation with Maggi for personalized paralegal guidance.
                </p>
                <Link
                  href="/availability"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  Book a Consultation
                </Link>
              </div>

              {/* Related articles navigation */}
              <div className="mt-8 pt-6 border-t border-border/60 flex justify-between items-center">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  All Articles
                </Link>
                <p className="text-[11px] text-muted-foreground">Broussard Legal Services · Legal Knowledge Hub</p>
              </div>
            </article>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
