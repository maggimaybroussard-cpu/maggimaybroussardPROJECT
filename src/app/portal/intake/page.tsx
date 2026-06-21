'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { trackPortalFormSubmit } from '@/lib/analytics';
import { logPortalEvent } from '@/lib/portalEventLogger';

// ── Types ──────────────────────────────────────────────────────────────────────
interface IntakeForm {
  // Client Details
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  firmName: string;
  barNumber: string;
  // Case Background
  caseType: string;
  caseTitle: string;
  caseDescription: string;
  opposingParty: string;
  jurisdiction: string;
  caseStage: string;
  courtName: string;
  caseNumber: string;
  // Timeline
  filingDeadline: string;
  hearingDate: string;
  trialDate: string;
  retainerStartDate: string;
  // Urgency & Notes
  urgency: string;
  budget: string;
  preferredContact: string;
  internalNotes: string;
  referralSource: string;
}

const CASE_TYPES = [
  'Litigation Support',
  'Legal Research & Memos',
  'Document Drafting',
  'Discovery Assistance',
  'Case Management',
  'Trial Preparation',
  'Contract Review',
  'Deposition Support',
  'Motion & Brief Drafting',
  'Other',
];

const CASE_STAGES = [
  'Pre-litigation / Investigation',
  'Pleadings Filed',
  'Discovery Phase',
  'Motion Practice',
  'Trial Preparation',
  'Post-Trial / Appeal',
  'Settlement Negotiations',
  'Not Yet Filed',
];

const URGENCY_CONFIG = {
  standard: { label: 'Standard', timeframe: '1–2 weeks', color: '#7A6B5D', bg: 'rgba(122,107,93,0.08)', border: 'rgba(122,107,93,0.25)', icon: '🕐' },
  priority: { label: 'Priority', timeframe: '3–5 days', color: '#C8965A', bg: 'rgba(200,150,90,0.08)', border: 'rgba(200,150,90,0.35)', icon: '⚡' },
  urgent: { label: 'Urgent', timeframe: '24–48 hrs', color: '#B85C38', bg: 'rgba(184,92,56,0.08)', border: 'rgba(184,92,56,0.35)', icon: '🔴' },
};

const BUDGET_OPTIONS = [
  { value: 'under_500', label: 'Under $500' },
  { value: '500_2000', label: '$500 – $2,000' },
  { value: '2000_5000', label: '$2,000 – $5,000' },
  { value: 'over_5000', label: '$5,000+' },
  { value: 'retainer_750', label: 'Retainer — $750/10hrs' },
  { value: 'retainer_1500', label: 'Retainer — $1,500/20hrs' },
  { value: 'retainer_2800', label: 'Retainer — $2,800/40hrs' },
  { value: 'not_sure', label: 'TBD / Discuss' },
];

const CONTACT_PREFS = ['Email', 'Phone Call', 'Video Call', 'Any'];

const brand = {
  primary: '#4A3728',
  green: '#355E3B',
  greenLight: 'rgba(53,94,59,0.08)',
  accent: '#C8965A',
  accentLight: 'rgba(200,150,90,0.08)',
  bg: '#FAF7F2',
  secondary: '#EDE8E0',
  border: '#D9D0C5',
  muted: '#7A6B5D',
  foreground: '#2C1F14',
};

const SECTIONS = [
  { id: 'client', label: 'Client Details', icon: '👤' },
  { id: 'case', label: 'Case Background', icon: '⚖️' },
  { id: 'timeline', label: 'Timeline', icon: '📅' },
  { id: 'urgency', label: 'Urgency & Notes', icon: '🎯' },
];

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-6 pb-5" style={{ borderBottom: `1px solid ${brand.border}` }}>
      <span className="text-2xl mt-0.5">{icon}</span>
      <div>
        <h2 className="font-serif text-xl" style={{ color: brand.foreground }}>{title}</h2>
        <p className="text-sm mt-0.5" style={{ color: brand.muted }}>{subtitle}</p>
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>
      {children}
      {required && <span className="ml-1" style={{ color: brand.accent }}>*</span>}
    </label>
  );
}

function InputField({
  value, onChange, placeholder, type = 'text', error,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: string;
}) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
        style={{
          background: brand.bg,
          border: `1px solid ${error ? '#B85C38' : brand.border}`,
          color: brand.foreground,
          fontFamily: 'Georgia, serif',
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{error}</p>}
    </div>
  );
}

