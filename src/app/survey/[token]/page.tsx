'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface SurveyRequest {
  id: string;
  client_name: string;
  client_email: string;
  inquiry_id: string | null;
  completed_at: string | null;
}

export default function NPSSurveyPage() {
  const params = useParams();
  const token = params?.token as string;
  const [request, setRequest] = useState<SurveyRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    npsScore: 0,
    feedback: '',
    attorneyRating: 0,
    communicationRating: 0,
    outcomeRating: 0,
    wouldRefer: null as boolean | null,
  });

  useEffect(() => {
    if (!token) return;
    const fetchRequest = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from('nps_survey_requests')
          .select('id, client_name, client_email, inquiry_id, completed_at')
          .eq('token', token)
          .single();

        if (err || !data) {
          setError('This survey link is invalid or has expired.');
          return;
        }

        if (data.completed_at) {
          setSubmitted(true);
        }

        setRequest(data);
      } catch {
        setError('Failed to load survey.');
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [token]);

  const handleSubmit = async () => {
    if (!request || form.npsScore === 0) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      await supabase.from('nps_responses').insert({
        inquiry_id: request.inquiry_id,
        client_name: request.client_name,
        client_email: request.client_email,
        nps_score: form.npsScore,
        feedback: form.feedback || null,
        attorney_rating: form.attorneyRating || null,
        communication_rating: form.communicationRating || null,
        outcome_rating: form.outcomeRating || null,
        would_refer: form.wouldRefer,
      });

      await supabase
        .from('nps_survey_requests')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', request.id);

      setSubmitted(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div>
      <label className="text-sm font-medium text-foreground mb-2 block">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => onChange(star)} className={`w-8 h-8 rounded-lg text-lg transition-all ${value >= star ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'}`}>★</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <AppLogo className="h-10 mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-foreground">How did we do?</h1>
          <p className="text-sm text-muted-foreground mt-2">Your feedback helps us improve our service</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-foreground font-semibold mb-2">Survey Unavailable</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="font-serif text-xl text-foreground mb-2">Thank you{request?.client_name ? `, ${request.client_name.split(' ')[0]}` : ''}!</h2>
              <p className="text-sm text-muted-foreground">Your feedback has been received. We appreciate you taking the time to share your experience with Broussard Legal Services.</p>
            </div>
          ) : request ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-4">Hi <strong className="text-foreground">{request.client_name}</strong>, we&apos;d love to hear about your experience.</p>
              </div>

              {/* NPS Score */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-3 block">
                  How likely are you to recommend Broussard Legal Services to a friend or colleague?
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                    <button
                      key={score}
                      onClick={() => setForm(p => ({ ...p, npsScore: score }))}
                      className={`w-9 h-9 rounded-xl text-sm font-semibold border transition-all ${form.npsScore === score ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:border-primary/50'}`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">Not likely</span>
                  <span className="text-xs text-muted-foreground">Very likely</span>
                </div>
              </div>

              {/* Star ratings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StarRating value={form.attorneyRating} onChange={v => setForm(p => ({ ...p, attorneyRating: v }))} label="Attorney Service" />
                <StarRating value={form.communicationRating} onChange={v => setForm(p => ({ ...p, communicationRating: v }))} label="Communication" />
                <StarRating value={form.outcomeRating} onChange={v => setForm(p => ({ ...p, outcomeRating: v }))} label="Case Outcome" />
              </div>

              {/* Would refer */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Would you refer us to others?</label>
                <div className="flex gap-3">
                  {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(opt => (
                    <button key={opt.label} onClick={() => setForm(p => ({ ...p, wouldRefer: opt.value }))} className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.wouldRefer === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:border-primary/50'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Any additional feedback? (optional)</label>
                <textarea
                  value={form.feedback}
                  onChange={e => setForm(p => ({ ...p, feedback: e.target.value }))}
                  rows={4}
                  placeholder="Tell us about your experience…"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || form.npsScore === 0}
                className="w-full py-3 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {submitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
