'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { trackQRCodeScan, trackEmailShare } from '@/lib/analytics';

const SITE_URL = 'https://broussardlegalservices.com';
const APP_URL = 'https://broussardlegalservices.com/mobile-download';

function QRSvg({ url, size = 180 }: { url: string; size?: number }) {
  const [svgRects, setSvgRects] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [moduleCount, setModuleCount] = useState(0);

  useEffect(() => {
    // Dynamically import uqr to avoid SSR issues
    import('uqr').then(({ encode }) => {
      try {
        const result = encode(url, { ecc: 'H' });
        const cells = result.data;
        const count = result.size;
        const cellSize = size / count;
        const rects: { x: number; y: number; w: number; h: number }[] = [];
        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (cells[row * count + col]) {
              rects.push({ x: col * cellSize, y: row * cellSize, w: cellSize, h: cellSize });
            }
          }
        }
        setModuleCount(count);
        setSvgRects(rects);
      } catch {
        // fallback: empty
      }
    }).catch(() => {});
  }, [url, size]);

  if (svgRects.length === 0) {
    return (
      <div
        style={{ width: size, height: size, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
        className="flex items-center justify-center"
      >
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`QR code linking to ${url}`}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      <rect width={size} height={size} fill="#ffffff" />
      {svgRects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#1B2A4A" />
      ))}
    </svg>
  );
}

export default function QRCodeSection() {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    const el = qrRef?.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !scannedRef.current) {
            scannedRef.current = true;
            trackQRCodeScan();
          }
        });
      },
      { threshold: 0.5 }
    );
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  const handleCopy = () => {
    navigator.clipboard?.writeText(SITE_URL)?.then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const socialLinks = [
    {
      name: 'LinkedIn',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL)}`,
      onShare: undefined,
    },
    {
      name: 'Facebook',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
        </svg>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`,
      onShare: undefined,
    },
    {
      name: 'X / Twitter',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent('Professional contract paralegal services for law firms nationwide — Maggi May Broussard')}`,
      onShare: undefined,
    },
    {
      name: 'Email',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      href: `mailto:?subject=${encodeURIComponent('Professional Paralegal Services')}&body=${encodeURIComponent(`Check out Maggi May Broussard's professional contract paralegal services:\n\n${SITE_URL}`)}`,
      onShare: trackEmailShare,
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-secondary/40 border-t border-border/60" aria-label="Share this site">
      <div className="max-w-6xl mx-auto px-5 md:px-10">
        {/* Heading */}
        <div className="text-center mb-12 md:mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-accent mb-4 flex items-center justify-center gap-3">
            <span className="w-8 h-px bg-accent/70" />
            Spread the Word
            <span className="w-8 h-px bg-accent/70" />
          </p>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-3">Share &amp; Install</h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto font-light leading-relaxed">
            Scan the QR codes to visit the site or install the client portal app on your phone — no app store needed.
          </p>
        </div>

        {/* Two QR codes side by side */}
        <div className="flex flex-col lg:flex-row items-start justify-center gap-10 lg:gap-16 mb-14">
          {/* QR 1 — Website */}
          <div ref={qrRef} className="flex flex-col items-center gap-4">
            <div className="bg-white border-2 border-border rounded-2xl shadow-md p-6 flex flex-col items-center gap-3">
              <QRSvg url={SITE_URL} size={160} />
              <p className="text-[10px] text-muted-foreground font-semibold tracking-[0.25em] uppercase">Scan to visit site</p>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-[180px] leading-relaxed">
              broussardlegalservices.com
            </p>
          </div>

          {/* Divider */}
          <div className="hidden lg:flex flex-col items-center gap-2 self-center">
            <div className="w-px h-16 bg-border" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">+</span>
            <div className="w-px h-16 bg-border" />
          </div>
          <div className="flex lg:hidden items-center gap-4 w-full max-w-xs mx-auto">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">+</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* QR 2 — Mobile App */}
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white border-2 border-primary/30 rounded-2xl shadow-md p-6 flex flex-col items-center gap-3 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                Install App
              </div>
              <QRSvg url={APP_URL} size={160} />
              <p className="text-[10px] text-muted-foreground font-semibold tracking-[0.25em] uppercase">Scan to install app</p>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-[180px] leading-relaxed">
              Client portal · iOS &amp; Android
            </p>
          </div>

          {/* Divider */}
          <div className="hidden lg:flex flex-col items-center gap-2 self-center">
            <div className="w-px h-16 bg-border" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">or</span>
            <div className="w-px h-16 bg-border" />
          </div>
          <div className="flex lg:hidden items-center gap-4 w-full max-w-xs mx-auto">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Link + Social Share */}
          <div className="flex flex-col gap-6 w-full max-w-sm self-center">
            {/* Copyable URL */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2.5">Direct Link</p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-3">
                <span className="flex-1 text-sm text-muted-foreground truncate font-mono text-[12px]">{SITE_URL}</span>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 transition-colors rounded-lg px-3 py-1.5"
                  aria-label="Copy site URL"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Share on Social</p>
              <div className="grid grid-cols-2 gap-2.5">
                {socialLinks?.map((social) => (
                  <a
                    key={social?.name}
                    href={social?.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={social?.onShare ?? undefined}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary/60 hover:border-accent/40 transition-all duration-200 text-xs font-medium text-foreground"
                    aria-label={`Share on ${social?.name}`}
                  >
                    <span className="text-muted-foreground">{social?.icon}</span>
                    {social?.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
