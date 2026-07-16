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
      <Header />
      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="pt-32 pb-16 px-5 md:px-10 bg-gradient-to-b from-secondary to-background">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center justify-center gap-3">
              <span className="w-8 h-px bg-accent/70" />
              Knowledge Hub
              <span className="w-8 h-px bg-accent/70" />
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight mb-5">
              Blog &amp; Resources
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
              Paralegal tips, plain-language legal guides, and jurisdiction-specific articles — written to help you navigate the legal system with confidence.
            </p>
          </div>
        </section>

        {/* Filters + Search */}
        <section className="sticky top-[60px] z-30 bg-background/95 backdrop-blur-sm border-b border-border/60 px-5 md:px-10 py-4">
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
        <section className="max-w-7xl mx-auto px-5 md:px-10 py-12">
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

        {/* CTA */}
        <section className="bg-secondary border-t border-border/60 px-5 md:px-10 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center justify-center gap-3">
              <span className="w-8 h-px bg-accent/70" />
              Get Expert Help
              <span className="w-8 h-px bg-accent/70" />
            </p>
            <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-3">
              Need personalized legal support?
            </h2>
            <p className="text-sm text-muted-foreground mb-7 font-light leading-relaxed">
              These articles are a starting point. For your specific situation, book a consultation and get expert paralegal guidance.
            </p>
            <Link
              href="/availability"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-primary/15"
            >
              Book a Consultation
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
