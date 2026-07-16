'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';

const navLinks = [
  {
    label: 'Back to Home',
    href: '/',
    description: 'Return to the main page',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'Services',
    href: '/services',
    description: 'Explore legal services offered',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.728 12.728.707.707M3 12h1m16 0h1M4.22 19.78l.707-.707M18.364 5.636l.707-.707" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    label: 'Contact',
    href: '/contact',
    description: 'Get in touch directly',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

export default function NotFound() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
      const numEl = container.querySelector<HTMLElement>('.parallax-num');
      if (numEl) {
        numEl.style.transform = `translate(${x * 0.6}px, ${y * 0.6}px)`;
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#FAF7F2' }}
    >
      {/* Minimal header */}
      <header className="w-full px-6 md:px-10 py-5 flex items-center justify-between border-b" style={{ borderColor: '#EDE8E0' }}>
        <Link href="/" className="flex items-center gap-3 group">
          <AppLogo size={32} className="transition-transform duration-300 group-hover:scale-105" />
          <span className="font-serif text-base tracking-tight" style={{ color: '#4A3728' }}>
            Maggi May Broussard
          </span>
        </Link>
        <Link
          href="/contact"
          className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-300 hover:opacity-80"
          style={{ backgroundColor: '#C8965A', color: '#FAF7F2' }}
        >
          Hire Me
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 md:py-24 relative overflow-hidden">
        {/* Decorative background circle */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(200,150,90,0.08) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          aria-hidden="true"
        />

        {/* 404 number — parallax layer */}
        <div className="relative mb-2 select-none" aria-hidden="true">
          <span
            className="parallax-num block font-serif leading-none transition-transform duration-75"
            style={{
              fontSize: 'clamp(120px, 22vw, 220px)',
              color: '#4A3728',
              opacity: 0.06,
              letterSpacing: '-0.04em',
              willChange: 'transform',
            }}
          >
            404
          </span>
        </div>

        {/* Gold accent line */}
        <div
          className="w-16 h-0.5 mb-8 rounded-full"
          style={{ backgroundColor: '#C8965A' }}
          aria-hidden="true"
        />

        {/* Heading */}
        <h1
          className="font-serif text-3xl md:text-4xl text-center mb-4 leading-tight"
          style={{ color: '#4A3728' }}
        >
          This page has wandered off
        </h1>
        <p
          className="text-center max-w-md mb-12 leading-relaxed"
          style={{ color: '#7A6558', fontSize: '1.0625rem' }}
        >
          The link you followed may be outdated or the page may have moved. Let&apos;s get you somewhere useful.
        </p>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
          {navLinks.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col gap-3 p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
              style={{
                backgroundColor: i === 0 ? '#4A3728' : '#FFFFFF',
                borderColor: i === 0 ? '#4A3728' : '#EDE8E0',
                boxShadow: '0 2px 12px rgba(74,55,40,0.06)',
              }}
              onMouseEnter={(e) => {
                if (i !== 0) {
                  (e.currentTarget as HTMLElement).style.borderColor = '#C8965A';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(200,150,90,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (i !== 0) {
                  (e.currentTarget as HTMLElement).style.borderColor = '#EDE8E0';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(74,55,40,0.06)';
                }
              }}
            >
              {/* Icon */}
              <span
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-300"
                style={{
                  backgroundColor: i === 0 ? 'rgba(200,150,90,0.2)' : '#F5EDE0',
                  color: i === 0 ? '#C8965A' : '#C8965A',
                }}
              >
                {link.icon}
              </span>

              {/* Label */}
              <span
                className="font-semibold text-sm tracking-wide"
                style={{ color: i === 0 ? '#FAF7F2' : '#4A3728' }}
              >
                {link.label}
              </span>

              {/* Description */}
              <span
                className="text-xs leading-relaxed"
                style={{ color: i === 0 ? 'rgba(250,247,242,0.65)' : '#7A6558' }}
              >
                {link.description}
              </span>

              {/* Arrow */}
              <span
                className="mt-auto self-end transition-transform duration-300 group-hover:translate-x-1"
                style={{ color: i === 0 ? '#C8965A' : '#C8965A' }}
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        {/* Error code badge */}
        <p
          className="mt-12 text-xs uppercase tracking-widest font-semibold"
          style={{ color: '#B5A99A' }}
        >
          Error 404 &mdash; Page Not Found
        </p>
      </main>
    </div>
  );
}
