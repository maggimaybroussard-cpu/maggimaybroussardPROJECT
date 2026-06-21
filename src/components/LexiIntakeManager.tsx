'use client';

import React, { useState, useEffect } from 'react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type IntakeStep = 'form' | 'reviewing' | 'results';
type MatterType = 'personal_injury' | 'business_law' | 'employment_law' | 'real_estate' | 'estate_planning' | 'contract_dispute' | 'other';

interface IntakeLead {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  matterType: MatterType;
  dateOfIncident: string;
  description: string;
  solDeadline?: string;
  solDaysRemaining?: number;
  conflictCheckStatus?: 'pending' | 'clear' | 'conflict';
  conflictNotes?: string;
  followUpEmailDraft?: string;
  status: 'new' | 'reviewed' | 'engaged' | 'disqualified';
  disqualificationReason?: string;
}

interface ReviewResult {
  solDeadline: string;
  solDaysRemaining: number;
  solExpired: boolean;
  conflictStatus: 'clear' | 'conflict' | 'unknown';
  conflictNotes: string;
  followUpEmail: string;
  followUpSubject: string;
  recommendation: string;
  disqualified: boolean;
  disqualificationReason: string;
}

const MATTER_TYPES: Array<{ id: MatterType; label: string; icon: string; prescriptionYears: number; statute: string }> = [
  { id: 'personal_injury', label: 'Personal Injury', icon: '🏥', prescriptionYears: 1, statute: 'La. Civ. Code art. 3492' },
  { id: 'business_law', label: 'Business Law', icon: '🏢', prescriptionYears: 10, statute: 'La. Civ. Code art. 3499' },
  { id: 'employment_law', label: 'Employment Law', icon: '👔', prescriptionYears: 1, statute: 'Title VII / 42 U.S.C. § 2000e-5(e)' },
  { id: 'real_estate', label: 'Real Estate', icon: '🏠', prescriptionYears: 10, statute: 'La. Civ. Code art. 3499' },
  { id: 'estate_planning', label: 'Estate Planning', icon: '📜', prescriptionYears: 10, statute: 'La. Civ. Code art. 3499' },
  { id: 'contract_dispute', label: 'Contract Dispute', icon: '📋', prescriptionYears: 10, statute: 'La. Civ. Code art. 3499' },
  { id: 'other', label: 'Other', icon: '⚖️', prescriptionYears: 1, statute: 'Consult attorney' },
];

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LexiIntakeManager() {
  const [step, setStep] = useState<IntakeStep>('form');
  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [currentLead, setCurrentLead] = useState<IntakeLead | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const [form, setForm] = useState<IntakeLead>({
    fullName: '',
    email: '',
    phone: '',
    matterType: 'personal_injury',
    dateOfIncident: '',
    description: '',
    status: 'new',
  });

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('lexi_intake_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setLeads(data.map(d => ({
        id: d.id,
        fullName: d.full_name,
        email: d.email || '',
        phone: d.phone || '',
        matterType: d.matter_type as MatterType,
        dateOfIncident: d.date_of_incident || '',
        description: d.description || '',
        solDeadline: d.sol_deadline,
        solDaysRemaining: d.sol_days_remaining,
        conflictCheckStatus: d.conflict_check_status,
        conflictNotes: d.conflict_notes,
        followUpEmailDraft: d.follow_up_email_drafted,
        status: d.status,
        disqualificationReason: d.disqualification_reason,
      })));
    }
  };

  const reviewLead = async () => {
    if (!form.fullName || !form.description) {
      toast.error('Please fill in name and description');
      return;
    }
    setIsReviewing(true);
    setStep('reviewing');
    setCurrentLead({ ...form });

    try {
      const matterConfig = MATTER_TYPES.find(m => m.id === form.matterType)!;

      // Calculate SOL
      let solDeadline = '';
      let solDaysRemaining = 9999;
      let solExpired = false;
      if (form.dateOfIncident) {
        solDeadline = addYears(form.dateOfIncident, matterConfig.prescriptionYears);
        solDaysRemaining = daysUntil(solDeadline);
        solExpired = solDaysRemaining < 0;
      }

      // Check conflicts via Supabase
      const supabase = createClient();
      let conflictStatus: 'clear' | 'conflict' | 'unknown' = 'unknown';
      let conflictNotes = '';

      if (form.fullName) {
        const { data: conflicts } = await supabase
          .from('contact_inquiries')
          .select('name, email, service, status')
          .ilike('name', `%${form.fullName.split(' ')[0]}%`)
          .limit(5);

        if (conflicts && conflicts.length > 0) {
          const existingMatch = conflicts.find(c =>
            c.name?.toLowerCase().includes(form.fullName.toLowerCase().split(' ')[0]) ||
            (form.email && c.email?.toLowerCase() === form.email.toLowerCase())
          );
          if (existingMatch) {
            conflictStatus = 'conflict';
            conflictNotes = `Existing record found: ${existingMatch.name} (${existingMatch.service || 'Unknown service'}) — Status: ${existingMatch.status || 'Unknown'}`;
          } else {
            conflictStatus = 'clear';
          }
        } else {
          conflictStatus = 'clear';
        }
      }

      // Generate follow-up email with Lexi
      const disqualified = solExpired || conflictStatus === 'conflict';
      const prompt = `You are Lexi, a professional legal secretary at Broussard Legal Services. Draft a follow-up email for a new intake submission.

INTAKE DETAILS:
- Name: ${form.fullName}
- Matter Type: ${matterConfig.label}
- Date of Incident: ${form.dateOfIncident ? formatDate(form.dateOfIncident) : 'Not provided'}
- Description: ${form.description}
- SOL Status: ${solExpired ? `EXPIRED (${Math.abs(solDaysRemaining)} days ago)` : solDeadline ? `${solDaysRemaining} days remaining (expires ${formatDate(solDeadline)})` : 'Not calculated'}
- Conflict Check: ${conflictStatus === 'conflict' ? `CONFLICT FOUND — ${conflictNotes}` : 'Clear'}

${disqualified ? `IMPORTANT: This matter should be DECLINED because: ${solExpired ? 'Statute of limitations has expired.' : ''} ${conflictStatus === 'conflict' ? 'Conflict of interest exists.' : ''}` : 'This matter appears eligible for representation.'}

Draft a professional, empathetic ${disqualified ? 'declination' : 'follow-up'} email that:
${disqualified ? `
1. Thanks the prospective client for reaching out
2. Professionally declines representation
3. ${solExpired ? 'Gently notes that the legal deadline may have passed and they should seek immediate counsel' : 'Notes that the firm cannot represent them due to a conflict of interest'}
4. Recommends they contact the Louisiana State Bar Referral Service at (504) 561-8828
5. Signs off warmly as "Lexi, on behalf of Broussard Legal Services"
` : `
1. Thanks them for submitting their intake
2. Confirms receipt and that an attorney will review their matter
3. Sets expectations for next steps (attorney review within 1-2 business days)
4. ${solDeadline && solDaysRemaining <= 60 ? `Notes urgency — their legal deadline is approaching (${solDaysRemaining} days)` : 'Provides reassurance about the process'}
5. Invites them to call or email with questions
6. Signs off as "Lexi, on behalf of Broussard Legal Services"
`}

Subject: ${disqualified ? `Re: Your Inquiry — Broussard Legal Services` : `Your Intake Received — Broussard Legal Services`}

Format: Subject: [subject]\n\n[email body]`;

      const emailResult = await getChatCompletion([{ role: 'user', content: prompt }], {
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 600,
      });

      const lines = (emailResult || '').split('\n');
      const subject = lines.find(l => l.startsWith('Subject:'))?.replace('Subject:', '').trim() || 'Re: Your Inquiry';
      const emailBody = lines.filter(l => !l.startsWith('Subject:')).join('\n').trim();

      const result: ReviewResult = {
        solDeadline,
        solDaysRemaining,
        solExpired,
        conflictStatus,
        conflictNotes,
        followUpEmail: emailBody,
        followUpSubject: subject,
        recommendation: disqualified
          ? (solExpired ? 'DECLINE — SOL expired' : 'DECLINE — Conflict of interest')
          : (solDaysRemaining <= 30 ? 'URGENT — Engage immediately (SOL < 30 days)' : 'ELIGIBLE — Schedule consultation'),
        disqualified,
        disqualificationReason: disqualified
          ? (solExpired ? 'Statute of limitations has expired' : 'Conflict of interest identified')
          : '',
      };

      setReviewResult(result);
      setStep('results');

      // Save to Supabase
      const supabase2 = createClient();
      await supabase2.from('lexi_intake_leads').insert({
        full_name: form.fullName,
        email: form.email,
        phone: form.phone,
        matter_type: form.matterType,
        date_of_incident: form.dateOfIncident || null,
        description: form.description,
        sol_deadline: solDeadline || null,
        sol_days_remaining: solDaysRemaining < 9999 ? solDaysRemaining : null,
        conflict_check_status: conflictStatus,
        conflict_notes: conflictNotes || null,
        follow_up_email_drafted: emailBody,
        status: disqualified ? 'disqualified' : 'new',
        disqualification_reason: result.disqualificationReason || null,
      });

      await loadLeads();
    } catch {
      toast.error('Review failed — please try again');
      setStep('form');
    } finally {
      setIsReviewing(false);
    }
  };

  const resetForm = () => {
    setForm({ fullName: '', email: '', phone: '', matterType: 'personal_injury', dateOfIncident: '', description: '', status: 'new' });
    setReviewResult(null);
    setCurrentLead(null);
    setStep('form');
    setShowForm(false);
  };

  const statusBadge = (lead: IntakeLead) => {
    if (lead.status === 'disqualified') return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold">DECLINED</span>;
    if (lead.status === 'engaged') return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-bold">ENGAGED</span>;
    if (lead.status === 'reviewed') return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-bold">REVIEWED</span>;
    return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold">NEW</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📥</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Intake & Lead Management</p>
              <p className="text-[10px] text-muted-foreground">Conflict check, SOL calculation, and auto-drafted follow-up</p>
            </div>
          </div>
          {!showForm && step === 'form' && (
            <button onClick={() => setShowForm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">+ New Intake</button>
          )}
          {(showForm || step !== 'form') && (
            <button onClick={resetForm} className="text-xs text-primary hover:underline">← Back to Leads</button>
          )}
        </div>
      </div>

      {/* Intake Form */}
      {(showForm || step === 'reviewing' || step === 'results') && step !== 'results' && step !== 'reviewing' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-[10px] text-primary font-semibold">📥 New Intake Submission</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Lexi will run a conflict check, calculate the SOL deadline, and draft a follow-up email automatically.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-foreground mb-1 block">Full Name <span className="text-red-500">*</span></label>
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="John A. Smith"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@email.com"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(504) 555-0100"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">Matter Type</label>
            <div className="grid grid-cols-2 gap-2">
              {MATTER_TYPES.map(mt => (
                <button key={mt.id} onClick={() => setForm(f => ({ ...f, matterType: mt.id }))}
                  className={`p-2 rounded-xl border text-left transition-all ${form.matterType === mt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{mt.icon}</span>
                    <div>
                      <p className="text-[10px] font-semibold text-foreground">{mt.label}</p>
                      <p className="text-[9px] text-muted-foreground">{mt.prescriptionYears}yr SOL</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Date of Incident / Key Event</label>
            <input type="date" value={form.dateOfIncident} onChange={e => setForm(f => ({ ...f, dateOfIncident: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {form.dateOfIncident && (
              <p className="text-[10px] text-muted-foreground mt-1">
                SOL Deadline: <span className="font-semibold text-foreground">
                  {formatDate(addYears(form.dateOfIncident, MATTER_TYPES.find(m => m.id === form.matterType)?.prescriptionYears || 1))}
                </span>
                {' '}({daysUntil(addYears(form.dateOfIncident, MATTER_TYPES.find(m => m.id === form.matterType)?.prescriptionYears || 1))} days)
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Matter Description <span className="text-red-500">*</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the situation in your own words — what happened, who is involved, and what outcome you are seeking..." rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>

          <button onClick={reviewLead} disabled={!form.fullName || !form.description}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            Run Lexi Review (Conflict Check + SOL + Draft Email) →
          </button>
        </div>
      )}

      {/* Reviewing */}
      {step === 'reviewing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Lexi is reviewing this intake…</p>
            <p className="text-xs text-muted-foreground mt-1">Running conflict check, calculating SOL, drafting follow-up email</p>
          </div>
        </div>
      )}

      {/* Results */}
      {step === 'results' && reviewResult && currentLead && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Recommendation banner */}
          <div className={`rounded-xl p-3 border ${reviewResult.disqualified ? 'bg-red-50 border-red-200' : reviewResult.solDaysRemaining <= 30 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <p className={`text-xs font-bold ${reviewResult.disqualified ? 'text-red-700' : reviewResult.solDaysRemaining <= 30 ? 'text-amber-700' : 'text-green-700'}`}>
              {reviewResult.disqualified ? '🚫' : reviewResult.solDaysRemaining <= 30 ? '🚨' : '✅'} {reviewResult.recommendation}
            </p>
            {reviewResult.disqualificationReason && <p className="text-[10px] text-red-600 mt-0.5">{reviewResult.disqualificationReason}</p>}
          </div>

          {/* SOL */}
          {reviewResult.solDeadline && (
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-xs font-semibold text-foreground mb-1">⏰ Prescription / SOL</p>
              <p className="text-xs text-foreground">Deadline: <span className="font-semibold">{formatDate(reviewResult.solDeadline)}</span></p>
              <p className={`text-xs mt-0.5 ${reviewResult.solExpired ? 'text-red-600 font-semibold' : reviewResult.solDaysRemaining <= 30 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                {reviewResult.solExpired ? `⚠️ EXPIRED ${Math.abs(reviewResult.solDaysRemaining)} days ago` : `${reviewResult.solDaysRemaining} days remaining`}
              </p>
            </div>
          )}

          {/* Conflict Check */}
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-xs font-semibold text-foreground mb-1">🔍 Conflict Check</p>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${reviewResult.conflictStatus === 'clear' ? 'bg-green-100 text-green-700' : reviewResult.conflictStatus === 'conflict' ? 'bg-red-100 text-red-700' : 'bg-secondary text-muted-foreground'}`}>
                {reviewResult.conflictStatus === 'clear' ? '✓ CLEAR' : reviewResult.conflictStatus === 'conflict' ? '⚠️ CONFLICT' : 'UNKNOWN'}
              </span>
              {reviewResult.conflictNotes && <p className="text-[10px] text-muted-foreground">{reviewResult.conflictNotes}</p>}
            </div>
          </div>

          {/* Follow-up Email */}
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">📧 Auto-Drafted Follow-up Email</p>
              <button onClick={() => { navigator.clipboard.writeText(`Subject: ${reviewResult.followUpSubject}\n\n${reviewResult.followUpEmail}`); toast.success('Copied!'); }}
                className="px-2 py-1 bg-secondary border border-border text-foreground rounded-lg text-[10px] font-semibold hover:bg-secondary/80">📋 Copy</button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-1">Subject: <span className="font-semibold text-foreground">{reviewResult.followUpSubject}</span></p>
            <p className="text-[10px] text-foreground leading-relaxed whitespace-pre-wrap">{reviewResult.followUpEmail}</p>
          </div>

          <button onClick={resetForm} className="w-full py-2.5 bg-secondary border border-border text-foreground rounded-xl text-xs font-semibold hover:bg-secondary/80 transition-colors">
            ← Back to Intake List
          </button>
        </div>
      )}

      {/* Lead List */}
      {!showForm && step === 'form' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-3xl mb-2">📥</span>
              <p className="text-sm font-semibold text-foreground">No intake leads yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "+ New Intake" to process a lead</p>
            </div>
          ) : (
            leads.map(lead => (
              <div key={lead.id} className="p-3 bg-card border border-border rounded-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {statusBadge(lead)}
                      <p className="text-xs font-semibold text-foreground truncate">{lead.fullName}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{MATTER_TYPES.find(m => m.id === lead.matterType)?.label || lead.matterType}</p>
                    {lead.solDeadline && (
                      <p className={`text-[10px] mt-0.5 ${(lead.solDaysRemaining || 0) < 0 ? 'text-red-600 font-semibold' : (lead.solDaysRemaining || 0) <= 30 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                        SOL: {formatDate(lead.solDeadline)} ({(lead.solDaysRemaining || 0) < 0 ? 'EXPIRED' : `${lead.solDaysRemaining}d`})
                      </p>
                    )}
                    {lead.conflictCheckStatus === 'conflict' && (
                      <p className="text-[10px] text-red-600 font-semibold mt-0.5">⚠️ Conflict detected</p>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground shrink-0">{lead.email}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
