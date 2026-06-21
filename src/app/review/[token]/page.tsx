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
}

type Step = 'loading' | 'not_found' | 'already_submitted' | 'form' | 'submitting' | 'success' | 'error';

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

  const supabase = createClient();

  useEffect(() => {
    if (!token) {
      setStep('not_found');
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('review_requests')
        .select('id, token, client_name, service, submitted')
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
      // 1. Mark review_request as submitted
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

      // 2. Auto-populate testimonials table if client allows public display
      if (allowPublic) {
        const firstName = reviewRequest.client_name.split(' ')[0];
        const lastName = reviewRequest.client_name.split(' ').slice(1).join(' ');
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
          // Link testimonial back to review_request
          await supabase
            .from('review_requests')
            .update({ testimonial_id: testimonialRow.id })
            .eq('token', token);
        }
      }

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
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-[#EDF5EE] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <h1 className="font-serif text-2xl text-[#2C1F14] mb-3">Already Submitted</h1>
          <p className="text-[#7A6B5D] text-sm leading-relaxed mb-6">
            Your review has already been submitted. Thank you so much for taking the time — it truly means a lot!
          </p>
          <Link href="/testimonials" className="inline-flex items-center gap-2 bg-[#C8965A] text-white text-sm font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-opacity">
            See Client Testimonials
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 bg-[#EDF5EE] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-[#2C1F14] mb-4">Thank You, {firstName}!</h1>
          <p className="text-[#7A6B5D] text-base leading-relaxed mb-4">
            Your feedback has been received and{allowPublic ? ' will be featured on the testimonials page shortly' : ' has been noted privately'}. It genuinely helps other legal professionals find the right support.
          </p>
          <p className="text-[#7A6B5D] text-sm leading-relaxed mb-8">
            If you ever need paralegal support again, I am always here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/book-consultation" className="inline-block bg-[#C8965A] text-white font-serif text-sm px-6 py-3 rounded-lg hover:bg-[#b07d45] transition-colors">
              Book Another Consultation
            </Link>
            <Link href="/testimonials" className="inline-block border border-[#C8965A] text-[#C8965A] font-serif text-sm px-6 py-3 rounded-lg hover:bg-[#F5EDE0] transition-colors">
              View Testimonials
            </Link>
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
