'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Case Studies', href: '/case-studies' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Legislation', href: '/legislation' },
  { label: 'Availability', href: '/availability' },
  { label: 'Book Consultation', href: '/booking' },
  { label: 'Intake Status', href: '/intake-status' },
  { label: 'New Intake', href: '/portal/intake' },
  { label: 'Contracts', href: '/contracts' },
  { label: 'Log Formats', href: '/log-formats' },
  { label: 'Retainer', href: '/retainer-contract' },
  { label: 'Pay Retainer', href: '/retainer-payment' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Strategy Session', href: '/strategy-session' },
  { label: 'Book Now', href: '/prospect-booking' },
  { label: 'Book Appointment', href: '/book-appointment' },
  { label: 'Contact', href: '/contact' },
  { label: 'Deliverable Hub', href: '/client-deliverable-hub' },
  { label: 'Install App', href: '/mobile-download' },
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
      { label: 'Legislation', href: '/legislation' },
    ],
  },
  {
    label: 'Work With Me',
    links: [
      { label: 'Book Consultation', href: '/booking' },
      { label: 'Strategy Session', href: '/strategy-session' },
      { label: 'Book Now', href: '/prospect-booking' },
      { label: 'Schedule', href: '/schedule' },
      { label: 'Book Appointment', href: '/book-appointment' },
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
      { label: 'Deliverable Hub', href: '/client-deliverable-hub' },
      { label: 'Install App', href: '/mobile-download' },
      { label: 'Log Formats', href: '/log-formats' },
    ],
  },
];

