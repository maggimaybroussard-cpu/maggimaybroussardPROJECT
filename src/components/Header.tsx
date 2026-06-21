'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Image from 'next/image';

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

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailPopupOpen, setEmailPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setEmailPopupOpen(false);
      }
    };
    if (emailPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [emailPopupOpen]);

  const isHeroPage = pathname === '/' || pathname === '/homepage';

  return (
    <>
      <nav
        aria-label="Main navigation"
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? 'nav-scrolled py-3'
            : isHeroPage
            ? 'py-4 md:py-8' :'py-4 md:py-8 bg-background border-b border-border'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 group shrink-0">
            {/* Profile picture with email popup */}
            <div className="relative" ref={popupRef}>
              <button
                onClick={() => setEmailPopupOpen(!emailPopupOpen)}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
                aria-label="Contact via email"
                aria-expanded={emailPopupOpen}
                aria-haspopup="true"
                type="button"
              >
                <AppLogo
                  size={36}
                  className="transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                />
              </button>

              {/* Email popup */}
              {emailPopupOpen && (
                <div
                  role="dialog"
                  aria-label="Quick contact"
                  className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-4 min-w-[220px] animate-fade-in"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Quick Contact</p>
                  <a
                    href="mailto:broussardlegalservices@gmail.com"
                    className="flex items-center gap-2.5 text-sm font-medium text-gray-800 hover:text-accent transition-colors duration-200"
                    onClick={() => setEmailPopupOpen(false)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    Send an Email
                  </a>
                </div>
              )}
            </div>

            <Link href="/" className="flex items-center gap-2.5" aria-label="Broussard Legal Services — Home">
              <span
                className="font-serif text-lg tracking-tight transition-colors duration-300"
                style={{ color: '#355E3B' }}
              >
                Broussard Legal Services
              </span>
              <Image
                src="/assets/images/initiallogo-1781843073214.png"
                alt="Broussard Legal Services logo"
                width={36}
                height={36}
                className="flex-shrink-0 object-contain"
              />
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
                    ? 'bg-accent text-white'
                    : scrolled || !isHeroPage
                    ? 'text-primary-foreground/80 hover:text-white hover:bg-accent/80'
                    : 'text-primary-foreground/80 hover:text-white hover:bg-accent/80'
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
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                scrolled || !isHeroPage
                  ? 'bg-accent text-accent-foreground hover:opacity-90'
                  : 'bg-primary-foreground text-primary hover:opacity-90'
              }`}
            >
              Hire Me
            </Link>

            {/* Pay Now */}
            <Link
              href="/checkout"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border"
              style={{
                borderColor: 'rgba(200,150,90,0.6)',
                color: '#C8965A',
                background: 'rgba(200,150,90,0.08)',
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
            className={`md:hidden p-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              scrolled || !isHeroPage
                ? 'bg-primary-foreground/10 text-primary-foreground'
                : 'bg-primary-foreground/10 text-accent'
            }`}
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

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div
          id="mobile-nav-menu"
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-40 bg-primary/97 backdrop-blur-lg flex flex-col items-center justify-center gap-5 md:hidden px-6"
        >
          {navLinks?.map((link) => (
            <Link
              key={link?.href}
              href={link?.href}
              onClick={() => setMenuOpen(false)}
              aria-current={pathname === link?.href ? 'page' : undefined}
              className="font-serif text-3xl text-primary-foreground/90 hover:text-accent transition-colors duration-200 italic focus-visible:outline-none focus-visible:text-accent"
            >
              {link?.label}
            </Link>
          ))}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full max-w-xs">
            <Link
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="w-full text-center px-6 py-3.5 bg-accent text-accent-foreground rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
            >
              Hire Me
            </Link>
            <Link
              href="/checkout"
              onClick={() => setMenuOpen(false)}
              className="w-full text-center px-6 py-3.5 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 border"
              style={{ borderColor: 'rgba(200,150,90,0.6)', color: '#C8965A', background: 'rgba(200,150,90,0.1)' }}
            >
              Pay Now
            </Link>
            <Link
              href="/portal/login"
              onClick={() => setMenuOpen(false)}
              className="w-full text-center px-6 py-3.5 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 border"
              style={{ borderColor: 'rgba(53,94,59,0.5)', color: '#355E3B', background: 'rgba(53,94,59,0.08)' }}
            >
              Client Portal
            </Link>
            <a
              href="https://legal-assistant-ai-maggimaybroussa.replit.app"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="w-full text-center px-6 py-3.5 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 border"
              style={{ borderColor: 'rgba(53,94,59,0.5)', color: '#355E3B', background: 'rgba(53,94,59,0.08)' }}
            >
              Staff Login
            </a>
          </div>
        </div>
      )}
    </>
  );
}