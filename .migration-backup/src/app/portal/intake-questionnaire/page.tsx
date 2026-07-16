'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { trackPortalFormSubmit } from '@/lib/analytics';
import { logPortalEvent } from '@/lib/portalEventLogger';
import AppLogo from '@/components/ui/AppLogo';

// ── Service-specific question sets ────────────────────────────────────────────

interface Question {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'radio';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

const SERVICE_QUESTIONNAIRES: Record<string, { title: string; description: string; questions: Question[] }> = {
  'Business Law & Contracts': {
    title: 'Business Law Intake',
    description: 'Tell us about your business legal matter so we can prepare for your consultation.',
    questions: [
      { id: 'business_name', label: 'Business Name', type: 'text', placeholder: 'Your company or entity name', required: true },
      { id: 'business_type', label: 'Business Type', type: 'select', options: ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Non-Profit', 'Other'], required: true },
      { id: 'matter_type', label: 'Type of Matter', type: 'select', options: ['Contract Drafting', 'Contract Review', 'Business Formation', 'Partnership Dispute', 'Vendor Agreement', 'NDA', 'Other'], required: true },
      { id: 'description', label: 'Describe Your Legal Need', type: 'textarea', placeholder: 'Provide as much detail as possible about your situation…', required: true },
      { id: 'timeline', label: 'Is There a Deadline?', type: 'date' },
      { id: 'prior_counsel', label: 'Have you worked with an attorney on this before?', type: 'radio', options: ['Yes', 'No'] },
    ],
  },
  'Employment Law': {
    title: 'Employment Law Intake',
    description: 'Help us understand your employment matter.',
    questions: [
      { id: 'employer_name', label: 'Employer / Company Name', type: 'text', placeholder: 'Name of the employer involved', required: true },
      { id: 'employment_status', label: 'Your Employment Status', type: 'select', options: ['Current Employee', 'Former Employee', 'Independent Contractor', 'Job Applicant'], required: true },
      { id: 'issue_type', label: 'Type of Issue', type: 'select', options: ['Wrongful Termination', 'Discrimination', 'Harassment', 'Wage & Hour Dispute', 'Non-Compete Agreement', 'Severance Review', 'Other'], required: true },
      { id: 'incident_date', label: 'When Did the Issue Occur?', type: 'date' },
      { id: 'description', label: 'Describe What Happened', type: 'textarea', placeholder: 'Provide a detailed account of the events…', required: true },
      { id: 'eeoc_filed', label: 'Have you filed an EEOC complaint?', type: 'radio', options: ['Yes', 'No', 'Not Applicable'] },
    ],
  },
  'Real Estate Law': {
    title: 'Real Estate Law Intake',
    description: 'Tell us about your real estate legal matter.',
    questions: [
      { id: 'property_address', label: 'Property Address', type: 'text', placeholder: 'Address of the property involved', required: true },
      { id: 'property_type', label: 'Property Type', type: 'select', options: ['Residential', 'Commercial', 'Land/Lot', 'Multi-Family', 'Other'], required: true },
      { id: 'matter_type', label: 'Type of Matter', type: 'select', options: ['Purchase/Sale', 'Lease Review', 'Landlord-Tenant Dispute', 'Title Issue', 'Foreclosure', 'Zoning', 'Other'], required: true },
      { id: 'closing_date', label: 'Closing Date (if applicable)', type: 'date' },
      { id: 'description', label: 'Describe Your Situation', type: 'textarea', placeholder: 'Explain the details of your real estate matter…', required: true },
      { id: 'represented', label: 'Do you have a real estate agent?', type: 'radio', options: ['Yes', 'No'] },
    ],
  },
  'Estate Planning': {
    title: 'Estate Planning Intake',
    description: 'Help us understand your estate planning needs.',
    questions: [
      { id: 'marital_status', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed', 'Domestic Partnership'], required: true },
      { id: 'has_children', label: 'Do you have children?', type: 'radio', options: ['Yes', 'No'], required: true },
      { id: 'services_needed', label: 'Services Needed', type: 'select', options: ['Will', 'Trust', 'Power of Attorney', 'Healthcare Directive', 'Full Estate Plan', 'Estate Administration', 'Other'], required: true },
      { id: 'existing_docs', label: 'Do you have existing estate planning documents?', type: 'radio', options: ['Yes — need updating', 'No — starting fresh'] },
      { id: 'description', label: 'Additional Details', type: 'textarea', placeholder: 'Any specific concerns, assets, or family circumstances to note…' },
    ],
  },
  'Litigation Support': {
    title: 'Litigation Support Intake',
    description: 'Tell us about your litigation matter.',
    questions: [
      { id: 'case_name', label: 'Case Name / Caption', type: 'text', placeholder: 'e.g. Smith v. Jones', required: true },
      { id: 'court', label: 'Court / Jurisdiction', type: 'text', placeholder: 'e.g. Eastern District of Louisiana', required: true },
      { id: 'case_number', label: 'Case Number (if filed)', type: 'text', placeholder: 'Docket or case number' },
      { id: 'stage', label: 'Current Stage', type: 'select', options: ['Pre-Litigation', 'Pleadings', 'Discovery', 'Motion Practice', 'Trial Prep', 'Appeal', 'Settlement'], required: true },
      { id: 'next_deadline', label: 'Next Deadline', type: 'date' },
      { id: 'description', label: 'Describe the Matter', type: 'textarea', placeholder: 'Summarize the dispute, parties involved, and what you need…', required: true },
    ],
  },
  'Legal Research': {
    title: 'Legal Research Intake',
    description: 'Tell us about your research request.',
    questions: [
      { id: 'research_topic', label: 'Research Topic', type: 'text', placeholder: 'Brief description of the legal issue', required: true },
      { id: 'jurisdiction', label: 'Jurisdiction', type: 'text', placeholder: 'e.g. Louisiana, Federal, Specific Circuit', required: true },
      { id: 'deliverable', label: 'Deliverable Needed', type: 'select', options: ['Research Memo', 'Case Summary', 'Statute Analysis', 'Regulatory Review', 'Other'], required: true },
      { id: 'deadline', label: 'Deadline', type: 'date', required: true },
      { id: 'description', label: 'Detailed Research Question', type: 'textarea', placeholder: 'Provide the specific legal questions you need answered…', required: true },
    ],
  },
};

const DEFAULT_QUESTIONNAIRE = {
  title: 'General Legal Intake',
  description: 'Tell us about your legal matter.',
  questions: [
    { id: 'matter_type', label: 'Type of Legal Matter', type: 'text' as const, placeholder: 'Briefly describe the type of legal issue', required: true },
    { id: 'description', label: 'Describe Your Situation', type: 'textarea' as const, placeholder: 'Provide as much detail as possible…', required: true },
    { id: 'deadline', label: 'Is There a Deadline?', type: 'date' as const },
    { id: 'prior_counsel', label: 'Have you worked with an attorney on this before?', type: 'radio' as const, options: ['Yes', 'No'] },
  ],
};

const brand = {
  primary: '#4A3728',
  green: '#355E3B',
  accent: '#C8965A',
  bg: '#FAF7F2',
  secondary: '#EDE8E0',
  border: '#D9D0C5',
  muted: '#7A6B5D',
  foreground: '#2C1F14',
};

export default function ClientIntakePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [serviceType, setServiceType] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [caseId, setCaseId] = useState('');
  const [clientName, setClientName] = useState('');

  const questionnaire = serviceType
    ? (SERVICE_QUESTIONNAIRES[serviceType] || DEFAULT_QUESTIONNAIRE)
    : null;

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login?redirectTo=/portal/intake-questionnaire');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      setClientName(name);
    }
  }, [user]);

  const setAnswer = (id: string, value: string) => {
    setAnswers(p => ({ ...p, [id]: value }));
  };

  const handleSubmit = async () => {
    if (!serviceType) { setError('Please select a service type.'); return; }
    const required = questionnaire?.questions.filter(q => q.required) || [];
    const missing = required.filter(q => !answers[q.id]?.trim());
    if (missing.length > 0) { setError(`Please complete: ${missing.map(q => q.label).join(', ')}`); return; }

    setSubmitting(true);
    setError('');
    try {
      // Build case record data from answers
      const caseData = {
        service: serviceType,
        status: 'new',
        name: clientName,
        email: user?.email || '',
        message: answers.description || Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n'),
        notes: JSON.stringify({ source: 'client_intake_questionnaire', service_type: serviceType, answers }),
      };

      // Insert into contact_inquiries to create a case record
      const { data: inquiry, error: inqErr } = await supabase
        .from('contact_inquiries')
        .insert(caseData)
        .select()
        .single();

      if (inqErr) throw inqErr;

      // Also save to intake_submissions if table exists
      await supabase.from('intake_submissions').insert({
        inquiry_id: inquiry.id,
        form_type: 'client_portal_questionnaire',
        service_type: serviceType,
        form_data: answers,
        submitted_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {}); // non-blocking

      setCaseId(inquiry.id);
      setSubmitted(true);
      trackPortalFormSubmit({ formType: 'intake_questionnaire', serviceType: serviceType });
      logPortalEvent('portal_form_submit', { form_type: 'intake_questionnaire', service_type: serviceType });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: brand.bg }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: brand.primary }} />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: brand.bg }}>
        <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: brand.border, background: '#fff' }}>
          <AppLogo className="h-8 w-auto" />
          <Link href="/portal/dashboard" className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand.muted }}>← Dashboard</Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 className="font-serif text-3xl mb-3" style={{ color: brand.foreground }}>Intake Submitted!</h1>
            <p className="text-base mb-6" style={{ color: brand.muted }}>
              Your {serviceType} intake questionnaire has been received. A case record has been created and our team will be in touch shortly.
            </p>
            {caseId && (
              <p className="text-xs mb-6" style={{ color: brand.muted }}>Case Reference: <span className="font-mono font-semibold">{caseId.slice(0, 8).toUpperCase()}</span></p>
            )}
            <div className="flex gap-3 justify-center">
              <Link href="/portal/dashboard" className="px-6 py-3 rounded-full text-white text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90" style={{ background: brand.primary }}>
                Go to Dashboard
              </Link>
              <Link href="/portal/cases" className="px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border transition-all hover:bg-secondary/40" style={{ borderColor: brand.border, color: brand.foreground }}>
                View Cases
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: brand.bg }}>
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: brand.border, background: '#fff' }}>
        <AppLogo className="h-8 w-auto" />
        <Link href="/portal/dashboard" className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand.muted }}>← Dashboard</Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl mb-2" style={{ color: brand.foreground }}>New Matter Intake</h1>
          <p className="text-base" style={{ color: brand.muted }}>
            Complete this questionnaire to open a new matter. Your answers will auto-populate your case record.
          </p>
        </div>

        {/* Service Type Selector */}
        <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: brand.border, background: '#fff' }}>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: brand.muted }}>
            Select Service Type *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.keys(SERVICE_QUESTIONNAIRES).map(svc => (
              <button key={svc} onClick={() => { setServiceType(svc); setAnswers({}); setError(''); }}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all"
                style={serviceType === svc
                  ? { background: 'rgba(53,94,59,0.1)', border: `2px solid ${brand.green}`, color: brand.green }
                  : { background: brand.bg, border: `1px solid ${brand.border}`, color: brand.muted }}>
                {svc}
              </button>
            ))}
          </div>
        </div>

        {/* Questionnaire */}
        {questionnaire && (
          <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: brand.border, background: '#fff' }}>
            <div className="mb-5 pb-4" style={{ borderBottom: `1px solid ${brand.border}` }}>
              <h2 className="font-serif text-xl mb-1" style={{ color: brand.foreground }}>{questionnaire.title}</h2>
              <p className="text-sm" style={{ color: brand.muted }}>{questionnaire.description}</p>
            </div>

            <div className="space-y-5">
              {questionnaire.questions.map(q => (
                <div key={q.id}>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>
                    {q.label}{q.required && <span className="ml-1" style={{ color: brand.accent }}>*</span>}
                  </label>

                  {q.type === 'text' && (
                    <input type="text" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
                  )}

                  {q.type === 'textarea' && (
                    <textarea rows={4} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                      style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
                  )}

                  {q.type === 'select' && (
                    <select value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all appearance-none"
                      style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: answers[q.id] ? brand.foreground : brand.muted }}>
                      <option value="">Select…</option>
                      {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}

                  {q.type === 'date' && (
                    <input type="date" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                      style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
                  )}

                  {q.type === 'radio' && (
                    <div className="flex gap-3 flex-wrap">
                      {q.options?.map(opt => (
                        <button key={opt} onClick={() => setAnswer(q.id, opt)}
                          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={answers[q.id] === opt
                            ? { background: 'rgba(53,94,59,0.1)', border: `2px solid ${brand.green}`, color: brand.green }
                            : { background: brand.bg, border: `1px solid ${brand.border}`, color: brand.muted }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl mb-4 text-sm" style={{ background: 'rgba(184,92,56,0.08)', border: '1px solid rgba(184,92,56,0.3)', color: '#B85C38' }}>
            {error}
          </div>
        )}

        {questionnaire && (
          <button onClick={handleSubmit} disabled={submitting || !serviceType}
            className="w-full py-4 rounded-xl text-white text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: brand.primary }}>
            {submitting ? (
              <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Submitting…</>
            ) : 'Submit Intake Questionnaire'}
          </button>
        )}
      </main>
    </div>
  );
}