// ── Billing Counter ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function BillingCounter() {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('');
  const [rate, setRate] = useState(250);
  const [sessions, setSessions] = useState<Array<{ desc: string; client: string; duration: number; earned: number }>>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Persist/restore from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('header_billing_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.running && parsed.startTs) {
          setRunning(true);
          setStartTs(parsed.startTs);
          setDescription(parsed.description || '');
          setClient(parsed.client || '');
          setRate(parsed.rate || 250);
        }
        if (parsed.sessions) setSessions(parsed.sessions);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (running && startTs) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTs) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, startTs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleStart = () => {
    if (!description.trim() || !client.trim()) return;
    const ts = Date.now();
    setStartTs(ts);
    setElapsed(0);
    setRunning(true);
    try {
      localStorage.setItem('header_billing_state', JSON.stringify({ running: true, startTs: ts, description, client, rate, sessions }));
    } catch { /* ignore */ }
  };

  const handleStop = () => {
    const duration = elapsed;
    const earned = (duration / 3600) * rate;
    const newSessions = [{ desc: description, client, duration, earned }, ...sessions].slice(0, 5);
    setSessions(newSessions);
    setRunning(false);
    setElapsed(0);
    setStartTs(null);
    try {
      localStorage.setItem('header_billing_state', JSON.stringify({ running: false, startTs: null, description: '', client: '', rate, sessions: newSessions }));
    } catch { /* ignore */ }
    setDescription('');
    setClient('');
  };

  const totalEarned = sessions.reduce((s, e) => s + e.earned, 0);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Counter Button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open billing counter"
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent border ${
          running
            ? 'border-green-400 bg-green-50 text-green-700 animate-pulse' :'border-amber-400/60 bg-amber-50/80 text-amber-700'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {running ? formatDuration(elapsed) : `$${totalEarned.toFixed(0)}`}
        {running && <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-2xl shadow-2xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-green-50 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⏱️</span>
              <div>
                <p className="text-xs font-bold text-foreground">Billing Counter</p>
                <p className="text-[10px] text-muted-foreground">Track billable time</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Total Earned</p>
              <p className="text-sm font-bold text-green-700">${totalEarned.toFixed(2)}</p>
            </div>
          </div>

          {/* Clock display */}
          <div className={`mx-4 mt-3 rounded-xl p-3 text-center border-2 transition-all ${running ? 'border-green-400 bg-green-50' : 'border-border bg-secondary/30'}`}>
            <div className={`text-3xl font-mono font-bold tracking-wider ${running ? 'text-green-700' : 'text-foreground'}`}>
              {formatDuration(running ? elapsed : 0)}
            </div>
            {running && (
              <p className="text-[10px] text-green-600 mt-1">
                {client} · ${((elapsed / 3600) * rate).toFixed(2)} earned
              </p>
            )}
          </div>

          {/* Form */}
          <div className="px-4 py-3 space-y-2">
            {!running ? (
              <>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Task description *"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={client}
                    onChange={e => setClient(e.target.value)}
                    placeholder="Client name *"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={rate}
                      onChange={e => setRate(Number(e.target.value))}
                      placeholder="Rate/hr"
                      className="w-full px-2 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">/hr</span>
                  </div>
                </div>
                <button
                  onClick={handleStart}
                  disabled={!description.trim() || !client.trim()}
                  className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ▶ Start Timer
                </button>
              </>
            ) : (
              <button
                onClick={handleStop}
                className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                ■ Stop &amp; Save
              </button>
            )}
          </div>

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <div className="px-4 pb-3 border-t border-border mt-1 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Recent Sessions</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-border/40 last:border-0">
                    <div className="truncate flex-1 mr-2">
                      <span className="font-medium text-foreground">{s.client}</span>
                      <span className="text-muted-foreground"> · {s.desc}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-green-700 font-semibold">${s.earned.toFixed(2)}</span>
                      <span className="text-muted-foreground ml-1">{formatDuration(s.duration)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link to full billing */}
          <div className="px-4 pb-3">
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-[10px] font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              View Full Billing Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Header ───────────────────────────────────────────────────────────────

interface HeaderProps {
  initialClaims?: Record<string, unknown> | null;
}

export default function Header({ initialClaims }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // SSR-consistent auth state seeded from server-fetched claims
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    initialClaims != null
  );
  const navRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const isHeroPage = pathname === '/' || pathname === '/homepage';

  // Apply dynamic nav classes imperatively after mount to avoid SSR/CSR mismatch
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const updateNavClass = () => {
      nav.classList.remove('nav-scrolled', 'py-3', 'py-4', 'md:py-8', 'bg-background', 'border-b', 'border-border');
      if (scrolled) {
        nav.classList.add('nav-scrolled', 'py-3');
      } else if (isHeroPage) {
        nav.classList.add('py-4', 'md:py-8');
      } else {
        nav.classList.add('py-4', 'md:py-8', 'bg-background', 'border-b', 'border-border');
      }
    };

    updateNavClass();
  }, [scrolled, isHeroPage]);

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
    if (hamburgerRef.current) {
      hamburgerRef.current.setAttribute('aria-label', menuOpen ? 'Close navigation menu' : 'Open navigation menu');
      hamburgerRef.current.setAttribute('aria-expanded', String(menuOpen));
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
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex items-center justify-between gap-4">
          {/* Logo — business card image */}
          <div className="flex items-center gap-3 group shrink-0">
            <Link
              href="/admin"
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
              aria-label="Go to Admin"
            >
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border/40 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <Image
                  src="/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784431758558.png"
                  alt="Broussard Legal Services business card logo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </Link>

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
                  (pathname === link?.href || (link?.href === '/' && (pathname === '/' || pathname === '/homepage')))
                    ? 'page'
                    : undefined
                }
                className={`px-3 py-2 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap ${
                  (pathname === link?.href || (link?.href === '/' && (pathname === '/' || pathname === '/homepage')))
                    ? 'bg-[#8B3A45] text-white' :'text-primary-foreground/80 hover:text-white hover:bg-accent/80'
                }`}
              >
                {link?.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {/* Billing Counter */}
            <BillingCounter />

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-semibold uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent bg-accent text-accent-foreground hover:opacity-90"
            >
              Hire Me
            </Link>

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
            <BillingCounter />
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
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            className="md:hidden p-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent bg-primary-foreground/10 text-accent"
            suppressHydrationWarning
          >
            <span className="relative block w-[22px] h-[22px]">
              {/* Hamburger icon */}
              <svg
                width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 0, left: 0,
                  transition: 'opacity 0.2s, transform 0.2s',
                  opacity: menuOpen ? 0 : 1,
                  transform: menuOpen ? 'rotate(45deg) scale(0.8)' : 'rotate(0deg) scale(1)',
                  pointerEvents: 'none',
                }}
              >
                <line x1="3" y1="8" x2="21" y2="8" /><line x1="3" y1="16" x2="21" y2="16" />
              </svg>
              {/* Close icon */}
              <svg
                width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 0, left: 0,
                  transition: 'opacity 0.2s, transform 0.2s',
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? 'rotate(0deg) scale(1)' : 'rotate(-45deg) scale(0.8)',
                  pointerEvents: 'none',
                }}
              >
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu backdrop */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        suppressHydrationWarning
      />
      <div
        id="mobile-nav-menu"
        ref={mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 h-full w-[85vw] max-w-[340px] z-50 md:hidden flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        suppressHydrationWarning
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-md overflow-hidden border border-border/40">
              <Image
                src="/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784431758558.png"
                alt="Broussard Legal Services logo"
                fill
                className="object-cover"
              />
            </div>
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
            href="https://wa.me/18444936819"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border"
            style={{ borderColor: 'rgba(53,94,59,0.4)', color: '#355E3B', background: 'rgba(53,94,59,0.06)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            WhatsApp: 1-844-493-6819
          </a>
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