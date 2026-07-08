'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { trackPortalFormSubmit } from '@/lib/analytics';
import { logPortalEvent } from '@/lib/portalEventLogger';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'radio' | 'checkbox' | 'number';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  helpText?: string;
}

// ── Service Questionnaires ─────────────────────────────────────────────────────

const SERVICE_QUESTIONNAIRES: Record<string, { title: string; description: string; icon: string; questions: Question[] }> = {
  'Business Law & Contracts': {
    title: 'Business Law Intake',
    description: 'Tell us about your business legal matter so we can prepare for your consultation.',
    icon: '🏢',
    questions: [
      { id: 'business_name', label: 'Business Name', type: 'text', placeholder: 'Your company or entity name', required: true },
      { id: 'business_type', label: 'Business Type', type: 'select', options: ['LLC', 'Corporation', 'S-Corp', 'Partnership', 'Sole Proprietorship', 'Non-Profit', 'Other'], required: true },
      { id: 'years_in_business', label: 'Years in Business', type: 'select', options: ['Pre-launch / Startup', 'Less than 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years'] },
      { id: 'matter_type', label: 'Type of Matter', type: 'select', options: ['Contract Drafting', 'Contract Review', 'Business Formation', 'Partnership Dispute', 'Vendor Agreement', 'NDA / Confidentiality', 'Operating Agreement', 'Buy-Sell Agreement', 'Business Acquisition', 'Franchise Agreement', 'Other'], required: true },
      { id: 'description', label: 'Describe Your Legal Need', type: 'textarea', placeholder: 'Provide as much detail as possible about your situation, including any relevant background, parties involved, and what outcome you are seeking…', required: true },
      { id: 'contract_value', label: 'Approximate Contract / Deal Value', type: 'select', options: ['Under $10,000', '$10,000 – $50,000', '$50,000 – $250,000', '$250,000 – $1M', 'Over $1M', 'Not applicable'] },
      { id: 'timeline', label: 'Is There a Deadline?', type: 'date', helpText: 'Leave blank if no specific deadline' },
      { id: 'prior_counsel', label: 'Have you worked with an attorney on this before?', type: 'radio', options: ['Yes', 'No'] },
      { id: 'prior_counsel_details', label: 'If yes, briefly describe prior representation', type: 'textarea', placeholder: 'Name of prior firm, what was done, why you are seeking new counsel…' },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
  'Employment Law': {
    title: 'Employment Law Intake',
    description: 'Help us understand your employment matter.',
    icon: '👔',
    questions: [
      { id: 'employer_name', label: 'Employer / Company Name', type: 'text', placeholder: 'Name of the employer involved', required: true },
      { id: 'employer_size', label: 'Approximate Number of Employees', type: 'select', options: ['1–10', '11–50', '51–250', '251–1,000', '1,000+', 'Unknown'] },
      { id: 'employment_status', label: 'Your Employment Status', type: 'select', options: ['Current Employee', 'Former Employee', 'Independent Contractor', 'Job Applicant', 'Other'], required: true },
      { id: 'employment_duration', label: 'How Long Were / Are You Employed?', type: 'select', options: ['Less than 6 months', '6 months – 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years'] },
      { id: 'issue_type', label: 'Type of Issue', type: 'select', options: ['Wrongful Termination', 'Discrimination (Race/Gender/Age/Disability)', 'Sexual Harassment', 'Hostile Work Environment', 'Wage & Hour Dispute', 'Unpaid Overtime', 'Non-Compete Agreement', 'Severance Review', 'Retaliation', 'FMLA / Leave Issues', 'Other'], required: true },
      { id: 'incident_date', label: 'When Did the Issue Occur?', type: 'date' },
      { id: 'description', label: 'Describe What Happened', type: 'textarea', placeholder: 'Provide a detailed account of the events, including dates, names of individuals involved, and any witnesses…', required: true },
      { id: 'documentation', label: 'Do You Have Supporting Documentation?', type: 'radio', options: ['Yes — emails, texts, HR records', 'Yes — partial documentation', 'No documentation yet'] },
      { id: 'eeoc_filed', label: 'Have you filed an EEOC complaint?', type: 'radio', options: ['Yes', 'No', 'Not Applicable'] },
      { id: 'damages_sought', label: 'What Outcome Are You Seeking?', type: 'select', options: ['Monetary damages', 'Reinstatement', 'Policy change', 'Settlement', 'Not sure yet'] },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
  'Real Estate Law': {
    title: 'Real Estate Law Intake',
    description: 'Tell us about your real estate legal matter.',
    icon: '🏠',
    questions: [
      { id: 'property_address', label: 'Property Address', type: 'text', placeholder: 'Address of the property involved', required: true },
      { id: 'property_type', label: 'Property Type', type: 'select', options: ['Single-Family Residential', 'Multi-Family Residential', 'Commercial', 'Industrial', 'Land/Lot', 'Mixed-Use', 'Other'], required: true },
      { id: 'property_value', label: 'Approximate Property Value', type: 'select', options: ['Under $100,000', '$100,000 – $300,000', '$300,000 – $750,000', '$750,000 – $2M', 'Over $2M', 'Unknown'] },
      { id: 'matter_type', label: 'Type of Matter', type: 'select', options: ['Purchase / Sale', 'Lease Drafting', 'Lease Review', 'Landlord-Tenant Dispute', 'Title Issue', 'Boundary Dispute', 'Foreclosure Defense', 'Zoning / Permitting', 'Construction Dispute', 'HOA Issue', 'Other'], required: true },
      { id: 'closing_date', label: 'Closing Date (if applicable)', type: 'date' },
      { id: 'description', label: 'Describe Your Situation', type: 'textarea', placeholder: 'Explain the details of your real estate matter, including parties involved and any disputes or concerns…', required: true },
      { id: 'represented', label: 'Do you have a real estate agent?', type: 'radio', options: ['Yes', 'No'] },
      { id: 'lender_involved', label: 'Is a lender / mortgage involved?', type: 'radio', options: ['Yes', 'No', 'Cash transaction'] },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
  'Estate Planning': {
    title: 'Estate Planning Intake',
    description: 'Help us understand your estate planning needs.',
    icon: '📜',
    questions: [
      { id: 'marital_status', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed', 'Domestic Partnership', 'Separated'], required: true },
      { id: 'has_children', label: 'Do you have children?', type: 'radio', options: ['Yes — minor children', 'Yes — adult children', 'No'], required: true },
      { id: 'num_children', label: 'Number of Children / Dependents', type: 'number', placeholder: '0' },
      { id: 'services_needed', label: 'Services Needed', type: 'select', options: ['Last Will & Testament', 'Revocable Living Trust', 'Irrevocable Trust', 'Power of Attorney', 'Healthcare Directive / Living Will', 'Full Estate Plan Package', 'Estate Administration / Probate', 'Trust Administration', 'Other'], required: true },
      { id: 'estate_value', label: 'Approximate Estate Value', type: 'select', options: ['Under $100,000', '$100,000 – $500,000', '$500,000 – $1M', '$1M – $5M', 'Over $5M', 'Prefer not to say'] },
      { id: 'existing_docs', label: 'Do you have existing estate planning documents?', type: 'radio', options: ['Yes — need updating', 'Yes — need review only', 'No — starting fresh'] },
      { id: 'special_needs', label: 'Are there any special circumstances?', type: 'select', options: ['Special needs beneficiary', 'Blended family', 'Business ownership', 'Real estate in multiple states', 'International assets', 'None', 'Other'] },
      { id: 'description', label: 'Additional Details', type: 'textarea', placeholder: 'Any specific concerns, assets, family circumstances, or goals to note…' },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
  'Litigation Support': {
    title: 'Litigation Support Intake',
    description: 'Tell us about your litigation matter.',
    icon: '⚖️',
    questions: [
      { id: 'case_name', label: 'Case Name / Caption', type: 'text', placeholder: 'e.g. Smith v. Jones', required: true },
      { id: 'court', label: 'Court / Jurisdiction', type: 'text', placeholder: 'e.g. Eastern District of Louisiana', required: true },
      { id: 'case_number', label: 'Case Number (if filed)', type: 'text', placeholder: 'Docket or case number' },
      { id: 'case_type', label: 'Type of Case', type: 'select', options: ['Civil Litigation', 'Commercial Dispute', 'Contract Dispute', 'Personal Injury', 'Business Tort', 'Class Action', 'Arbitration', 'Mediation', 'Other'] },
      { id: 'stage', label: 'Current Stage', type: 'select', options: ['Pre-Litigation / Demand Letter', 'Pleadings Filed', 'Discovery', 'Motion Practice', 'Trial Preparation', 'Trial', 'Post-Trial / Appeal', 'Settlement Negotiations'], required: true },
      { id: 'next_deadline', label: 'Next Deadline', type: 'date' },
      { id: 'opposing_party', label: 'Opposing Party / Counsel', type: 'text', placeholder: 'Name of opposing party and/or their attorney' },
      { id: 'damages_amount', label: 'Approximate Amount in Controversy', type: 'select', options: ['Under $25,000', '$25,000 – $100,000', '$100,000 – $500,000', '$500,000 – $1M', 'Over $1M', 'Non-monetary relief'] },
      { id: 'description', label: 'Describe the Matter', type: 'textarea', placeholder: 'Summarize the dispute, parties involved, key facts, and what you need from us…', required: true },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
  'Legal Research': {
    title: 'Legal Research Intake',
    description: 'Tell us about your research request.',
    icon: '🔍',
    questions: [
      { id: 'research_topic', label: 'Research Topic', type: 'text', placeholder: 'Brief description of the legal issue', required: true },
      { id: 'jurisdiction', label: 'Jurisdiction', type: 'text', placeholder: 'e.g. Louisiana, Federal, 5th Circuit', required: true },
      { id: 'practice_area', label: 'Practice Area', type: 'select', options: ['Contract Law', 'Employment Law', 'Real Estate', 'Corporate Law', 'Civil Procedure', 'Constitutional Law', 'Administrative Law', 'Tax Law', 'Other'] },
      { id: 'deliverable', label: 'Deliverable Needed', type: 'select', options: ['Research Memo', 'Case Summary', 'Statute Analysis', 'Regulatory Review', 'Brief Support', 'Deposition Prep', 'Other'], required: true },
      { id: 'deadline', label: 'Deadline', type: 'date', required: true },
      { id: 'description', label: 'Detailed Research Question', type: 'textarea', placeholder: 'Provide the specific legal questions you need answered, relevant facts, and any cases or statutes you are already aware of…', required: true },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
  'Immigration Law': {
    title: 'Immigration Law Intake',
    description: 'Tell us about your immigration matter.',
    icon: '🌍',
    questions: [
      { id: 'nationality', label: 'Country of Citizenship', type: 'text', placeholder: 'Your country of citizenship', required: true },
      { id: 'current_status', label: 'Current Immigration Status', type: 'select', options: ['US Citizen', 'Lawful Permanent Resident (Green Card)', 'Visa Holder (specify below)', 'Undocumented', 'Asylum Seeker', 'DACA Recipient', 'Other'], required: true },
      { id: 'matter_type', label: 'Type of Matter', type: 'select', options: ['Family-Based Immigration', 'Employment-Based Immigration', 'Naturalization / Citizenship', 'Green Card Application', 'Visa Application / Extension', 'Deportation Defense', 'Asylum Application', 'DACA Renewal', 'Other'], required: true },
      { id: 'description', label: 'Describe Your Situation', type: 'textarea', placeholder: 'Provide details about your immigration history, current situation, and what you are seeking…', required: true },
      { id: 'deadline', label: 'Is There a Deadline or Hearing Date?', type: 'date' },
      { id: 'prior_applications', label: 'Have you previously filed any immigration applications?', type: 'radio', options: ['Yes', 'No'] },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
  'Intellectual Property': {
    title: 'Intellectual Property Intake',
    description: 'Tell us about your IP matter.',
    icon: '💡',
    questions: [
      { id: 'ip_type', label: 'Type of Intellectual Property', type: 'select', options: ['Trademark', 'Copyright', 'Patent', 'Trade Secret', 'Licensing Agreement', 'IP Infringement', 'Other'], required: true },
      { id: 'matter_type', label: 'Type of Matter', type: 'select', options: ['Registration / Application', 'Infringement Claim', 'Defense Against Infringement', 'Licensing / Assignment', 'Portfolio Review', 'DMCA Takedown', 'Other'], required: true },
      { id: 'description', label: 'Describe Your IP and the Issue', type: 'textarea', placeholder: 'Describe the intellectual property involved, how it was created, and the legal issue you are facing…', required: true },
      { id: 'registration_status', label: 'Is the IP Currently Registered?', type: 'radio', options: ['Yes — registered', 'Pending registration', 'No — not yet registered', 'Not applicable'] },
      { id: 'deadline', label: 'Is There a Deadline?', type: 'date' },
      { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio', options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
    ],
  },
};

const DEFAULT_QUESTIONNAIRE = {
  title: 'General Legal Intake',
  description: 'Tell us about your legal matter.',
  icon: '⚖️',
  questions: [
    { id: 'matter_type', label: 'Type of Legal Matter', type: 'text' as const, placeholder: 'Briefly describe the type of legal issue', required: true },
    { id: 'description', label: 'Describe Your Situation', type: 'textarea' as const, placeholder: 'Provide as much detail as possible…', required: true },
    { id: 'deadline', label: 'Is There a Deadline?', type: 'date' as const },
    { id: 'prior_counsel', label: 'Have you worked with an attorney on this before?', type: 'radio' as const, options: ['Yes', 'No'] },
    { id: 'urgency', label: 'How Urgent Is This Matter?', type: 'radio' as const, options: ['Immediate (within 48 hours)', 'Urgent (within 1 week)', 'Standard (within 2–4 weeks)', 'Planning ahead (1+ month)'], required: true },
  ],
};

// ── Common Additional Questions (appended to all questionnaires) ───────────────

const COMMON_QUESTIONS: Question[] = [
  {
    id: 'budget_range',
    label: 'Approximate Budget for Legal Services',
    type: 'select',
    options: ['Under $1,000', '$1,000 – $3,000', '$3,000 – $7,500', '$7,500 – $15,000', '$15,000 – $50,000', 'Over $50,000', 'Unsure / Need guidance'],
    helpText: 'This helps us recommend the right service package for your needs.',
  },
  {
    id: 'preferred_contact',
    label: 'Preferred Communication Method',
    type: 'radio',
    options: ['Email', 'Phone Call', 'Text / SMS', 'Video Call', 'In-Person Meeting'],
    required: true,
  },
  {
    id: 'best_time',
    label: 'Best Time to Reach You',
    type: 'select',
    options: ['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–8pm)', 'Flexible / Anytime'],
  },
  {
    id: 'how_heard',
    label: 'How Did You Hear About Us?',
    type: 'select',
    options: ['Google Search', 'Referral from Friend / Family', 'Referral from Another Attorney', 'Social Media', 'LinkedIn', 'Bar Association Referral', 'Previous Client', 'Other'],
  },
  {
    id: 'additional_notes',
    label: 'Anything Else You Would Like Us to Know?',
    type: 'textarea',
    placeholder: 'Any additional context, concerns, or questions before your consultation…',
  },
];

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientIntakePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [step, setStep] = useState<'service' | 'questions' | 'additional'>('service');
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

  const handleServiceSelect = (svc: string) => {
    setServiceType(svc);
    setAnswers({});
    setError('');
    setStep('questions');
  };

  const handleNextToAdditional = () => {
    const q = questionnaire;
    if (!q) return;
    const required = q.questions.filter(q => q.required) || [];
    const missing = required.filter(q => !answers[q.id]?.trim());
    if (missing.length > 0) { setError(`Please complete: ${missing.map(q => q.label).join(', ')}`); return; }
    setError('');
    setStep('additional');
  };

  const handleSubmit = async () => {
    const requiredCommon = COMMON_QUESTIONS.filter(q => q.required);
    const missingCommon = requiredCommon.filter(q => !answers[q.id]?.trim());
    if (missingCommon.length > 0) { setError(`Please complete: ${missingCommon.map(q => q.label).join(', ')}`); return; }

    setSubmitting(true);
    setError('');
    try {
      const caseData = {
        service: serviceType,
        status: 'new',
        name: clientName,
        email: user?.email || '',
        message: answers.description || Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n'),
        notes: JSON.stringify({ source: 'client_intake_questionnaire', service_type: serviceType, answers }),
      };

      const { data: inquiry, error: inqErr } = await supabase
        .from('contact_inquiries')
        .insert(caseData)
        .select()
        .single();

      if (inqErr) throw inqErr;

      await supabase.from('intake_submissions').insert({
        inquiry_id: inquiry.id,
        form_type: 'client_portal_questionnaire',
        service_type: serviceType,
        form_data: answers,
        submitted_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});

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

  const renderQuestion = (q: Question) => (
    <div key={q.id}>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: brand.muted }}>
        {q.label}{q.required && <span className="ml-1" style={{ color: brand.accent }}>*</span>}
      </label>
      {q.helpText && <p className="text-xs mb-2" style={{ color: brand.muted }}>{q.helpText}</p>}

      {q.type === 'text' && (
        <input type="text" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
          placeholder={q.placeholder}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
          style={{ background: brand.bg, border: `1px solid ${brand.border}`, color: brand.foreground }} />
      )}

      {q.type === 'number' && (
        <input type="number" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
          placeholder={q.placeholder} min="0"
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
        <div className="flex gap-2 flex-wrap">
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
  );

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
              <Link href="/portal/cases" className="px-6 py-3 rounded-full text-sm font-semibold uppercase tracking-widest border transition-all" style={{ borderColor: brand.border, color: brand.foreground }}>
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
        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(['service', 'questions', 'additional'] as const).map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s ? 'text-white' : ((['service', 'questions', 'additional'].indexOf(step) > i) ? 'text-white' : 'text-muted-foreground border border-border bg-white')}`}
                  style={step === s || (['service', 'questions', 'additional'].indexOf(step) > i) ? { background: brand.primary } : {}}>
                  {['service', 'questions', 'additional'].indexOf(step) > i ? '✓' : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: step === s ? brand.foreground : brand.muted }}>
                  {s === 'service' ? 'Service Type' : s === 'questions' ? 'Matter Details' : 'Final Details'}
                </span>
              </div>
              {i < 2 && <div className="flex-1 h-px" style={{ background: brand.border }} />}
            </React.Fragment>
          ))}
        </div>

        <div className="mb-8">
          <h1 className="font-serif text-3xl mb-2" style={{ color: brand.foreground }}>New Matter Intake</h1>
          <p className="text-base" style={{ color: brand.muted }}>
            Complete this questionnaire to open a new matter. Your answers will auto-populate your case record.
          </p>
        </div>

        {/* ── STEP 1: Service Type ── */}
        {step === 'service' && (
          <div className="rounded-2xl border p-6" style={{ borderColor: brand.border, background: '#fff' }}>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: brand.muted }}>
              Select Service Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(SERVICE_QUESTIONNAIRES).map(([svc, config]) => (
                <button key={svc} onClick={() => handleServiceSelect(svc)}
                  className="px-4 py-3.5 rounded-xl text-left transition-all flex items-center gap-3"
                  style={serviceType === svc
                    ? { background: 'rgba(53,94,59,0.08)', border: `2px solid ${brand.green}`, color: brand.green }
                    : { background: brand.bg, border: `1px solid ${brand.border}`, color: brand.muted }}>
                  <span className="text-xl">{config.icon}</span>
                  <span className="text-sm font-semibold">{svc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Matter Questions ── */}
        {step === 'questions' && questionnaire && (
          <>
            <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: brand.border, background: '#fff' }}>
              <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: `1px solid ${brand.border}` }}>
                <span className="text-2xl">{questionnaire.icon}</span>
                <div>
                  <h2 className="font-serif text-xl" style={{ color: brand.foreground }}>{questionnaire.title}</h2>
                  <p className="text-sm" style={{ color: brand.muted }}>{questionnaire.description}</p>
                </div>
              </div>
              <div className="space-y-5">
                {questionnaire.questions.map(q => renderQuestion(q))}
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl mb-4 text-sm" style={{ background: 'rgba(184,92,56,0.08)', border: '1px solid rgba(184,92,56,0.3)', color: '#B85C38' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep('service'); setError(''); }}
                className="px-6 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest border transition-all"
                style={{ borderColor: brand.border, color: brand.muted }}>
                ← Back
              </button>
              <button onClick={handleNextToAdditional}
                className="flex-1 py-3.5 rounded-xl text-white text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90"
                style={{ background: brand.primary }}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Additional / Common Questions ── */}
        {step === 'additional' && (
          <>
            <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: brand.border, background: '#fff' }}>
              <div className="mb-5 pb-4" style={{ borderBottom: `1px solid ${brand.border}` }}>
                <h2 className="font-serif text-xl mb-1" style={{ color: brand.foreground }}>Final Details</h2>
                <p className="text-sm" style={{ color: brand.muted }}>A few more questions to help us serve you better.</p>
              </div>
              <div className="space-y-5">
                {COMMON_QUESTIONS.map(q => renderQuestion(q))}
              </div>
            </div>

            {/* Summary Card */}
            <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: brand.border, background: 'rgba(53,94,59,0.04)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: brand.muted }}>Intake Summary</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs" style={{ color: brand.muted }}>Service Type</p>
                  <p className="font-semibold" style={{ color: brand.foreground }}>{serviceType}</p>
                </div>
                {answers.urgency && (
                  <div>
                    <p className="text-xs" style={{ color: brand.muted }}>Urgency</p>
                    <p className="font-semibold" style={{ color: brand.foreground }}>{answers.urgency.split(' (')[0]}</p>
                  </div>
                )}
                {answers.budget_range && (
                  <div>
                    <p className="text-xs" style={{ color: brand.muted }}>Budget Range</p>
                    <p className="font-semibold" style={{ color: brand.foreground }}>{answers.budget_range}</p>
                  </div>
                )}
                {answers.preferred_contact && (
                  <div>
                    <p className="text-xs" style={{ color: brand.muted }}>Preferred Contact</p>
                    <p className="font-semibold" style={{ color: brand.foreground }}>{answers.preferred_contact}</p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl mb-4 text-sm" style={{ background: 'rgba(184,92,56,0.08)', border: '1px solid rgba(184,92,56,0.3)', color: '#B85C38' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep('questions'); setError(''); }}
                className="px-6 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest border transition-all"
                style={{ borderColor: brand.border, color: brand.muted }}>
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3.5 rounded-xl text-white text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: brand.primary }}>
                {submitting ? (
                  <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Submitting…</>
                ) : 'Submit Intake Questionnaire ✓'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
