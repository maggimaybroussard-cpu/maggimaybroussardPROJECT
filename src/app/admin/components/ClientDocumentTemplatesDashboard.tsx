'use client';

import React, { useState, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateCategory = 'retainer' | 'engagement' | 'case_summary';

interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'date' | 'textarea' | 'select';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface DocumentTemplate {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  estimatedTime: string;
  fields: TemplateField[];
  bodyFn: (values: Record<string, string>) => string;
}

type WorkflowStep = 'select' | 'fill' | 'review' | 'sign' | 'complete';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#355E3B';

const CATEGORY_META: Record<TemplateCategory, { label: string; color: string; bg: string; border: string; badge: string; icon: React.ReactNode }> = {
  retainer: {
    label: 'Retainer Agreement',
    color: '#7c3aed',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  engagement: {
    label: 'Engagement Letter',
    color: '#0369a1',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  case_summary: {
    label: 'Case Summary',
    color: '#b45309',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
};

const PRACTICE_AREAS = [
  'Business Law',
  'Contract Review',
  'Employment Law',
  'Estate Planning',
  'Family Law',
  'Immigration',
  'Intellectual Property',
  'Litigation',
  'Real Estate',
  'Other',
];

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: DocumentTemplate[] = [
  {
    id: 'retainer-standard',
    category: 'retainer',
    title: 'Standard Retainer Agreement',
    description: 'Monthly retainer with defined scope, hours, and billing terms.',
    estimatedTime: '3 min',
    fields: [
      { key: 'clientName', label: 'Client Full Name', type: 'text', placeholder: 'Jane Smith', required: true },
      { key: 'clientEmail', label: 'Client Email', type: 'email', placeholder: 'jane@example.com', required: true },
      { key: 'firmName', label: 'Company / Firm Name', type: 'text', placeholder: 'Acme Corp' },
      { key: 'practiceArea', label: 'Practice Area', type: 'select', options: PRACTICE_AREAS, required: true },
      { key: 'retainerAmount', label: 'Monthly Retainer Fee ($)', type: 'text', placeholder: '2,500', required: true },
      { key: 'includedHours', label: 'Included Hours / Month', type: 'text', placeholder: '10', required: true },
      { key: 'overage', label: 'Overage Rate ($/hr)', type: 'text', placeholder: '350' },
      { key: 'startDate', label: 'Agreement Start Date', type: 'date', required: true },
      { key: 'termMonths', label: 'Initial Term (months)', type: 'text', placeholder: '3' },
      { key: 'scope', label: 'Scope of Services', type: 'textarea', placeholder: 'Describe the legal services to be provided…', required: true },
    ],
    bodyFn: (v) => `RETAINER AGREEMENT

This Retainer Agreement ("Agreement") is entered into as of ${v.startDate || '[Start Date]'} between Broussard Legal Services ("Firm") and ${v.clientName || '[Client Name]'} ${v.firmName ? `of ${v.firmName}` : ''} ("Client").

1. SCOPE OF SERVICES
The Firm agrees to provide the following legal services to Client:
${v.scope || '[Scope of services to be described here]'}

Practice Area: ${v.practiceArea || '[Practice Area]'}

2. RETAINER FEE
Client agrees to pay a monthly retainer fee of $${v.retainerAmount || '[Amount]'}, which covers up to ${v.includedHours || '[X]'} hours of legal services per month.${v.overage ? ` Additional hours will be billed at $${v.overage}/hour.` : ''}

3. TERM
This Agreement commences on ${v.startDate || '[Start Date]'} and continues for an initial term of ${v.termMonths || '3'} months, after which it renews monthly unless terminated by either party with 30 days' written notice.

4. PAYMENT TERMS
The monthly retainer fee is due on the 1st of each month. Unpaid balances accrue interest at 1.5% per month.

5. CONFIDENTIALITY
The Firm agrees to maintain the confidentiality of all information provided by Client in connection with this engagement.

6. TERMINATION
Either party may terminate this Agreement upon 30 days' written notice. Client remains responsible for fees incurred through the termination date.

7. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Louisiana.

─────────────────────────────────────────────
CLIENT SIGNATURE

Name: ${v.clientName || '________________________________'}
Email: ${v.clientEmail || '________________________________'}
Date: ________________________________
Signature: ________________________________

─────────────────────────────────────────────
BROUSSARD LEGAL SERVICES

Authorized Signature: ________________________________
Date: ________________________________`,
  },
  {
    id: 'engagement-standard',
    category: 'engagement',
    title: 'Standard Engagement Letter',
    description: 'Formal engagement letter outlining representation terms and fee structure.',
    estimatedTime: '4 min',
    fields: [
      { key: 'clientName', label: 'Client Full Name', type: 'text', placeholder: 'John Doe', required: true },
      { key: 'clientEmail', label: 'Client Email', type: 'email', placeholder: 'john@example.com', required: true },
      { key: 'firmName', label: 'Company / Firm Name', type: 'text', placeholder: 'Doe Enterprises' },
      { key: 'matterName', label: 'Matter / Case Name', type: 'text', placeholder: 'Contract Dispute — Acme v. Doe', required: true },
      { key: 'practiceArea', label: 'Practice Area', type: 'select', options: PRACTICE_AREAS, required: true },
      { key: 'feeType', label: 'Fee Arrangement', type: 'select', options: ['Hourly', 'Flat Fee', 'Contingency', 'Retainer'], required: true },
      { key: 'feeAmount', label: 'Fee Amount / Rate', type: 'text', placeholder: '$350/hr or $5,000 flat', required: true },
      { key: 'engagementDate', label: 'Engagement Date', type: 'date', required: true },
      { key: 'objectives', label: 'Legal Objectives', type: 'textarea', placeholder: "Describe the client's legal goals and what the Firm will work to achieve…", required: true },
      { key: 'exclusions', label: 'Exclusions (optional)', type: 'textarea', placeholder: 'Any matters explicitly excluded from this engagement…' },
    ],
    bodyFn: (v) => `ENGAGEMENT LETTER

${v.engagementDate || '[Date]'}

${v.clientName || '[Client Name]'}${v.firmName ? `\n${v.firmName}` : ''}
${v.clientEmail || '[Client Email]'}

Re: ${v.matterName || '[Matter Name]'}

Dear ${v.clientName ? v.clientName.split(' ')[0] : 'Client'},

We are pleased to confirm our engagement to represent you in connection with the above-referenced matter. This letter sets forth the terms of our representation.

1. SCOPE OF REPRESENTATION
We will represent you in the following matter: ${v.matterName || '[Matter Name]'}
Practice Area: ${v.practiceArea || '[Practice Area]'}

Legal Objectives:
${v.objectives || '[Legal objectives to be described here]'}
${v.exclusions ? `\nExclusions from Scope:\n${v.exclusions}` : ''}

2. FEE ARRANGEMENT
Our fees for this engagement will be on a ${v.feeType || '[Fee Type]'} basis: ${v.feeAmount || '[Fee Amount]'}.

Invoices will be issued monthly and are due within 15 days of receipt. We reserve the right to suspend services for unpaid balances exceeding 30 days.

3. COMMUNICATION
We will keep you reasonably informed of developments in your matter. Please direct all communications to our office during business hours (Mon–Fri, 9am–5pm CT).

4. CLIENT RESPONSIBILITIES
You agree to: (a) provide complete and accurate information; (b) cooperate fully with our requests; (c) notify us promptly of any changes relevant to your matter.

5. CONFIDENTIALITY & PRIVILEGE
All communications between you and our Firm are protected by attorney-client privilege and will be kept strictly confidential.

6. TERMINATION
Either party may terminate this engagement upon written notice. You will be responsible for fees and costs incurred through the termination date.

7. GOVERNING LAW
This engagement is governed by the laws of the State of Louisiana and the applicable Rules of Professional Conduct.

Please sign below to confirm your agreement to these terms.

Sincerely,

Broussard Legal Services

─────────────────────────────────────────────
CLIENT ACKNOWLEDGMENT & SIGNATURE

I have read, understood, and agree to the terms of this Engagement Letter.

Name: ${v.clientName || '________________________________'}
Email: ${v.clientEmail || '________________________________'}
Date: ________________________________
Signature: ________________________________`,
  },
  {
    id: 'case-summary-standard',
    category: 'case_summary',
    title: 'Case Summary Report',
    description: 'Structured case summary for client review, covering facts, strategy, and next steps.',
    estimatedTime: '5 min',
    fields: [
      { key: 'clientName', label: 'Client Full Name', type: 'text', placeholder: 'Maria Garcia', required: true },
      { key: 'clientEmail', label: 'Client Email', type: 'email', placeholder: 'maria@example.com', required: true },
      { key: 'matterName', label: 'Matter / Case Name', type: 'text', placeholder: 'Garcia Employment Dispute', required: true },
      { key: 'caseNumber', label: 'Case / File Number', type: 'text', placeholder: 'BLS-2026-0042' },
      { key: 'practiceArea', label: 'Practice Area', type: 'select', options: PRACTICE_AREAS, required: true },
      { key: 'caseStatus', label: 'Current Status', type: 'select', options: ['Active', 'Pending Review', 'In Negotiation', 'Litigation', 'Settled', 'Closed'], required: true },
      { key: 'summaryDate', label: 'Summary Date', type: 'date', required: true },
      { key: 'factsSummary', label: 'Facts & Background', type: 'textarea', placeholder: 'Summarize the key facts and background of the matter…', required: true },
      { key: 'legalIssues', label: 'Legal Issues', type: 'textarea', placeholder: 'Identify the primary legal issues and claims…', required: true },
      { key: 'strategy', label: 'Legal Strategy & Approach', type: 'textarea', placeholder: 'Outline the recommended legal strategy…', required: true },
      { key: 'nextSteps', label: 'Next Steps & Action Items', type: 'textarea', placeholder: 'List immediate next steps and deadlines…', required: true },
      { key: 'risks', label: 'Risks & Considerations', type: 'textarea', placeholder: 'Describe any risks, challenges, or important considerations…' },
    ],
    bodyFn: (v) => `CASE SUMMARY REPORT

Prepared by: Broussard Legal Services
Date: ${v.summaryDate || '[Date]'}
${v.caseNumber ? `File No.: ${v.caseNumber}` : ''}

─────────────────────────────────────────────
CLIENT INFORMATION

Client: ${v.clientName || '[Client Name]'}
Email: ${v.clientEmail || '[Client Email]'}
Matter: ${v.matterName || '[Matter Name]'}
Practice Area: ${v.practiceArea || '[Practice Area]'}
Status: ${v.caseStatus || '[Status]'}

─────────────────────────────────────────────
1. FACTS & BACKGROUND

${v.factsSummary || '[Facts and background to be described here]'}

─────────────────────────────────────────────
2. LEGAL ISSUES

${v.legalIssues || '[Legal issues to be identified here]'}

─────────────────────────────────────────────
3. LEGAL STRATEGY & APPROACH

${v.strategy || '[Legal strategy to be outlined here]'}

─────────────────────────────────────────────
4. NEXT STEPS & ACTION ITEMS

${v.nextSteps || '[Next steps and deadlines to be listed here]'}
${v.risks ? `\n─────────────────────────────────────────────\n5. RISKS & CONSIDERATIONS\n\n${v.risks}` : ''}

─────────────────────────────────────────────
CLIENT ACKNOWLEDGMENT

I have reviewed this Case Summary and confirm its accuracy.

Name: ${v.clientName || '________________________________'}
Email: ${v.clientEmail || '________________________________'}
Date: ________________________________
Signature: ________________________________

─────────────────────────────────────────────
ATTORNEY NOTES (Internal — Not Shared with Client)

[Reserved for internal use]`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS: { id: WorkflowStep; label: string }[] = [
  { id: 'select', label: 'Select Template' },
  { id: 'fill', label: 'Client Info' },
  { id: 'review', label: 'Review' },
  { id: 'sign', label: 'Sign' },
  { id: 'complete', label: 'Complete' },
];

function StepIndicator({ current }: { current: WorkflowStep }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'text-white'
                    : active
                    ? 'text-white ring-4 ring-offset-2' :'bg-secondary/60 text-muted-foreground'
                }`}
                style={done || active ? { background: ACCENT, ...(active ? { ringColor: `${ACCENT}40` } : {}) } : {}}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${active ? 'text-foreground' : done ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 rounded-full transition-all duration-300 ${i < currentIdx ? '' : 'bg-secondary/60'}`}
                style={i < currentIdx ? { background: ACCENT } : {}} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onSelect }: { template: DocumentTemplate; onSelect: () => void }) {
  const meta = CATEGORY_META[template.category];
  return (
    <button
      onClick={onSelect}
      className={`group text-left w-full rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${meta.border} ${meta.bg}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: meta.color + '20', color: meta.color }}>
            {meta.icon}
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {template.estimatedTime}
        </span>
      </div>
      <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">{template.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{template.description}</p>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold" style={{ color: meta.color }}>
        Use Template
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </button>
  );
}

// ─── Field Input ──────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  const base = 'w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors';
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={`${base} resize-none`}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">Select…</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
    />
  );
}

// ─── Signature Pad ────────────────────────────────────────────────────────────

function SignaturePad({ onSign, clientName }: { onSign: (sig: string) => void; clientName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [typedSig, setTypedSig] = useState('');
  const [mode, setMode] = useState<'draw' | 'type'>('type');
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasSig(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  const handleSign = () => {
    if (mode === 'type') {
      if (!typedSig.trim()) return;
      onSign(`[Typed Signature] ${typedSig.trim()} — ${new Date().toISOString()}`);
    } else {
      if (!hasSig) return;
      const dataUrl = canvasRef.current?.toDataURL() ?? '';
      onSign(`[Drawn Signature] ${dataUrl} — ${new Date().toISOString()}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 p-1 bg-secondary/40 rounded-xl w-fit">
        {(['type', 'draw'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === m ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {m === 'type' ? 'Type Signature' : 'Draw Signature'}
          </button>
        ))}
      </div>

      {mode === 'type' ? (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Type your full name to sign</label>
          <input
            type="text"
            value={typedSig}
            onChange={(e) => setTypedSig(e.target.value)}
            placeholder={clientName || 'Your full name'}
            className="w-full px-4 py-3 text-xl border-2 border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
            style={{ fontFamily: 'cursive' }}
          />
          {typedSig && (
            <p className="text-xs text-muted-foreground mt-2">
              By typing your name, you agree this constitutes your legal electronic signature.
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Draw your signature below</label>
          <div className="relative border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={560}
              height={140}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!hasSig && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-sm text-muted-foreground/50">Sign here</span>
              </div>
            )}
            <div className="absolute bottom-2 left-3 right-3 border-t border-border/50" />
          </div>
          {hasSig && (
            <button onClick={clearCanvas} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
              Clear & Redraw
            </button>
          )}
        </div>
      )}

      <button
        onClick={handleSign}
        disabled={mode === 'type' ? !typedSig.trim() : !hasSig}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
        style={{ background: ACCENT }}
      >
        Sign Document
      </button>
    </div>
  );
}

// ─── Completed Documents List ─────────────────────────────────────────────────

interface CompletedDoc {
  id: string;
  templateTitle: string;
  category: TemplateCategory;
  clientName: string;
  clientEmail: string;
  signedAt: string;
  body: string;
}

function CompletedDocRow({ doc, onView }: { doc: CompletedDoc; onView: () => void }) {
  const meta = CATEGORY_META[doc.category];
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/20 transition-colors">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.color + '15', color: meta.color }}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{doc.templateTitle}</p>
        <p className="text-xs text-muted-foreground">{doc.clientName} · {doc.clientEmail}</p>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
        <p className="text-[11px] text-muted-foreground mt-1">{new Date(doc.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
      </div>
      <button
        onClick={onView}
        className="shrink-0 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
      >
        View
      </button>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ClientDocumentTemplatesDashboard() {
  const [step, setStep] = useState<WorkflowStep>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedBody, setGeneratedBody] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [completedDocs, setCompletedDocs] = useState<CompletedDoc[]>([]);
  const [viewingDoc, setViewingDoc] = useState<CompletedDoc | null>(null);
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'all'>('all');

  const filteredTemplates = filterCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === filterCategory);

  const handleSelectTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    const init: Record<string, string> = {};
    for (const f of template.fields) {
      if (f.type === 'date') init[f.key] = todayISO();
      else init[f.key] = '';
    }
    setFieldValues(init);
    setErrors({});
    setStep('fill');
  };

  const validateFields = () => {
    if (!selectedTemplate) return false;
    const newErrors: Record<string, string> = {};
    for (const f of selectedTemplate.fields) {
      if (f.required && !fieldValues[f.key]?.trim()) {
        newErrors[f.key] = `${f.label} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProceedToReview = () => {
    if (!validateFields() || !selectedTemplate) return;
    const body = selectedTemplate.bodyFn(fieldValues);
    setGeneratedBody(body);
    setStep('review');
  };

  const handleSign = (sig: string) => {
    setSignatureData(sig);
    if (!selectedTemplate) return;
    const doc: CompletedDoc = {
      id: `doc-${Date.now()}`,
      templateTitle: selectedTemplate.title,
      category: selectedTemplate.category,
      clientName: fieldValues.clientName || 'Unknown',
      clientEmail: fieldValues.clientEmail || '',
      signedAt: new Date().toISOString(),
      body: generatedBody,
    };
    setCompletedDocs((prev) => [doc, ...prev]);
    setStep('complete');
  };

  const handleReset = () => {
    setStep('select');
    setSelectedTemplate(null);
    setFieldValues({});
    setErrors({});
    setGeneratedBody('');
    setSignatureData('');
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${selectedTemplate?.title ?? 'Document'}</title><style>body{font-family:monospace;font-size:13px;line-height:1.7;padding:40px;max-width:800px;margin:0 auto;white-space:pre-wrap;}</style></head><body>${generatedBody}</body></html>`);
    win.document.close();
    win.print();
  };

  if (viewingDoc) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewingDoc(null)} className="p-2 rounded-xl hover:bg-secondary/50 text-muted-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div>
            <h2 className="font-serif text-xl text-foreground">{viewingDoc.templateTitle}</h2>
            <p className="text-xs text-muted-foreground">Signed by {viewingDoc.clientName} · {new Date(viewingDoc.signedAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6">
          <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">{viewingDoc.body}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground mb-1">Client Document Templates</h2>
          <p className="text-sm text-muted-foreground">Pre-built agreements and summaries — clients auto-fill and sign directly.</p>
        </div>
        {step !== 'select' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            Start Over
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <StepIndicator current={step} />

      {/* ── Step: Select ── */}
      {step === 'select' && (
        <div className="space-y-6">
          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'retainer', 'engagement', 'case_summary'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterCategory === cat
                    ? 'text-white' :'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
                style={filterCategory === cat ? { background: ACCENT } : {}}
              >
                {cat === 'all' ? 'All Templates' : CATEGORY_META[cat].label}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTemplates.map((t) => (
              <TemplateCard key={t.id} template={t} onSelect={() => handleSelectTemplate(t)} />
            ))}
          </div>

          {/* Completed Documents */}
          {completedDocs.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-foreground text-sm">Completed & Signed Documents</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{completedDocs.length}</span>
              </div>
              <div className="space-y-2">
                {completedDocs.map((doc) => (
                  <CompletedDocRow key={doc.id} doc={doc} onView={() => setViewingDoc(doc)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Fill ── */}
      {step === 'fill' && selectedTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: CATEGORY_META[selectedTemplate.category].color + '15', color: CATEGORY_META[selectedTemplate.category].color }}>
                {CATEGORY_META[selectedTemplate.category].icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{selectedTemplate.title}</h3>
                <p className="text-xs text-muted-foreground">Fill in the fields below — all required fields are marked</p>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {selectedTemplate.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <FieldInput
                    field={field}
                    value={fieldValues[field.key] ?? ''}
                    onChange={(v) => {
                      setFieldValues((prev) => ({ ...prev, [field.key]: v }));
                      if (errors[field.key]) setErrors((prev) => { const n = { ...prev }; delete n[field.key]; return n; });
                    }}
                  />
                  {errors[field.key] && (
                    <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
              <button onClick={handleReset} className="px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-secondary/40 transition-colors">
                Back
              </button>
              <button
                onClick={handleProceedToReview}
                className="px-6 py-2 text-sm rounded-xl text-white font-semibold transition-all hover:opacity-90"
                style={{ background: ACCENT }}
              >
                Preview Document →
              </button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-2 bg-secondary/20 border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live Preview</p>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-foreground/70 leading-relaxed">
                {selectedTemplate.bodyFn(fieldValues)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── Step: Review ── */}
      {step === 'review' && selectedTemplate && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs text-amber-800">Please review the document carefully before signing. Once signed, this document will be finalized and stored.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: CATEGORY_META[selectedTemplate.category].color + '15', color: CATEGORY_META[selectedTemplate.category].color }}>
                  {CATEGORY_META[selectedTemplate.category].icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{selectedTemplate.title}</h3>
                  <p className="text-xs text-muted-foreground">For: {fieldValues.clientName || 'Client'}</p>
                </div>
              </div>
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
              </button>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-xs text-foreground leading-relaxed">{generatedBody}</pre>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setStep('fill')} className="px-4 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-secondary/40 transition-colors">
              ← Edit Fields
            </button>
            <button
              onClick={() => setStep('sign')}
              className="px-6 py-2.5 text-sm rounded-xl text-white font-semibold transition-all hover:opacity-90"
              style={{ background: ACCENT }}
            >
              Proceed to Sign →
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Sign ── */}
      {step === 'sign' && selectedTemplate && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-1">Electronic Signature</h3>
            <p className="text-xs text-muted-foreground mb-6">
              By signing below, <strong>{fieldValues.clientName || 'you'}</strong> agree to the terms of the <strong>{selectedTemplate.title}</strong>. This electronic signature is legally binding.
            </p>
            <SignaturePad onSign={handleSign} clientName={fieldValues.clientName || ''} />
          </div>
          <button onClick={() => setStep('review')} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Review
          </button>
        </div>
      )}

      {/* ── Step: Complete ── */}
      {step === 'complete' && selectedTemplate && (
        <div className="max-w-lg mx-auto text-center space-y-6 py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: ACCENT + '15' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <h3 className="font-serif text-2xl text-foreground mb-2">Document Signed</h3>
            <p className="text-sm text-muted-foreground">
              <strong>{fieldValues.clientName || 'The client'}</strong> has successfully signed the <strong>{selectedTemplate.title}</strong>. The document has been saved to your completed records.
            </p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Document</span>
              <span className="font-semibold text-foreground">{selectedTemplate.title}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Client</span>
              <span className="font-semibold text-foreground">{fieldValues.clientName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Email</span>
              <span className="font-semibold text-foreground">{fieldValues.clientEmail}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Signed At</span>
              <span className="font-semibold text-foreground">{new Date().toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print / Download
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: ACCENT }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
