'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Case Studies', href: '/case-studies' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Availability', href: '/availability' },
  { label: 'Intake Status', href: '/intake-status' },
  { label: 'New Intake', href: '/portal/intake' },
  { label: 'Contracts', href: '/contracts' },
  { label: 'Log Formats', href: '/log-formats' },
  { label: 'Retainer', href: '/retainer-contract' },
  { label: 'Pay Retainer', href: '/retainer-payment' },
  { label: '📅 Schedule', href: '/schedule' },
  { label: '📋 Book Now', href: '/prospect-booking' },
  { label: '📅 Book Appointment', href: '/book-appointment' },
  { label: 'Contact', href: '/contact' },
  { label: '📁 Deliverable Hub', href: '/client-deliverable-hub' },
  { label: '📲 Install App', href: '/mobile-download' },
];

// Grouped nav for mobile
const mobileNavGroups = [
  {
    label: 'Explore',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Blog', href: '/blog' },
      { label: 'Case Studies', href: '/case-studies' },
      { label: 'Testimonials', href: '/testimonials' },
    ],
  },
  {
    label: 'Work With Me',
    links: [
      { label: '📋 Book Consultation', href: '/prospect-booking' },
      { label: '📅 Schedule', href: '/schedule' },
      { label: '📅 Book Appointment', href: '/book-appointment' },
      { label: 'Contact', href: '/contact' },
      { label: 'Availability', href: '/availability' },
    ],
  },
  {
    label: 'Client Services',
    links: [
      { label: 'New Intake', href: '/portal/intake' },
      { label: 'Intake Status', href: '/intake-status' },
      { label: 'Contracts', href: '/contracts' },
      { label: 'Retainer', href: '/retainer-contract' },
      { label: 'Pay Retainer', href: '/retainer-payment' },
      { label: '📁 Deliverable Hub', href: '/client-deliverable-hub' },
      { label: '📲 Install App', href: '/mobile-download' },
      { label: 'Log Formats', href: '/log-formats' },
    ],
  },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const isHeroPage = pathname === '/' || pathname === '/homepage';

  // Mark as mounted to enable client-side dynamic classes
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply dynamic nav classes imperatively after mount to avoid SSR/CSR mismatch
  useEffect(() => {
    if (!mounted) return;
    const nav = navRef.current;
    if (!nav) return;

    const updateNavClass = () => {
      const isScrolledNow = scrolled;
      const isHeroNow = isHeroPage;

      // Remove all dynamic classes first
      nav.classList.remove('nav-scrolled', 'py-3', 'py-4', 'md:py-8', 'bg-background', 'border-b', 'border-border');

      if (isScrolledNow) {
        nav.classList.add('nav-scrolled', 'py-3');
      } else if (isHeroNow) {
        nav.classList.add('py-4', 'md:py-8');
      } else {
        nav.classList.add('py-4', 'md:py-8', 'bg-background', 'border-b', 'border-border');
      }
    };

    updateNavClass();
  }, [scrolled, isHeroPage, mounted]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        const firstLink = mobileMenuRef.current?.querySelector('a');
        (firstLink as HTMLElement)?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
      hamburgerRef.current?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // Trap focus inside mobile menu
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = mobileMenuRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Main navigation"
        className="fixed top-0 left-0 w-full z-50 transition-all duration-500 py-4 md:py-8"
        suppressHydrationWarning
      >
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex items-center justify-between gap-4" suppressHydrationWarning>
          {/* Logo */}
          <div className="flex items-center gap-3 group shrink-0">
            {/* Profile picture — navigates to Admin */}
            <div className="relative">
              <Link
                href="/admin"
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
                aria-label="Go to Admin"
              >
                <AppLogo
                  size={36}
                  className="transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                />
              </Link>
            </div>

            <Link href="/" className="flex items-center gap-2.5" aria-label="Broussard Legal Services — Home">
              <span
                className="font-serif text-lg tracking-tight transition-colors duration-300"
                style={{ color: '#355E3B' }}
              >
                Broussard Legal Services
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center" role="list">
            {navLinks?.map((link) => (
              <Link
                key={link?.href}
                href={link?.href}
                role="listitem"
                aria-current={
                  pathname === link?.href || (link?.href === '/' && (pathname === '/' || pathname === '/homepage'))
                    ? 'page'
                    : undefined
                }
                className={`px-3 py-2 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap ${
                  pathname === link?.href || (link?.href === '/' && (pathname === '/' || pathname === '/homepage'))
                    ? 'bg-[#8B3A45] text-white' :'text-primary-foreground/80 hover:text-white hover:bg-accent/80'
                }`}
              >
                {link?.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {/* Hire Me */}
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent bg-accent text-accent-foreground hover:opacity-90"
            >
              Hire Me
            </Link>

            {/* Pay Now */}
            <Link
              href="/checkout"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border"
              style={{
                borderColor: 'rgba(139,96,32,0.6)',
                color: '#6B4A10',
                background: 'rgba(139,96,32,0.08)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Pay Now
            </Link>

            {/* Client Login */}
            <Link
              href="/portal/login"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border"
              style={{
                borderColor: 'rgba(53,94,59,0.5)',
                color: '#355E3B',
                background: 'rgba(53,94,59,0.07)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Portal
            </Link>

            {/* Staff Login */}
            <a
              href="https://legal-assistant-ai-maggimaybroussa.replit.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border"
              style={{
                borderColor: 'rgba(53,94,59,0.5)',
                color: '#355E3B',
                background: 'rgba(53,94,59,0.07)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              Staff Login
            </a>
          </div>

          {/* Tablet Nav (md only) — simplified */}
          <div className="hidden md:flex lg:hidden items-center gap-2">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 bg-accent text-accent-foreground hover:opacity-90"
            >
              Hire Me
            </Link>
            <Link
              href="/portal/login"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 border"
              style={{ borderColor: 'rgba(53,94,59,0.5)', color: '#355E3B', background: 'rgba(53,94,59,0.07)' }}
            >
              Portal
            </Link>
            <a
              href="https://legal-assistant-ai-maggimaybroussa.replit.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 border"
              style={{ borderColor: 'rgba(53,94,59,0.5)', color: '#355E3B', background: 'rgba(53,94,59,0.07)' }}
            >
              Staff Login
            </a>
          </div>

          {/* Mobile Hamburger */}
          <button
            ref={hamburgerRef}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            className="md:hidden p-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent bg-primary-foreground/10 text-accent"
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="16" x2="21" y2="16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu — Slide-in drawer from right */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        />
      )}
      <div
        id="mobile-nav-menu"
        ref={mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 h-full w-[85vw] max-w-[340px] z-50 md:hidden flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <span className="font-serif text-[14px] tracking-tight" style={{ color: '#355E3B' }}>
              Broussard Legal
            </span>
          </Link>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable nav groups */}
        <div className="flex-1 overflow-y-auto py-4 px-5 space-y-6">
          {mobileNavGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2 px-1">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={pathname === link.href ? 'page' : undefined}
                    className={`px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 truncate ${
                      pathname === link.href
                        ? 'bg-[#8B3A45] text-white'
                        : 'bg-secondary/60 text-foreground hover:bg-secondary hover:text-accent'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky bottom CTAs */}
        <div className="shrink-0 px-5 py-4 border-t border-border space-y-2.5 bg-background">
          <Link
            href="/contact"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-accent text-accent-foreground rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Hire Me
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/checkout"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border"
              style={{ borderColor: 'rgba(139,96,32,0.5)', color: '#6B4A10', background: 'rgba(139,96,32,0.08)' }}
            >
              Pay Now
            </Link>
            <Link
              href="/portal/login"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border"
              style={{ borderColor: 'rgba(53,94,59,0.5)', color: '#355E3B', background: 'rgba(53,94,59,0.08)' }}
            >
              Client Portal
            </Link>
          </div>
          <a
            href="https://legal-assistant-ai-maggimaybroussa.replit.app"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-1.5 w-full py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border"
            style={{ borderColor: 'rgba(53,94,59,0.4)', color: '#355E3B', background: 'rgba(53,94,59,0.06)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            Staff Login
          </a>
        </div>
      </div>
    </>
  );
}