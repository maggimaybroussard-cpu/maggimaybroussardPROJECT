'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface CaseCloseRequest {
  id: string;
  token: string;
  client_name: string;
  service: string | null;
  case_reference: string | null;
  review_submitted: boolean;
  referral_code: string | null;
  referral_reward_desc: string | null;
}

type Step = 'loading' | 'not_found' | 'already_submitted' | 'review' | 'referral' | 'submitting' | 'success' | 'error';

export default function CaseClosePage() {
  const params = useParams();
  const token = params?.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [request, setRequest] = useState<CaseCloseRequest | null>(null);

  // Review fields
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewQuote, setReviewQuote] = useState('');
  const [reviewFullQuote, setReviewFullQuote] = useState('');
  const [reviewerRole, setReviewerRole] = useState('');
  const [reviewerFirm, setReviewerFirm] = useState('');
  const [reviewerLocation, setReviewerLocation] = useState('');
  const [allowPublic, setAllowPublic] = useState(true);

  // Referral fields
  const [referredName, setReferredName] = useState('');
  const [referredEmail, setReferredEmail] = useState('');
  const [referredFirm, setReferredFirm] = useState('');
  const [referredService, setReferredService] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const [skipReferral, setSkipReferral] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  useEffect(() => {
    if (!token) { setStep('not_found'); return; }
    (async () => {
      const { data, error } = await supabase
        .from('case_close_requests')
        .select('id, token, client_name, service, case_reference, review_submitted, referral_code, referral_reward_desc')
        .eq('token', token)
        .single();
      if (error || !data) { setStep('not_found'); return; }
      setRequest(data);
      setStep(data.review_submitted ? 'already_submitted' : 'review');
    })();
  }, [token]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    if (!reviewQuote.trim()) {
      setErrorMsg('Please write a brief headline quote.');
      return;
    }
    setErrorMsg('');
    setStep('submitting');

    try {
      const { error: updateErr } = await supabase
        .from('case_close_requests')
        .update({
          review_submitted: true,
          review_submitted_at: new Date().toISOString(),
          rating,
          review_quote: reviewQuote.trim(),
          review_full_quote: reviewFullQuote.trim() || reviewQuote.trim(),
          reviewer_role: reviewerRole.trim(),
          reviewer_firm: reviewerFirm.trim(),
          reviewer_location: reviewerLocation.trim(),
          allow_public_display: allowPublic,
          testimonial_status: allowPublic ? 'pending' : 'rejected',
        })
        .eq('token', token);

      if (updateErr) throw new Error(updateErr.message);

      // If public, create a pending testimonial row for admin approval
      if (allowPublic) {
        const { data: existingRows } = await supabase
          .from('testimonials')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1);
        const nextSort = (existingRows?.[0]?.sort_order ?? 0) + 1;

        const { data: testimonialRow } = await supabase
          .from('testimonials')
          .insert({
            name: request.client_name,
            role: reviewerRole.trim() || 'Client',
            firm: reviewerFirm.trim() || '',
            location: reviewerLocation.trim() || '',
            service: request.service ?? 'Legal Services',
            rating,
            quote: reviewQuote.trim(),
            full_quote: reviewFullQuote.trim() || reviewQuote.trim(),
            image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1070e0b4b-1763292306155.png',
            alt: `${request.client_name}, client testimonial`,
            featured: false,
            sort_order: nextSort,
            active: false, // pending admin approval
          })
          .select('id')
          .single();

        if (testimonialRow) {
          await supabase
            .from('case_close_requests')
            .update({ testimonial_id: testimonialRow.id })
            .eq('token', token);
        }
      }

      setStep('referral');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setErrorMsg(message);
      setStep('review');
    }
  };

  const handleReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;

    if (!skipReferral) {
      if (!referredName.trim() || !referredEmail.trim()) {
        setErrorMsg('Please provide the referral contact name and email.');
        return;
      }
    }
    setErrorMsg('');
    setStep('submitting');

    try {
      if (!skipReferral && referredName.trim() && referredEmail.trim()) {
        const { error: refErr } = await supabase
          .from('referral_submissions')
          .insert({
            case_close_id: request.id,
            referral_code: request.referral_code,
            referred_name: referredName.trim(),
            referred_email: referredEmail.trim(),
            referred_firm: referredFirm.trim() || null,
            referred_service: referredService.trim() || null,
            message: referralMessage.trim() || null,
            status: 'pending',
          });
        if (refErr) throw new Error(refErr.message);

        await supabase
          .from('case_close_requests')
          .update({ referral_incentive_sent: true })
          .eq('token', token);
      }

      setStep('success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setErrorMsg(message);
      setStep('referral');
    }
  };

  const firstName = request?.client_name?.split(' ')[0] ?? 'there';

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#C8965A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#7A6B5D] font-serif text-sm">Loading your case close summary…</p>
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
            This case close link is invalid or has expired. Please check the email you received from Maggi May Broussard.
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
            Your case close feedback has already been submitted. Thank you so much — it truly means a lot!
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
            Your feedback has been received{allowPublic ? ' and is pending review for the testimonials page' : ' privately'}. It genuinely helps other legal professionals find the right support.
          </p>
          {!skipReferral && referredName && (
            <div className="bg-[#F5EDE0] border border-[rgba(200,150,90,0.3)] rounded-xl p-4 mb-6 text-left">
              <p className="font-serif text-sm text-[#4A3728] font-semibold mb-1">🎁 Referral Reward Pending</p>
              <p className="font-serif text-sm text-[#7A6B5D]">
                Your referral for <strong>{referredName}</strong> has been submitted. Once they book a consultation, your reward of <strong>{request?.referral_reward_desc ?? '$50 credit'}</strong> will be applied.
              </p>
            </div>
          )}
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

  // ── Shared header ────────────────────────────────────────────────────────
  const PageHeader = () => (
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
  );

  // ── Review Form ──────────────────────────────────────────────────────────
  if (step === 'review' || (step === 'submitting' && !request?.review_submitted)) {
    return (
      <div className="min-h-screen bg-[#EDE8E0] py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <PageHeader />
          <div className="bg-[#FAF7F2] border border-[#D9D0C5] rounded-b-2xl shadow-lg overflow-hidden">
            {/* Progress */}
            <div className="px-8 pt-6 pb-0">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-[#C8965A] text-white text-xs font-bold flex items-center justify-center font-serif">1</div>
                  <span className="text-xs font-serif text-[#C8965A] font-semibold">Your Review</span>
                </div>
                <div className="flex-1 h-px bg-[#D9D0C5]" />
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-[#D9D0C5] text-[#7A6B5D] text-xs font-bold flex items-center justify-center font-serif">2</div>
                  <span className="text-xs font-serif text-[#7A6B5D]">Refer a Colleague</span>
                </div>
              </div>
            </div>

            <div className="px-8 pb-2">
              <span className="inline-block bg-[#C8965A] text-white text-xs font-bold tracking-wider uppercase px-4 py-1.5 rounded-full mb-5 font-serif">
                ★ Case Closed — Share Your Experience
              </span>
              <h2 className="font-serif text-2xl text-[#2C1F14] font-normal border-b border-[#D9D0C5] pb-4 mb-4">
                How was your {request?.service ?? 'engagement'}?
                {request?.case_reference && (
                  <span className="block text-sm text-[#7A6B5D] font-sans mt-1">Case: {request.case_reference}</span>
                )}
              </h2>
              <p className="font-serif text-[#2C1F14] text-base leading-relaxed mb-6">
                Dear {firstName}, thank you for trusting me with your legal support needs. Your honest feedback helps other attorneys and professionals find the right paralegal — and it means the world to me personally.
              </p>
            </div>

            <form onSubmit={handleReviewSubmit} className="px-8 pb-8 space-y-6">
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
                      <span className={(hoveredRating || rating) >= star ? 'text-[#C8965A]' : 'text-[#D9D0C5]'}>★</span>
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
                <p className="font-serif text-xs text-[#7A6B5D] mb-2">A short sentence that captures your experience</p>
                <input
                  type="text"
                  value={reviewQuote}
                  onChange={(e) => setReviewQuote(e.target.value)}
                  placeholder="e.g. Maggi May transformed how our firm handles overflow caseloads."
                  maxLength={160}
                  className="w-full border border-[#D9D0C5] rounded-lg px-4 py-3 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]"
                  required
                />
                <p className="text-right font-serif text-xs text-[#B0A090] mt-1">{reviewQuote.length}/160</p>
              </div>

              {/* Full Testimonial */}
              <div>
                <label className="block font-serif text-sm text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                  Full Testimonial <span className="text-[#7A6B5D] font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={reviewFullQuote}
                  onChange={(e) => setReviewFullQuote(e.target.value)}
                  placeholder="Tell us more about how Maggi May helped you…"
                  rows={4}
                  className="w-full border border-[#D9D0C5] rounded-lg px-4 py-3 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090] resize-none"
                />
              </div>

              {/* Context */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">Your Title / Role</label>
                  <input type="text" value={reviewerRole} onChange={(e) => setReviewerRole(e.target.value)} placeholder="e.g. Partner"
                    className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]" />
                </div>
                <div>
                  <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">Firm / Organization</label>
                  <input type="text" value={reviewerFirm} onChange={(e) => setReviewerFirm(e.target.value)} placeholder="e.g. Smith & Associates"
                    className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]" />
                </div>
                <div>
                  <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">City, State</label>
                  <input type="text" value={reviewerLocation} onChange={(e) => setReviewerLocation(e.target.value)} placeholder="e.g. Austin, TX"
                    className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]" />
                </div>
              </div>

              {/* Public consent */}
              <div className="bg-[#F5EDE0] border border-[rgba(200,150,90,0.3)] rounded-lg p-4 flex items-start gap-3">
                <input type="checkbox" id="allowPublic" checked={allowPublic} onChange={(e) => setAllowPublic(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#C8965A] cursor-pointer" />
                <label htmlFor="allowPublic" className="font-serif text-sm text-[#4A3728] leading-relaxed cursor-pointer">
                  I consent to having my review displayed publicly on the Maggi May Broussard website after admin approval. My name and firm may be shown alongside my testimonial.
                </label>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="font-serif text-sm text-red-700">{errorMsg}</p>
                </div>
              )}

              <button type="submit" disabled={step === 'submitting'}
                className="w-full bg-[#C8965A] hover:bg-[#b07d45] disabled:opacity-60 text-white font-serif text-base py-4 rounded-lg transition-colors shadow-md">
                {step === 'submitting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : 'Submit My Review & Continue →'}
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

  // ── Referral Form ────────────────────────────────────────────────────────
  if (step === 'referral' || (step === 'submitting' && request?.review_submitted)) {
    return (
      <div className="min-h-screen bg-[#EDE8E0] py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <PageHeader />
          <div className="bg-[#FAF7F2] border border-[#D9D0C5] rounded-b-2xl shadow-lg overflow-hidden">
            {/* Progress */}
            <div className="px-8 pt-6 pb-0">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-[#355E3B] text-white text-xs font-bold flex items-center justify-center font-serif">✓</div>
                  <span className="text-xs font-serif text-[#355E3B] font-semibold">Review Submitted</span>
                </div>
                <div className="flex-1 h-px bg-[#C8965A]" />
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-[#C8965A] text-white text-xs font-bold flex items-center justify-center font-serif">2</div>
                  <span className="text-xs font-serif text-[#C8965A] font-semibold">Refer a Colleague</span>
                </div>
              </div>
            </div>

            <div className="px-8 pb-2">
              <span className="inline-block bg-[#4A3728] text-[#C8965A] text-xs font-bold tracking-wider uppercase px-4 py-1.5 rounded-full mb-5 font-serif">
                🎁 Referral Incentive
              </span>
              <h2 className="font-serif text-2xl text-[#2C1F14] font-normal border-b border-[#D9D0C5] pb-4 mb-4">
                Know someone who needs paralegal support?
              </h2>
              <div className="bg-[#F5EDE0] border border-[rgba(200,150,90,0.4)] rounded-xl p-5 mb-6">
                <p className="font-serif text-sm text-[#4A3728] font-semibold mb-1">Your Referral Reward</p>
                <p className="font-serif text-2xl text-[#C8965A] font-normal mb-1">{request?.referral_reward_desc ?? '$50 credit toward future services'}</p>
                <p className="font-serif text-xs text-[#7A6B5D]">Reward applied once your referral books a consultation. No limit on referrals.</p>
                {request?.referral_code && (
                  <p className="font-serif text-xs text-[#7A6B5D] mt-2">Your referral code: <span className="font-bold text-[#4A3728] tracking-widest uppercase">{request.referral_code}</span></p>
                )}
              </div>
            </div>

            <form onSubmit={handleReferralSubmit} className="px-8 pb-8 space-y-5">
              {!skipReferral && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                        Contact Name <span className="text-[#C8965A]">*</span>
                      </label>
                      <input type="text" value={referredName} onChange={(e) => setReferredName(e.target.value)}
                        placeholder="e.g. Sarah Johnson"
                        className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]" />
                    </div>
                    <div>
                      <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">
                        Email Address <span className="text-[#C8965A]">*</span>
                      </label>
                      <input type="email" value={referredEmail} onChange={(e) => setReferredEmail(e.target.value)}
                        placeholder="e.g. sarah@lawfirm.com"
                        className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">Firm / Organization</label>
                      <input type="text" value={referredFirm} onChange={(e) => setReferredFirm(e.target.value)}
                        placeholder="e.g. Johnson & Partners"
                        className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090]" />
                    </div>
                    <div>
                      <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">Service Needed</label>
                      <select value={referredService} onChange={(e) => setReferredService(e.target.value)}
                        className="w-full border border-[#D9D0C5] rounded-lg px-3 py-2.5 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A]">
                        <option value="">Select a service…</option>
                        <option>Legal Research</option>
                        <option>Document Drafting</option>
                        <option>Litigation Support</option>
                        <option>Contract Review</option>
                        <option>Case Management</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-serif text-xs text-[#4A3728] font-bold tracking-wide uppercase mb-2">Personal Message (optional)</label>
                    <textarea value={referralMessage} onChange={(e) => setReferralMessage(e.target.value)}
                      placeholder="Add a personal note to include when we reach out to your referral…"
                      rows={3}
                      className="w-full border border-[#D9D0C5] rounded-lg px-4 py-3 font-serif text-sm text-[#2C1F14] bg-white focus:outline-none focus:border-[#C8965A] focus:ring-1 focus:ring-[#C8965A] placeholder-[#B0A090] resize-none" />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <input type="checkbox" id="skipReferral" checked={skipReferral} onChange={(e) => setSkipReferral(e.target.checked)}
                  className="w-4 h-4 accent-[#C8965A] cursor-pointer" />
                <label htmlFor="skipReferral" className="font-serif text-sm text-[#7A6B5D] cursor-pointer">
                  I don&apos;t have a referral right now — skip this step
                </label>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="font-serif text-sm text-red-700">{errorMsg}</p>
                </div>
              )}

              <button type="submit" disabled={step === 'submitting'}
                className="w-full bg-[#C8965A] hover:bg-[#b07d45] disabled:opacity-60 text-white font-serif text-base py-4 rounded-lg transition-colors shadow-md">
                {step === 'submitting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : skipReferral ? 'Finish Without Referral' : 'Submit Referral & Claim Reward →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
