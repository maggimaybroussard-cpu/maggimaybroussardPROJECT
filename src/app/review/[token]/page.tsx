'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ReviewRequest {
  id: string;
  token: string;
  client_name: string;
  service: string | null;
  submitted: boolean;
  rating?: number;
}

type Step = 'loading' | 'not_found' | 'already_submitted' | 'form' | 'submitting' | 'success' | 'error';

const GOOGLE_REVIEW_URL = 'https://g.page/r/broussardlegalservices/review';
const REDIRECT_DELAY = 8; // seconds

export default function ReviewPage() {
  const params = useParams();
  const token = params?.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [quote, setQuote] = useState('');
  const [fullQuote, setFullQuote] = useState('');
  const [role, setRole] = useState('');
  const [firm, setFirm] = useState('');
  const [location, setLocation] = useState('');
  const [allowPublic, setAllowPublic] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedRating, setSubmittedRating] = useState(5);
  const [countdown, setCountdown] = useState(REDIRECT_DELAY);
  const [redirectCancelled, setRedirectCancelled] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!token) {
      setStep('not_found');
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select('id, token, client_name, service, submitted, rating')
        .eq('token', token)
        .single();

      if (error || !data) {
        setStep('not_found');
        return;
      }
      setReviewRequest(data);
      setStep(data.submitted ? 'already_submitted' : 'form');
    })();
  }, [token]);

  // Countdown + auto-redirect after success
  useEffect(() => {
    if (step !== 'success' || redirectCancelled) return;

    if (countdown <= 0) {
      window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown, redirectCancelled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRequest) return;
    if (!quote.trim()) {
      setErrorMsg('Please write a brief summary (shown as the headline quote).');
      return;
    }
    setErrorMsg('');
    setStep('submitting');

    try {
      const { error: rrErr } = await supabase
        .from('review_requests')
        .update({
          submitted: true,
          submitted_at: new Date().toISOString(),
          rating,
          quote: quote.trim(),
          full_quote: fullQuote.trim() || quote.trim(),
        })
        .eq('token', token);

      if (rrErr) throw new Error(rrErr.message);

      if (allowPublic) {
        const displayName = reviewRequest.client_name;

        const { data: existingTestimonials } = await supabase
          .from('testimonials')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);

        const nextSortOrder = (existingTestimonials?.[0]?.sort_order ?? 0) + 1;

        const { data: testimonialRow, error: tErr } = await supabase
          .from('testimonials')
          .insert({
            name: displayName,
            role: role.trim() || 'Client',
            firm: firm.trim() || '',
            location: location.trim() || '',
            service: reviewRequest.service ?? 'Legal Services',
            rating,
            quote: quote.trim(),
            full_quote: fullQuote.trim() || quote.trim(),
            image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1070e0b4b-1763292306155.png',
            alt: `${displayName}, client testimonial`,
            featured: false,
            sort_order: nextSortOrder,
            active: true,
          })
          .select('id')
          .single();

        if (!tErr && testimonialRow) {
          await supabase
            .from('review_requests')
            .update({ testimonial_id: testimonialRow.id })
            .eq('token', token);
        }
      }

      setSubmittedRating(rating);
      setCountdown(REDIRECT_DELAY);
      setRedirectCancelled(false);
      setStep('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStep('form');
    }
  };

  const firstName = reviewRequest?.client_name?.split(' ')[0] ?? 'there';

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#C8965A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#7A6B5D] font-serif text-sm">Loading your review link…</p>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (step === 'not_found') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-[#F5EDE0] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-[#2C1F14] mb-3">Link Not Found</h1>
          <p className="text-[#7A6B5D] text-sm leading-relaxed mb-6">
            This review link is invalid or has expired. Please check the email you received from Maggi May Broussard.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 bg-[#C8965A] text-white text-sm font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-opacity">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // ── Already submitted ────────────────────────────────────────────────────
  if (step === 'already_submitted') {
    const prevRating = reviewRequest?.rating ?? 5;
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-[#D9D0C5] overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1.5" style={{ background: 'linear-gradient(to right, #C8965A, #E8B87A, #C8965A)' }} />

            <div className="px-8 py-10 text-center">
              {/* Check icon */}
              <div className="w-16 h-16 bg-[#EDF5EE] rounded-full flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>

              <h1 className="font-serif text-2xl text-[#2C1F14] mb-2">Already Submitted</h1>
              <p className="text-[#7A6B5D] text-sm leading-relaxed mb-6">
                Your review has already been received. Thank you so much — it truly means a lot!
              </p>

              {/* Stars display */}
              <div className="flex justify-center gap-1 mb-6">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`text-3xl ${s <= prevRating ? 'text-[#C8965A]' : 'text-[#D9D0C5]'}`}>★</span>
                ))}
              </div>

              {/* Google review CTA */}
              <div className="bg-[#F5EDE0] border border-[rgba(200,150,90,0.3)] rounded-xl p-5 mb-6">
                <p className="font-serif text-sm text-[#4A3728] mb-3 leading-relaxed">
                  Want to help even more? Share your experience on Google — it helps New Orleans residents find trusted paralegal support.
                </p>
                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#4285F4] hover:bg-[#3367D6] text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors shadow-sm"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
                  </svg>
                  Leave a Google Review
                </a>
              </div>

              <Link href="/testimonials" className="inline-block border border-[#C8965A] text-[#C8965A] font-serif text-sm px-6 py-2.5 rounded-lg hover:bg-[#F5EDE0] transition-colors">
                View Client Testimonials
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success (Thank-You Page) ──────────────────────────────────────────────
  if (step === 'success') {
    const progressPct = redirectCancelled ? 0 : ((REDIRECT_DELAY - countdown) / REDIRECT_DELAY) * 100;

    return (
      <div className="min-h-screen bg-[#EDE8E0] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">

          {/* Header band */}
          <div className="bg-[#4A3728] rounded-t-2xl overflow-hidden">
            <div className="h-1" style={{ background: 'linear-gradient(to right, #C8965A, #E8B87A, #C8965A)' }} />
            <div className="px-8 py-5 flex items-center gap-4">
              <div className="border-r border-[#C8965A] pr-4">
                <p className="text-[#C8965A] text-xs tracking-widest uppercase font-serif leading-tight">Paralegal</p>
                <p className="text-[#C8965A] text-xs tracking-widest uppercase font-serif leading-tight">Services</p>
              </div>
              <div>
                <h1 className="text-white font-serif text-xl font-normal">Maggi May Broussard</h1>
                <p className="text-white/60 text-xs font-serif tracking-wider mt-0.5">Louisiana &amp; Nationwide</p>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-[#FAF7F2] border border-[#D9D0C5] rounded-b-2xl shadow-lg overflow-hidden">
            <div className="px-8 pt-8 pb-8 text-center">

              {/* Animated checkmark */}
              <div className="w-20 h-20 bg-[#EDF5EE] rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>

              <span className="inline-block bg-[#C8965A] text-white text-xs font-bold tracking-wider uppercase px-4 py-1.5 rounded-full mb-4 font-serif">
                Review Received
              </span>

              <h2 className="font-serif text-3xl text-[#2C1F14] font-normal mb-2">
                Thank You, {firstName}!
              </h2>
              <p className="text-[#7A6B5D] text-sm leading-relaxed mb-6">
                Your feedback has been received and{allowPublic ? ' will be featured on the testimonials page shortly' : ' has been noted privately'}. It genuinely helps other legal professionals find the right support.
              </p>

              {/* 5-Star display */}
              <div className="bg-[#F5EDE0] border border-[rgba(200,150,90,0.25)] rounded-xl px-6 py-5 mb-6">
                <p className="font-serif text-xs text-[#7A6B5D] uppercase tracking-widest mb-3">Your Rating</p>
                <div className="flex justify-center gap-1.5 mb-2">
                  {[1,2,3,4,5].map((s) => (
                    <span
                      key={s}
                      className={`text-4xl transition-all ${s <= submittedRating ? 'text-[#C8965A]' : 'text-[#D9D0C5]'}`}
                      style={s <= submittedRating ? { filter: 'drop-shadow(0 1px 3px rgba(200,150,90,0.5))' } : {}}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="font-serif text-sm text-[#4A3728] font-semibold">
                  {submittedRating === 5 ? 'Excellent' : submittedRating === 4 ? 'Very Good' : submittedRating === 3 ? 'Good' : submittedRating === 2 ? 'Fair' : 'Poor'}
                </p>
              </div>

              {/* Google Review CTA */}
              <div className="border border-[#D9D0C5] rounded-xl p-5 mb-5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <p className="font-serif text-sm font-semibold text-[#2C1F14]">One more step — share on Google</p>
                </div>
                <p className="font-serif text-xs text-[#7A6B5D] leading-relaxed mb-4">
                  Help New Orleans residents find trusted paralegal support by leaving a quick Google review. It takes less than 60 seconds.
                </p>

                {/* Progress bar for countdown */}
                {!redirectCancelled && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-[#D9D0C5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4285F4] rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="font-serif text-xs text-[#7A6B5D] mt-1.5">
                      Opening Google Reviews in {countdown}s…
                    </p>
                  </div>
                )}

                <a
                  href={GOOGLE_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#4285F4] hover:bg-[#3367D6] text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors shadow-sm w-full justify-center"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
                  </svg>
                  Leave a Google Review
                </a>

                {!redirectCancelled && (
                  <button
                    onClick={() => setRedirectCancelled(true)}
                    className="mt-2 text-xs text-[#7A6B5D] hover:text-[#4A3728] underline underline-offset-2 transition-colors w-full"
                  >
                    No thanks, skip Google review
                  </button>
                )}
              </div>

              {/* Secondary actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/book-consultation" className="inline-block bg-[#C8965A] text-white font-serif text-sm px-6 py-3 rounded-lg hover:bg-[#b07d45] transition-colors text-center">
                  Book Another Consultation
                </Link>
                <Link href="/testimonials" className="inline-block border border-[#C8965A] text-[#C8965A] font-serif text-sm px-6 py-3 rounded-lg hover:bg-[#F5EDE0] transition-colors text-center">
                  View Testimonials
                </Link>
              </div>

              <p className="font-serif text-xs text-[#B0A090] mt-5 leading-relaxed">
                If you ever need paralegal support again, I am always here to help.
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#EDE8E0] py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="bg-[#4A3728] rounded-t-2xl overflow-hidden">
          <div className="h-1" style={{ background: 'linear-gradient(to right, #C8965A, #E8B87A, #C8965A)' }} />
          <div className="px-8 py-7 flex items-center gap-4">
            <div className="border-r border-[#C8965A] pr-4">
              <p className="text-[#C8965A] text-xs tracking-widest uppercase font-serif leading-tight">Paralegal</p>
              <p className="text-[#C8965A] text-xs tracking-widest uppercase font-serif leading-tight">Services</p>
            </div>
            <div>
              <h1 className="text-white font-serif text-2xl font-normal">Maggi May Broussard</h1>
              <p className="text-white/60 text-xs font-serif tracking-wider mt-0.5">Louisiana &amp; Nationwide</p>
            </div>
          </div>
          <div className="h-px mx-8" style={{ background: 'linear-gradient(to right, #C8965A, rgba(200,150,90,0.2), transparent)' }} />
          <div className="h-5" />
        </div>

        {/* Card */}
        <div className="bg-[#FAF7F2] border border-[#D9D0C5] rounded-b-2xl shadow-lg overflow-hidden">
          <div className="px-8 pt-8 pb-2">
            <span className="inline-block bg-[#C8965A] text-white text-xs font-bold tracking-wider uppercase px-4 py-1.5 rounded-full mb-5 font-serif">
              ★ Share Your Experience
            </span>
            <h2 className="font-serif text-2xl text-[#2C1F14] font-normal border-b border-[#D9D0C5] pb-4 mb-6">
              How was your {reviewRequest?.service ?? 'consultation'}?
            </h2>
            <p className="font-serif text-[#2C1F14] text-base leading-relaxed mb-6">
              Dear {firstName}, thank you for trusting me with your legal support needs. Your honest feedback helps other attorneys and professionals find the right paralegal — and it means the world to me personally.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">

            {/* Star Rating */}
            <div>
              <label className="block font-serif text-sm text-[#4A3728] font-bold tracking-wide uppercase mb-3">
                Overall Rating <span className="text-[#C8965A]">*</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <span className={(hoveredRating || rating) >= star ? 'text-[#C8965A]' : 'text-[#D9D0C5]'}>
                      ★
                    </span>
                  </button>
                ))}
                <span className="ml-2 self-center font-serif text-sm text-[#7A6B5D]">
                  {rating === 5 ? 'Excellent' : rating === 4 ? 'Very Good' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
                </span>
              </div>
            </div>

            {/* Headline Quote */}
            <div>
              <label className="block font-serif text-sm text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                Headline Quote <span className="text-[#C8965A]">*</span>
              </label>
              <p className="font-serif text-xs text-[#7A6B5D] mb-2">A short sentence that captures your experience (shown as the main quote)</p>
              <input
                type="text"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="e.g. Maggi May transformed how our firm handles overflow caseloads."
                maxLength={160}
                className="w-full border border-[#D9D0C5] rounded-lg px-4 py-3 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]"
                required
              />
              <p className="text-right font-serif text-xs text-[#B0A090] mt-1">{quote.length}/160</p>
            </div>

            {/* Full Testimonial */}
            <div>
              <label className="block font-serif text-sm text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                Full Testimonial <span className="text-[#7A6B5D] font-normal normal-case">(optional)</span>
              </label>
              <p className="font-serif text-xs text-[#7A6B5D] mb-2">Share more detail about your experience — this appears when visitors expand your review</p>
              <textarea
                value={fullQuote}
                onChange={(e) => setFullQuote(e.target.value)}
                placeholder="Tell us more about how Maggi May helped you…"
                rows={4}
                className="w-full border border-[#D9D0C5] rounded-lg px-4 py-3 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090] resize-none"
              />
            </div>

            {/* Optional context */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                  Your Title / Role
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Partner"
                  className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]"
                />
              </div>
              <div>
                <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                  Firm / Organization
                </label>
                <input
                  type="text"
                  value={firm}
                  onChange={(e) => setFirm(e.target.value)}
                  placeholder="e.g. Smith & Associates"
                  className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]"
                />
              </div>
              <div>
                <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                  City, State
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX"
                  className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]"
                />
              </div>
            </div>

            {/* Public consent */}
            <div className="bg-[#F5EDE0] border border-[rgba(200,150,90,0.3)] rounded-lg p-4 flex items-start gap-3">
              <input
                type="checkbox"
                id="allowPublic"
                checked={allowPublic}
                onChange={(e) => setAllowPublic(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#C8965A] cursor-pointer"
              />
              <label htmlFor="allowPublic" className="font-serif text-sm text-[#4A3728] leading-relaxed cursor-pointer">
                I consent to having my review displayed publicly on the Maggi May Broussard website. My name and firm may be shown alongside my testimonial.
              </label>
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="font-serif text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={step === 'submitting'}
              className="w-full bg-[#C8965A] hover:bg-[#b07d45] disabled:opacity-60 text-white font-serif text-base py-4 rounded-lg transition-colors shadow-md"
            >
              {step === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting…
                </span>
              ) : (
                'Submit My Review →'
              )}
            </button>

            <p className="font-serif text-xs text-[#7A6B5D] text-center leading-relaxed">
              Your feedback is entirely voluntary. By submitting, you confirm the review reflects your genuine experience.
            </p>
          </form>
        </div>

      </div>
    </div>
  );
}
