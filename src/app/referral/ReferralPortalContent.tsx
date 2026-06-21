'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface CaseCloseRequest {
  id: string;
  client_name: string;
  referral_code: string | null;
  referral_reward_desc: string | null;
}

const SERVICES = [
  'Business Law & Contracts',
  'Employment Law',
  'Real Estate Law',
  'Estate Planning',
  'Litigation Support',
  'Legal Research',
  'Document Drafting',
  'Other',
];

const brand = {
  primary: '#4A3728',
  accent: '#C8965A',
  green: '#355E3B',
  bg: '#FAF7F2',
  border: '#D9D0C5',
  muted: '#7A6B5D',
  foreground: '#2C1F14',
};

export default function ReferralPortalContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [referralCode, setReferralCode] = useState(codeParam);
  const [caseClose, setCaseClose] = useState<CaseCloseRequest | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    claimant_name: '',
    claimant_email: '',
    claimant_phone: '',
    service_interest: '',
    message: '',
  });

  const supabase = createClient();

  useEffect(() => {
    if (codeParam) lookupCode(codeParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const lookupCode = async (code: string) => {
    if (!code.trim()) return;
    setLookingUp(true);
    setError('');
    try {
      const { data } = await supabase
        .from('case_close_requests')
        .select('id, client_name, referral_code, referral_reward_desc')
        .eq('referral_code', code.trim())
        .maybeSingle();
      setCaseClose(data);
      if (!data) setError('Referral code not found. Please check and try again.');
    } catch {
      setError('Could not verify referral code.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.claimant_name.trim() || !form.claimant_email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!referralCode.trim()) {
      setError('Please enter your referral code.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { error: insertErr } = await supabase.from('referral_claims').insert({
        case_close_id: caseClose?.id || null,
        referral_code: referralCode.trim(),
        claimant_name: form.claimant_name.trim(),
        claimant_email: form.claimant_email.trim(),
        claimant_phone: form.claimant_phone.trim() || null,
        referred_by_name: caseClose?.client_name || null,
        service_interest: form.service_interest || null,
        message: form.message.trim() || null,
        incentive_desc: caseClose?.referral_reward_desc || '$50 credit toward future services',
        claim_status: 'pending',
      });
      if (insertErr) throw insertErr;
      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: brand.bg }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: brand.border, background: '#fff' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <AppLogo className="h-8 w-auto" />
          </Link>
          <Link href="/portal/login" className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand.muted }}>
            Client Portal →
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          {step === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(53,94,59,0.1)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="font-serif text-3xl mb-3" style={{ color: brand.foreground }}>Claim Submitted!</h1>
              <p className="text-base mb-6" style={{ color: brand.muted }}>
                Thank you, {form.claimant_name}. Your referral incentive claim has been received and is under review.
                We will contact you at <strong>{form.claimant_email}</strong> within 2–3 business days.
              </p>
              <div className="p-4 rounded-2xl border mb-6" style={{ borderColor: brand.border, background: '#fff' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: brand.foreground }}>Your Incentive</p>
                <p className="text-sm" style={{ color: brand.muted }}>
                  {caseClose?.referral_reward_desc || '$50 credit toward future services'}
                </p>
              </div>
              <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                style={{ background: brand.primary }}>
                Return to Homepage
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: brand.accent }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <h1 className="font-serif text-3xl mb-2" style={{ color: brand.foreground }}>Claim Your Referral Reward</h1>
                <p className="text-base" style={{ color: brand.muted }}>
                  A Broussard Legal Services client referred you. Enter your referral code below to claim your incentive.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="rounded-2xl border p-8 space-y-5" style={{ borderColor: brand.border, background: '#fff' }}>
                {/* Referral Code */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>
                    Referral Code *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={e => { setReferralCode(e.target.value); setCaseClose(null); setError(''); }}
                      placeholder="e.g. BLS-REF-2024"
                      className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }}
                    />
                    <button type="button" onClick={() => lookupCode(referralCode)} disabled={lookingUp || !referralCode.trim()}
                      className="px-4 py-3 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: brand.primary }}>
                      {lookingUp ? '…' : 'Verify'}
                    </button>
                  </div>
                  {caseClose && (
                    <div className="mt-2 p-3 rounded-xl flex items-center gap-2" style={{ background: 'rgba(53,94,59,0.08)', border: '1px solid rgba(53,94,59,0.2)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span className="text-xs font-semibold" style={{ color: '#355E3B' }}>
                        Referred by {caseClose.client_name} · {caseClose.referral_reward_desc || '$50 credit'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>Your Full Name *</label>
                  <input type="text" value={form.claimant_name} onChange={e => setForm(p => ({ ...p, claimant_name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>Email Address *</label>
                  <input type="email" value={form.claimant_email} onChange={e => setForm(p => ({ ...p, claimant_email: e.target.value }))}
                    placeholder="jane@example.com"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>Phone (Optional)</label>
                  <input type="tel" value={form.claimant_phone} onChange={e => setForm(p => ({ ...p, claimant_phone: e.target.value }))}
                    placeholder="(555) 000-0000"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>Service You Need</label>
                  <select value={form.service_interest} onChange={e => setForm(p => ({ ...p, service_interest: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all appearance-none"
                    style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: form.service_interest ? brand.foreground : brand.muted }}>
                    <option value="">Select a service…</option>
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>Message (Optional)</label>
                  <textarea rows={3} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Tell us a bit about your legal needs…"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                    style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
                </div>

                {error && (
                  <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(184,92,56,0.08)', border: '1px solid rgba(184,92,56,0.3)', color: '#B85C38' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting || !form.claimant_name.trim() || !form.claimant_email.trim()}
                  className="w-full py-3.5 rounded-xl text-white text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: brand.primary }}>
                  {submitting ? 'Submitting…' : 'Claim My Referral Reward'}
                </button>

                <p className="text-xs text-center" style={{ color: brand.muted }}>
                  By submitting, you agree to be contacted by Broussard Legal Services regarding your claim.
                </p>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="border-t py-6 text-center" style={{ borderColor: brand.border }}>
        <p className="text-xs" style={{ color: brand.muted }}>
          © {new Date().getFullYear()} Broussard Legal Services · <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
        </p>
      </footer>
    </div>
  );
}
