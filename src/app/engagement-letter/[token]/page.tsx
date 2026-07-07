'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';

interface EngagementLetter {
  id: string;
  token: string;
  client_name: string;
  client_email: string;
  retainer_amount: number;
  scope: string;
  fees: string;
  timeline: string;
  next_steps: string;
  status: 'pending' | 'signed' | 'expired';
  signed_at: string | null;
  signer_name: string | null;
  signer_email: string | null;
  created_at: string;
  expires_at: string | null;
}

export default function EngagementLetterPage() {
  const params = useParams();
  const token = params?.token as string;

  const [letter, setLetter] = useState<EngagementLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signature state
  const [signatureTab, setSignatureTab] = useState<'type' | 'draw'>('type');
  const [typedName, setTypedName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Formatted dates (client-side only to avoid hydration mismatch)
  const [formattedCreated, setFormattedCreated] = useState('');
  const [formattedExpires, setFormattedExpires] = useState('');
  const [formattedSigned, setFormattedSigned] = useState('');

  useEffect(() => {
    if (!token) return;
    const supabase = createClient();
    supabase
      .from('engagement_letters')
      .select('*')
      .eq('token', token)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Engagement letter not found or the link is invalid.');
        } else {
          setLetter(data as EngagementLetter);
          setSignerEmail(data.client_email ?? '');
          setTypedName(data.client_name ?? '');
        }
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (!letter) return;
    if (letter.created_at) {
      setFormattedCreated(
        new Date(letter.created_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      );
    }
    if (letter.expires_at) {
      setFormattedExpires(
        new Date(letter.expires_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      );
    }
    if (letter.signed_at) {
      setFormattedSigned(
        new Date(letter.signed_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      );
    }
  }, [letter]);

  // Canvas drawing helpers
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#2C1F14';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  };

  const endDraw = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!letter) return;
    setSignError(null);

    const name = signatureTab === 'type' ? typedName.trim() : typedName.trim();
    if (!name) { setSignError('Please enter your full name.'); return; }
    if (!signerEmail.trim()) { setSignError('Please enter your email address.'); return; }
    if (signatureTab === 'draw' && !hasDrawn) { setSignError('Please draw your signature.'); return; }

    let signatureData = '';
    if (signatureTab === 'type') {
      signatureData = `TYPED:${name}`;
    } else {
      signatureData = canvasRef.current?.toDataURL('image/png') ?? '';
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/engagement-letter/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signerName: name,
          signerEmail: signerEmail.trim(),
          signatureData,
          signatureType: signatureTab === 'type' ? 'typed' : 'drawn',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSignError(data.error ?? 'Failed to submit signature. Please try again.');
      } else {
        setSigned(true);
      }
    } catch {
      setSignError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF7F2' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !letter) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-20 px-4" style={{ background: '#FAF7F2' }}>
          <div className="max-w-xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(220,38,38,0.08)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="font-serif text-2xl text-foreground mb-3">Letter Not Found</h1>
            <p className="text-muted-foreground text-sm mb-6">{error ?? 'This engagement letter link is invalid or has expired.'}</p>
            <Link href="/" className="inline-block py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90" style={{ background: '#355E3B', color: '#fff' }}>
              Return Home
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Already Signed ───────────────────────────────────────────────────────────
  if (letter.status === 'signed' && !signed) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-20 px-4" style={{ background: '#FAF7F2' }}>
          <div className="max-w-xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Already Signed</p>
            <h1 className="font-serif text-2xl text-foreground mb-3">This letter has been signed</h1>
            <p className="text-muted-foreground text-sm mb-2">Signed by <strong>{letter.signer_name}</strong></p>
            {formattedSigned && <p className="text-muted-foreground text-xs mb-6">{formattedSigned}</p>}
            <Link href="/portal/login" className="inline-block py-3 px-6 rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90" style={{ background: '#355E3B', color: '#fff' }}>
              Access Client Portal
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Signed Success ───────────────────────────────────────────────────────────
  if (signed) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-28 pb-20 px-4" style={{ background: '#FAF7F2' }}>
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'rgba(53,94,59,0.1)', border: '2px solid rgba(53,94,59,0.25)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-2">Engagement Confirmed</p>
              <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
                {letter.client_name ? `Welcome, ${letter.client_name.split(' ')[0]}!` : 'Letter Signed!'}
              </h1>
              <p className="text-muted-foreground font-light leading-relaxed max-w-md mx-auto">
                Your engagement letter has been signed and your engagement with Broussard Legal Services is now official. A confirmation has been sent to your email.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-white shadow-sm p-6 mb-6">
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-4">What Happens Next</p>
              <div className="space-y-3">
                {[
                  { num: '01', text: 'Check your email for a signed copy of this engagement letter.' },
                  { num: '02', text: 'Complete your client intake questionnaire — link sent separately.' },
                  { num: '03', text: 'Log in to your client portal to upload documents and track your case.' },
                  { num: '04', text: 'Your attorney will contact you within 1 business day to confirm next steps.' },
                ].map(({ num, text }) => (
                  <div key={num} className="flex items-start gap-4">
                    <span className="text-xs font-bold shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}>{num}</span>
                    <p className="text-sm text-foreground font-light leading-relaxed pt-0.5">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/portal/login" className="flex-1 text-center py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 shadow-sm" style={{ background: '#355E3B', color: '#fff' }}>
                Access Client Portal
              </Link>
              <Link href="/" className="flex-1 text-center py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-widest border border-border hover:border-primary/40 text-foreground">
                Return Home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Main Letter View ─────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="min-h-screen pt-28 pb-20 px-4 md:px-8" style={{ background: '#FAF7F2' }}>
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#C8965A' }}>
              Engagement Letter · Review &amp; Sign
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-foreground leading-tight mb-3">
              Attorney–Client Engagement Letter
            </h1>
            <p className="text-muted-foreground font-light leading-relaxed max-w-lg">
              Please review the terms of your engagement below and sign digitally to confirm.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">

            {/* Left: Letter Content */}
            <div className="space-y-5">

              {/* Letterhead */}
              <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-5" style={{ background: 'rgba(53,94,59,0.04)', borderBottom: '1px solid rgba(53,94,59,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-serif text-lg font-semibold text-foreground">Broussard Legal Services</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Attorney–Client Engagement Agreement</p>
                    </div>
                    <div className="text-right">
                      {formattedCreated && <p className="text-xs text-muted-foreground">{formattedCreated}</p>}
                      {formattedExpires && (
                        <p className="text-xs text-muted-foreground mt-0.5">Expires: {formattedExpires}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 space-y-1">
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Client</span>
                    <span className="text-sm font-medium text-foreground">{letter.client_name}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Email</span>
                    <span className="text-sm font-medium text-foreground">{letter.client_email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Retainer Applied</span>
                    <span className="text-sm font-semibold" style={{ color: '#355E3B' }}>${Number(letter.retainer_amount).toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              {/* Scope */}
              <LetterSection icon="📋" title="Scope of Representation" content={letter.scope} />

              {/* Fees */}
              <LetterSection icon="💼" title="Fees &amp; Billing" content={letter.fees} />

              {/* Retainer */}
              <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-lg">💰</span>
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground">Retainer Amount Applied</h3>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(53,94,59,0.05)', border: '1px solid rgba(53,94,59,0.15)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Deposit Paid</p>
                      <p className="text-2xl font-semibold mt-0.5" style={{ color: '#355E3B' }}>${Number(letter.retainer_amount).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Applied Toward</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">First Invoice</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  The deposit paid is credited in full toward your first invoice. No additional retainer is required to begin services.
                </p>
              </div>

              {/* Timeline */}
              <LetterSection icon="📅" title="Estimated Timeline" content={letter.timeline} />

              {/* Next Steps */}
              <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-lg">🚀</span>
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground">Next Steps</h3>
                </div>
                <div className="space-y-3">
                  {letter.next_steps.split('\n').filter(Boolean).map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-xs font-bold shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}>
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground font-light leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal Disclaimer */}
              <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(200,150,90,0.06)', border: '1px solid rgba(200,150,90,0.2)' }}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Legal Notice:</strong> By signing this engagement letter, you acknowledge that you have read, understood, and agree to the terms outlined above. This letter constitutes a binding agreement between you and Broussard Legal Services. Your digital signature carries the same legal weight as a handwritten signature under applicable electronic signature laws.
                </p>
              </div>
            </div>

            {/* Right: Signature Panel */}
            <div className="lg:sticky lg:top-28">
              <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
                <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-5">Digital Signature</p>

                {/* Signer info */}
                <div className="space-y-3 mb-5">
                  <div>
                    <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={typedName}
                      onChange={e => setTypedName(e.target.value)}
                      placeholder="Your full legal name"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={signerEmail}
                      onChange={e => setSignerEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {/* Signature method tabs */}
                <div className="flex rounded-xl overflow-hidden border border-border mb-4">
                  {(['type', 'draw'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSignatureTab(tab)}
                      className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all"
                      style={signatureTab === tab
                        ? { background: '#355E3B', color: '#fff' }
                        : { background: 'transparent', color: '#7A6B5D' }}
                    >
                      {tab === 'type' ? '✏️ Type' : '✍️ Draw'}
                    </button>
                  ))}
                </div>

                {/* Type signature */}
                {signatureTab === 'type' && (
                  <div className="mb-4">
                    <div className="rounded-xl border border-border bg-background px-4 py-6 text-center min-h-[80px] flex items-center justify-center" style={{ borderStyle: 'dashed' }}>
                      {typedName ? (
                        <span className="text-2xl text-foreground" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                          {typedName}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Your signature will appear here</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">Your typed name serves as your legal signature</p>
                  </div>
                )}

                {/* Draw signature */}
                {signatureTab === 'draw' && (
                  <div className="mb-4">
                    <div className="relative rounded-xl border border-border overflow-hidden" style={{ borderStyle: 'dashed' }}>
                      <canvas
                        ref={canvasRef}
                        width={320}
                        height={120}
                        className="w-full touch-none cursor-crosshair"
                        style={{ background: '#FAFAF8' }}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={endDraw}
                      />
                      {!hasDrawn && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <p className="text-xs text-muted-foreground">Draw your signature here</p>
                        </div>
                      )}
                    </div>
                    <button onClick={clearCanvas} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Clear &amp; redraw
                    </button>
                  </div>
                )}

                {signError && (
                  <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-xs text-red-700">{signError}</p>
                  </div>
                )}

                <button
                  onClick={handleSign}
                  disabled={submitting}
                  className="w-full py-4 px-6 rounded-full text-sm font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:opacity-90"
                  style={{ background: '#355E3B', color: '#fff' }}
                >
                  {submitting ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Signing…
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Sign Engagement Letter
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-muted-foreground mt-3 leading-relaxed">
                  By signing, you agree to the terms outlined in this engagement letter. Your signature is legally binding.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function LetterSection({ icon, title, content }: { icon: string; title: string; content: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground" dangerouslySetInnerHTML={{ __html: title }} />
      </div>
      <p className="text-sm text-foreground font-light leading-relaxed">{content}</p>
    </div>
  );
}
