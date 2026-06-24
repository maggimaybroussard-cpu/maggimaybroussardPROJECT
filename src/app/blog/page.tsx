'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  createdTime: string;
  jsonLd?: Record<string, unknown>;
}

const CATEGORIES = ['All', 'Paralegal Tips', 'Legal Guides', 'Jurisdiction', 'Resources'];

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

// Blog listing JSON-LD
const BLOG_LIST_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'Broussard Legal Services — Legal Knowledge Hub',
  description: 'Paralegal tips, plain-language legal guides, and jurisdiction-specific articles for attorneys and legal professionals.',
  url: 'https://broussardlegalservices.com/blog',
  publisher: {
    '@type': 'Organization',
    name: 'Broussard Legal Services',
    url: 'https://broussardlegalservices.com',
    logo: {
      '@type': 'ImageObject',
      url: 'https://broussardlegalservices.com/assets/images/Broussardlogo-1781834380907.png',
    },
  },
  author: {
    '@type': 'Person',
    name: 'Maggi May Broussard',
    jobTitle: 'Licensed Paralegal',
    url: 'https://broussardlegalservices.com',
  },
};

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPosts = useCallback(async (category: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
      const res = await fetch(`/api/blog${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch posts');
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(activeCategory);
  }, [activeCategory, fetchPosts]);

  const filteredPosts = posts.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const featuredPost = filteredPosts[0];
  const remainingPosts = filteredPosts.slice(1);

  return (
    <>
      {/* Blog listing JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BLOG_LIST_JSON_LD) }}
      />
      {/* Individual post JSON-LDs */}
      {filteredPosts.map((post) =>
        post.jsonLd ? (
          <script
            key={post.id}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(post.jsonLd) }}
          />
        ) : null
      )}
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section id="blog-hero" aria-label="Blog and legal knowledge hub header" className="pt-32 pb-16 px-5 md:px-10 bg-gradient-to-b from-secondary to-background">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center justify-center gap-3">
              <span className="w-6 h-px bg-accent" />
              Knowledge Hub
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-primary mb-4 leading-tight">
              Paralegal Insights & Legal Guides
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Plain-language legal articles, paralegal tips, and jurisdiction-specific guidance for attorneys and legal professionals.
            </p>
          </div>
        </section>

        {/* Filters + Search */}
        <section id="blog-filters" aria-label="Blog category filters and search" className="sticky top-[60px] z-30 bg-background/95 backdrop-blur-sm border-b border-border/60 px-5 md:px-10 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Category tabs */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-200 ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                placeholder="Search articles…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-full border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200"
              />
            </div>
          </div>
        </section>

        {/* Content */}
        <section id="blog-articles" aria-label="Published blog articles and posts" className="max-w-7xl mx-auto px-5 md:px-10 py-12">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading articles from Notion…</p>
            </div>
          )}

          {error && (
            <div className="max-w-lg mx-auto text-center py-20">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-600 mb-2">Could not load articles</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <button
                onClick={() => fetchPosts(activeCategory)}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-widest rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && filteredPosts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-sm">No articles found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
            </div>
          )}

          {!loading && !error && filteredPosts.length > 0 && (
            <>
              {/* Featured post */}
              {featuredPost && (
                <Link
                  href={`/blog/${featuredPost.id}`}
                  className="group block mb-12 rounded-2xl overflow-hidden border border-border/60 hover:border-primary/30 transition-all duration-300 hover:shadow-lg bg-card"
                >
                  <div className="grid md:grid-cols-2">
                    {/* Image */}
                    <div className="relative h-56 md:h-auto overflow-hidden bg-muted">
                      {featuredPost.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={featuredPost.coverImage}
                          alt={featuredPost.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/8 to-accent/10 flex items-center justify-center">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-primary/20" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute top-4 left-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground px-2.5 py-1 rounded-full">
                          Featured
                        </span>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-7 md:p-10 flex flex-col justify-center">
                      {featuredPost.category && (
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-4 w-fit ${CATEGORY_COLORS[featuredPost.category] ?? 'bg-muted text-muted-foreground border-border'}`}>
                          {featuredPost.category}
                        </span>
                      )}
                      <h2 className="font-serif text-2xl md:text-3xl text-foreground leading-snug mb-3 group-hover:text-primary transition-colors duration-200">
                        {featuredPost.title}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3">
                        {featuredPost.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground/70">
                        {featuredPost.publishedDate && (
                          <span>{formatDate(featuredPost.publishedDate)}</span>
                        )}
                        {featuredPost.readTime && (
                          <>
                            <span>·</span>
                            <span>{featuredPost.readTime}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Grid */}
              {remainingPosts.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {remainingPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.id}`}
                      className="group flex flex-col rounded-2xl overflow-hidden border border-border/60 hover:border-primary/30 transition-all duration-300 hover:shadow-md bg-card"
                    >
                      {/* Cover */}
                      <div className="relative h-44 overflow-hidden bg-muted flex-shrink-0">
                        {post.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/8 to-accent/10" />
                        )}
                        {post.category && (
                          <div className="absolute top-3 left-3">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[post.category] ?? 'bg-muted text-muted-foreground border-border'}`}>
                              {post.category}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Body */}
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-serif text-lg text-foreground leading-snug mb-2 group-hover:text-primary transition-colors duration-200 line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1 line-clamp-3">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 mt-auto pt-3 border-t border-border/50">
                          <span>{post.publishedDate ? formatDate(post.publishedDate) : ''}</span>
                          {post.readTime && <span>{post.readTime}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Newsletter CTA */}
        <section id="blog-newsletter" aria-label="Subscribe to legal insights newsletter" className="max-w-2xl mx-auto px-5 md:px-10 pb-20 text-center">
          <div className="p-8 rounded-2xl bg-secondary border border-accent/20">
            <h2 className="font-serif text-2xl text-primary mb-2">Stay Informed</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Get the latest legal guides and paralegal tips delivered to your inbox.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Subscribe to Updates
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