function SelectField({
  value, onChange, options, placeholder, error,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 appearance-none"
        style={{
          background: brand.bg,
          border: `1px solid ${error ? '#B85C38' : brand.border}`,
          color: value ? brand.foreground : brand.muted,
          fontFamily: 'Georgia, serif',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{error}</p>}
    </div>
  );
}

function TextareaField({
  value, onChange, placeholder, rows = 4, error,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; error?: string;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 resize-none"
        style={{
          background: brand.bg,
          border: `1px solid ${error ? '#B85C38' : brand.border}`,
          color: brand.foreground,
          fontFamily: 'Georgia, serif',
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#B85C38' }}>{error}</p>}
    </div>
  );
}

export default function PortalIntakePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('client');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdCaseId, setCreatedCaseId] = useState('');

  const [form, setForm] = useState<IntakeForm>({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    firmName: '',
    barNumber: '',
    caseType: '',
    caseTitle: '',
    caseDescription: '',
    opposingParty: '',
    jurisdiction: '',
    caseStage: '',
    courtName: '',
    caseNumber: '',
    filingDeadline: '',
    hearingDate: '',
    trialDate: '',
    retainerStartDate: '',
    urgency: 'standard',
    budget: '',
    preferredContact: 'Email',
    internalNotes: '',
    referralSource: '',
  });

  const setField = (key: keyof IntakeForm, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.clientName.trim()) e.clientName = 'Client name is required';
    if (!form.clientEmail.trim()) e.clientEmail = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) e.clientEmail = 'Enter a valid email';
    if (!form.caseType) e.caseType = 'Select a service type';
    if (!form.caseDescription.trim()) e.caseDescription = 'Case description is required';
    else if (form.caseDescription.trim().length < 20) e.caseDescription = 'Please provide at least 20 characters';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.clientName || e.clientEmail) setActiveSection('client');
      else if (e.caseType || e.caseDescription) setActiveSection('case');
    }
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const supabase = createClient();

      // 1. Insert into intake_submissions
      const extendedNotes = [
        form.jurisdiction ? `Jurisdiction: ${form.jurisdiction}` : null,
        form.caseStage ? `Case Stage: ${form.caseStage}` : null,
        form.courtName ? `Court: ${form.courtName}` : null,
        form.caseNumber ? `Case #: ${form.caseNumber}` : null,
        form.budget ? `Budget: ${BUDGET_OPTIONS.find((b) => b.value === form.budget)?.label ?? form.budget}` : null,
        form.preferredContact ? `Preferred Contact: ${form.preferredContact}` : null,
        form.referralSource ? `Referral Source: ${form.referralSource}` : null,
        form.internalNotes ? `Internal Notes: ${form.internalNotes}` : null,
      ].filter(Boolean).join('\n');

      const { data: submission, error: subErr } = await supabase
        .from('intake_submissions')
        .insert({
          name: form.clientName.trim(),
          email: form.clientEmail.trim().toLowerCase(),
          phone: form.clientPhone.trim() || null,
          firm_name: form.firmName.trim() || null,
          case_type: form.caseType,
          case_description: form.caseDescription.trim(),
          opposing_party: form.opposingParty.trim() || null,
          urgency: form.urgency,
          additional_notes: extendedNotes || null,
        })
        .select('id')
        .single();

      if (subErr) throw new Error(subErr.message);
      const submissionId = submission?.id ?? '';

      // 2. Upsert into contact_inquiries to auto-populate portal records
      const { data: inquiry, error: inqErr } = await supabase
        .from('contact_inquiries')
        .insert({
          name: form.clientName.trim(),
          email: form.clientEmail.trim().toLowerCase(),
          firm: form.firmName.trim() || null,
          service: form.caseType,
          message: form.caseDescription.trim(),
          status: 'new',
        })
        .select('id')
        .single();

      if (inqErr && !inqErr.message.includes('duplicate')) throw new Error(inqErr.message);

      const inquiryId = inquiry?.id;

      if (inquiryId) {
        // Link intake submission to inquiry
        await supabase
          .from('intake_submissions')
          .update({ inquiry_id: inquiryId })
          .eq('id', submissionId);

        // Add timeline events
        const timelineEvents = [
          {
            inquiry_id: inquiryId,
            event_title: 'Intake Form Submitted',
            event_description: `Dedicated intake completed. Service: ${form.caseType}. Urgency: ${form.urgency}. Stage: ${form.caseStage || 'Not specified'}.`,
            event_date: new Date().toISOString(),
          },
        ];

        if (form.filingDeadline) {
          timelineEvents.push({
            inquiry_id: inquiryId,
            event_title: 'Filing Deadline',
            event_description: `Upcoming filing deadline recorded during intake.`,
            event_date: new Date(form.filingDeadline).toISOString(),
          });
        }
        if (form.hearingDate) {
          timelineEvents.push({
            inquiry_id: inquiryId,
            event_title: 'Hearing Date',
            event_description: `Scheduled hearing date recorded during intake.`,
            event_date: new Date(form.hearingDate).toISOString(),
          });
        }
        if (form.trialDate) {
          timelineEvents.push({
            inquiry_id: inquiryId,
            event_title: 'Trial Date',
            event_description: `Trial date recorded during intake.`,
            event_date: new Date(form.trialDate).toISOString(),
          });
        }

        await supabase.from('case_timeline').insert(timelineEvents);

        setCreatedCaseId(inquiryId);

        // 3. Trigger case notification email (non-blocking)
        fetch('/api/case-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: form.clientName.trim(),
            clientEmail: form.clientEmail.trim().toLowerCase(),
            caseName: form.caseTitle.trim() || `${form.caseType} Matter`,
            caseId: inquiryId,
            service: form.caseType,
            status: 'new',
            message: form.caseDescription.trim().slice(0, 300),
            eventType: 'created',
            notes: form.internalNotes.trim() || undefined,
          }),
        }).catch(() => {});

        // 4. Trigger intake nurture + prospect scoring (non-blocking)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseAnonKey) {
          const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` };
          fetch(`${supabaseUrl}/functions/v1/schedule-intake-nurture`, {
            method: 'POST', headers,
            body: JSON.stringify({ submissionId, inquiryId, recipientEmail: form.clientEmail.trim().toLowerCase(), recipientName: form.clientName.trim(), caseType: form.caseType, urgency: form.urgency }),
          }).catch(() => {});
          fetch(`${supabaseUrl}/functions/v1/score-prospect`, {
            method: 'POST', headers,
            body: JSON.stringify({ submissionId, inquiryId, email: form.clientEmail.trim().toLowerCase(), name: form.clientName.trim(), caseType: form.caseType, caseDescription: form.caseDescription.trim(), urgency: form.urgency, firmName: form.firmName.trim() || null }),
          }).catch(() => {});
        }
      }

      setSubmitted(true);
      trackPortalFormSubmit({ formType: 'intake_form', serviceType: form.caseType });
      logPortalEvent('portal_form_submit', { form_type: 'intake_form', service_type: form.caseType });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-16" style={{ background: brand.secondary }}>
        <div className="w-full max-w-lg">
          {/* Check */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8" style={{ background: brand.greenLight, border: `2px solid rgba(53,94,59,0.25)` }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <p className="text-center text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: brand.accent }}>Intake Complete</p>
          <h1 className="font-serif text-3xl text-center mb-3" style={{ color: brand.foreground }}>
            Case Record Created
          </h1>
          <p className="text-center text-sm leading-relaxed mb-8" style={{ color: brand.muted }}>
            The client intake has been submitted, the portal record has been auto-populated, and a case notification email has been dispatched to <strong style={{ color: brand.foreground }}>{form.clientEmail}</strong>.
          </p>

          {/* Summary */}
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: brand.muted }}>Intake Summary</p>
            <div className="space-y-3">
              {[
                { label: 'Client', value: form.clientName },
                { label: 'Email', value: form.clientEmail },
                { label: 'Service', value: form.caseType },
                { label: 'Urgency', value: URGENCY_CONFIG[form.urgency as keyof typeof URGENCY_CONFIG]?.label ?? form.urgency },
                { label: 'Case Stage', value: form.caseStage || '—' },
                ...(createdCaseId ? [{ label: 'Case ID', value: `#${createdCaseId.slice(0, 8).toUpperCase()}` }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: brand.muted }}>{label}</span>
                  <span className="text-sm font-semibold text-right" style={{ color: brand.foreground }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {createdCaseId && (
              <Link
                href="/portal/cases"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                style={{ background: brand.green, color: '#fff' }}
              >
                View Case Portal
              </Link>
            )}
            <button
              onClick={() => {
                setSubmitted(false);
                setForm({
                  clientName: '', clientEmail: '', clientPhone: '', firmName: '', barNumber: '',
                  caseType: '', caseTitle: '', caseDescription: '', opposingParty: '', jurisdiction: '',
                  caseStage: '', courtName: '', caseNumber: '', filingDeadline: '', hearingDate: '',
                  trialDate: '', retainerStartDate: '', urgency: 'standard', budget: '',
                  preferredContact: 'Email', internalNotes: '', referralSource: '',
                });
                setActiveSection('client');
                setCreatedCaseId('');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
              style={{ background: brand.secondary, color: brand.foreground, border: `1px solid ${brand.border}` }}
            >
              New Intake
            </button>
          </div>
        </div>
      </div>
    );
  }

  const urgencyCfg = URGENCY_CONFIG[form.urgency as keyof typeof URGENCY_CONFIG];

  return (
    <div className="min-h-screen" style={{ background: brand.secondary }}>
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40" style={{ background: brand.primary, borderBottom: `1px solid rgba(200,150,90,0.2)` }}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size={32} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand.accent }}>Client Intake</p>
              <p className="text-sm font-serif" style={{ color: 'rgba(250,247,242,0.85)' }}>New Case Record</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/portal/dashboard"
              className="text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full transition-all hover:opacity-80"
              style={{ color: 'rgba(250,247,242,0.6)', border: '1px solid rgba(250,247,242,0.15)' }}
            >
              ← Portal
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Sidebar Nav ── */}
          <aside className="lg:w-56 shrink-0">
            <div className="rounded-2xl overflow-hidden sticky top-24" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
              <div className="px-4 py-4" style={{ borderBottom: `1px solid ${brand.border}` }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: brand.muted }}>Sections</p>
              </div>
              <nav className="p-2">
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 mb-0.5"
                    style={
                      activeSection === sec.id
                        ? { background: brand.greenLight, color: brand.green }
                        : { color: brand.muted }
                    }
                  >
                    <span className="text-base">{sec.icon}</span>
                    <span className="text-sm font-semibold">{sec.label}</span>
                    {activeSection === sec.id && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: brand.green }} />
                    )}
                  </button>
                ))}
              </nav>

              {/* Urgency badge */}
              <div className="p-3 m-3 rounded-xl" style={{ background: urgencyCfg.bg, border: `1px solid ${urgencyCfg.border}` }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: urgencyCfg.color }}>
                  {urgencyCfg.icon} {urgencyCfg.label}
                </p>
                <p className="text-xs" style={{ color: urgencyCfg.color }}>{urgencyCfg.timeframe}</p>
              </div>
            </div>
          </aside>

          {/* ── Main Form ── */}
          <main className="flex-1 min-w-0">
            {/* ── Section: Client Details ── */}
            {activeSection === 'client' && (
              <div className="rounded-2xl p-6 md:p-8" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
                <SectionHeader icon="👤" title="Client Details" subtitle="Primary contact information for the client or referring attorney." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <FieldLabel required>Full Name</FieldLabel>
                    <InputField value={form.clientName} onChange={(v) => setField('clientName', v)} placeholder="e.g. Jane Smith" error={errors.clientName} />
                  </div>
                  <div>
                    <FieldLabel required>Email Address</FieldLabel>
                    <InputField type="email" value={form.clientEmail} onChange={(v) => setField('clientEmail', v)} placeholder="client@example.com" error={errors.clientEmail} />
                  </div>
                  <div>
                    <FieldLabel>Phone Number</FieldLabel>
                    <InputField type="tel" value={form.clientPhone} onChange={(v) => setField('clientPhone', v)} placeholder="(555) 000-0000" />
                  </div>
                  <div>
                    <FieldLabel>Law Firm / Organization</FieldLabel>
                    <InputField value={form.firmName} onChange={(v) => setField('firmName', v)} placeholder="Smith & Associates" />
                  </div>
                  <div>
                    <FieldLabel>Bar Number (if attorney)</FieldLabel>
                    <InputField value={form.barNumber} onChange={(v) => setField('barNumber', v)} placeholder="LA-12345" />
                  </div>
                  <div>
                    <FieldLabel>Preferred Contact Method</FieldLabel>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {CONTACT_PREFS.map((pref) => (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => setField('preferredContact', pref)}
                          className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200"
                          style={
                            form.preferredContact === pref
                              ? { background: brand.green, color: '#fff', border: `1px solid ${brand.green}` }
                              : { background: 'transparent', color: brand.muted, border: `1px solid ${brand.border}` }
                          }
                        >
                          {pref}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Referral Source</FieldLabel>
                    <SelectField
                      value={form.referralSource}
                      onChange={(v) => setField('referralSource', v)}
                      options={['Google Search', 'Referral from Attorney', 'Referral from Client', 'LinkedIn', 'Bar Association', 'Legal Directory', 'Social Media', 'Other']}
                      placeholder="How did they find us?"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-8">
                  <button
                    onClick={() => setActiveSection('case')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                    style={{ background: brand.green, color: '#fff' }}
                  >
                    Next: Case Background
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── Section: Case Background ── */}
            {activeSection === 'case' && (
              <div className="rounded-2xl p-6 md:p-8" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
                <SectionHeader icon="⚖️" title="Case Background" subtitle="Details about the legal matter, parties involved, and current stage." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <FieldLabel required>Service Type</FieldLabel>
                    <SelectField value={form.caseType} onChange={(v) => setField('caseType', v)} options={CASE_TYPES} placeholder="Select service type" error={errors.caseType} />
                  </div>
                  <div>
                    <FieldLabel>Case Stage</FieldLabel>
                    <SelectField value={form.caseStage} onChange={(v) => setField('caseStage', v)} options={CASE_STAGES} placeholder="Select current stage" />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Case Title / Matter Name</FieldLabel>
                    <InputField value={form.caseTitle} onChange={(v) => setField('caseTitle', v)} placeholder="e.g. Smith v. Jones — Contract Dispute" />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel required>Case Description</FieldLabel>
                    <TextareaField
                      value={form.caseDescription}
                      onChange={(v) => setField('caseDescription', v)}
                      placeholder="Describe the legal matter, key facts, what assistance is needed, and any relevant background..."
                      rows={5}
                      error={errors.caseDescription}
                    />
                    <p className="text-xs mt-1.5" style={{ color: brand.muted }}>{form.caseDescription.length} characters</p>
                  </div>
                  <div>
                    <FieldLabel>Opposing Party</FieldLabel>
                    <InputField value={form.opposingParty} onChange={(v) => setField('opposingParty', v)} placeholder="Name of opposing party" />
                  </div>
                  <div>
                    <FieldLabel>Jurisdiction</FieldLabel>
                    <InputField value={form.jurisdiction} onChange={(v) => setField('jurisdiction', v)} placeholder="e.g. Louisiana, Eastern District" />
                  </div>
                  <div>
                    <FieldLabel>Court Name</FieldLabel>
                    <InputField value={form.courtName} onChange={(v) => setField('courtName', v)} placeholder="e.g. Orleans Parish Civil District Court" />
                  </div>
                  <div>
                    <FieldLabel>Case / Docket Number</FieldLabel>
                    <InputField value={form.caseNumber} onChange={(v) => setField('caseNumber', v)} placeholder="e.g. 2024-CV-00123" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-8">
                  <button onClick={() => setActiveSection('client')} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-80" style={{ color: brand.muted, border: `1px solid ${brand.border}` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back
                  </button>
                  <button onClick={() => setActiveSection('timeline')} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90" style={{ background: brand.green, color: '#fff' }}>
                    Next: Timeline
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── Section: Timeline ── */}
            {activeSection === 'timeline' && (
              <div className="rounded-2xl p-6 md:p-8" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
                <SectionHeader icon="📅" title="Timeline" subtitle="Key dates and deadlines that will be added to the case timeline automatically." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <FieldLabel>Filing Deadline</FieldLabel>
                    <InputField type="date" value={form.filingDeadline} onChange={(v) => setField('filingDeadline', v)} />
                    <p className="text-xs mt-1" style={{ color: brand.muted }}>Statute of limitations or court filing deadline</p>
                  </div>
                  <div>
                    <FieldLabel>Hearing Date</FieldLabel>
                    <InputField type="date" value={form.hearingDate} onChange={(v) => setField('hearingDate', v)} />
                    <p className="text-xs mt-1" style={{ color: brand.muted }}>Scheduled hearing or motion date</p>
                  </div>
                  <div>
                    <FieldLabel>Trial Date</FieldLabel>
                    <InputField type="date" value={form.trialDate} onChange={(v) => setField('trialDate', v)} />
                    <p className="text-xs mt-1" style={{ color: brand.muted }}>Confirmed trial start date if applicable</p>
                  </div>
                  <div>
                    <FieldLabel>Retainer Start Date</FieldLabel>
                    <InputField type="date" value={form.retainerStartDate} onChange={(v) => setField('retainerStartDate', v)} />
                    <p className="text-xs mt-1" style={{ color: brand.muted }}>When engagement is expected to begin</p>
                  </div>
                </div>

                {/* Timeline preview */}
                {(form.filingDeadline || form.hearingDate || form.trialDate || form.retainerStartDate) && (
                  <div className="mt-6 rounded-xl p-5" style={{ background: brand.greenLight, border: `1px solid rgba(53,94,59,0.2)` }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: brand.green }}>Timeline Preview</p>
                    <div className="space-y-3">
                      {[
                        { label: 'Retainer Start', date: form.retainerStartDate, icon: '📋' },
                        { label: 'Filing Deadline', date: form.filingDeadline, icon: '📁' },
                        { label: 'Hearing Date', date: form.hearingDate, icon: '🏛️' },
                        { label: 'Trial Date', date: form.trialDate, icon: '⚖️' },
                      ]
                        .filter((e) => e.date)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map(({ label, date, icon }) => (
                          <div key={label} className="flex items-center gap-3">
                            <span className="text-base">{icon}</span>
                            <div className="flex-1 flex items-center justify-between gap-4">
                              <span className="text-sm font-semibold" style={{ color: brand.foreground }}>{label}</span>
                              <span className="text-sm" style={{ color: brand.muted }}>
                                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-8">
                  <button onClick={() => setActiveSection('case')} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-80" style={{ color: brand.muted, border: `1px solid ${brand.border}` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back
                  </button>
                  <button onClick={() => setActiveSection('urgency')} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90" style={{ background: brand.green, color: '#fff' }}>
                    Next: Urgency & Notes
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── Section: Urgency & Notes ── */}
            {activeSection === 'urgency' && (
              <div className="rounded-2xl p-6 md:p-8" style={{ background: '#fff', border: `1px solid ${brand.border}` }}>
                <SectionHeader icon="🎯" title="Urgency & Notes" subtitle="Set the priority level, budget, and any internal notes for this matter." />

                {/* Urgency selector */}
                <div className="mb-6">
                  <FieldLabel>Urgency Level</FieldLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                    {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setField('urgency', key)}
                        className="p-4 rounded-xl text-left transition-all duration-200"
                        style={
                          form.urgency === key
                            ? { background: cfg.bg, border: `2px solid ${cfg.color}` }
                            : { background: brand.bg, border: `1px solid ${brand.border}` }
                        }
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{cfg.icon}</span>
                          <span className="text-sm font-bold" style={{ color: form.urgency === key ? cfg.color : brand.foreground }}>{cfg.label}</span>
                        </div>
                        <p className="text-xs" style={{ color: brand.muted }}>{cfg.timeframe}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div className="mb-5">
                  <FieldLabel>Budget / Retainer Tier</FieldLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {BUDGET_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setField('budget', opt.value)}
                        className="px-3 py-2.5 rounded-xl text-xs font-semibold text-center transition-all duration-200"
                        style={
                          form.budget === opt.value
                            ? { background: brand.accentLight, border: `1.5px solid ${brand.accent}`, color: brand.accent }
                            : { background: brand.bg, border: `1px solid ${brand.border}`, color: brand.muted }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="mb-5">
                  <FieldLabel>Internal Notes</FieldLabel>
                  <TextareaField
                    value={form.internalNotes}
                    onChange={(v) => setField('internalNotes', v)}
                    placeholder="Notes visible only to Maggi May — conflicts check, special instructions, referral context, etc."
                    rows={4}
                  />
                </div>

                {/* Error */}
                {submitError && (
                  <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(184,92,56,0.08)', border: '1px solid rgba(184,92,56,0.3)' }}>
                    <p className="text-sm" style={{ color: '#B85C38' }}>{submitError}</p>
                  </div>
                )}

                {/* Review summary */}
                <div className="rounded-xl p-5 mb-6" style={{ background: brand.secondary, border: `1px solid ${brand.border}` }}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: brand.muted }}>Submission Preview</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {[
                      { label: 'Client', value: form.clientName || '—' },
                      { label: 'Email', value: form.clientEmail || '—' },
                      { label: 'Service', value: form.caseType || '—' },
                      { label: 'Stage', value: form.caseStage || '—' },
                      { label: 'Urgency', value: urgencyCfg.label },
                      { label: 'Budget', value: BUDGET_OPTIONS.find((b) => b.value === form.budget)?.label || '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs uppercase tracking-wider" style={{ color: brand.muted }}>{label}</p>
                        <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: brand.foreground }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={() => setActiveSection('timeline')} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-80" style={{ color: brand.muted, border: `1px solid ${brand.border}` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: brand.primary, color: '#FAF7F2' }}
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                        Submitting…
                      </>
                    ) : (
                      <>
                        Submit Intake & Notify Client
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
