'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import { trackPortalDocumentsView, trackPortalDocumentSigned, trackPortalDocumentUpload } from '@/lib/analytics';
import { logPortalEvent } from '@/lib/portalEventLogger';

interface CaseDocument {
  id: string;
  inquiry_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_by_role?: string;
  category: string | null;
  description: string | null;
  version: number;
  parent_document_id: string | null;
  document_type: string | null;
  version_notes: string | null;
  created_at: string;
}

interface SignatureRequest {
  id: string;
  inquiry_id: string;
  title: string;
  document_description: string | null;
  document_content: string;
  status: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
}

interface Signature {
  id: string;
  request_id: string;
  signer_name: string;
  signer_email: string;
  signature_type: string;
  signature_data: string;
  signed_at: string;
}

interface Inquiry {
  id: string;
  name: string;
  service: string;
  status: string;
}

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'text/plain': 'TXT',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const DOCUMENT_CATEGORIES = [
  {
    key: 'contracts',
    label: 'Contracts',
    description: 'Signed agreements, retainer contracts, and legal engagements',
    shortDesc: 'Agreements & retainers',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M9 13h6M9 17h4"/>
      </svg>
    ),
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    key: 'intake',
    label: 'Intake Documents',
    description: 'Client intake forms, questionnaires, and onboarding materials',
    shortDesc: 'Intake & onboarding',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  {
    key: 'discovery',
    label: 'Discovery',
    description: 'Interrogatories, depositions, evidence, and discovery forms',
    shortDesc: 'Evidence & depositions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  {
    key: 'work_product',
    label: 'Drafts & Work Product',
    description: 'Legal memos, research, analysis, and draft documents',
    shortDesc: 'Memos & research',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  {
    key: 'court_filings',
    label: 'Filed Documents',
    description: 'Court filings, pleadings, motions, and official submissions',
    shortDesc: 'Filings & pleadings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    key: 'case_files',
    label: 'Case Files',
    description: 'Court orders, judgments, and official case records',
    shortDesc: 'Orders & records',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  {
    key: 'correspondence',
    label: 'Correspondence',
    description: 'Letters, emails, and communications related to your case',
    shortDesc: 'Letters & emails',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Miscellaneous documents and supporting materials',
    shortDesc: 'Miscellaneous',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    color: 'text-muted-foreground',
    bg: 'bg-muted/40',
    border: 'border-border',
    dot: 'bg-muted-foreground',
  },
];

const FILE_TYPE_OPTIONS = ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'JPEG', 'PNG', 'GIF', 'TXT'];

const DATE_RANGE_OPTIONS = [
  { key: 'all', label: 'Any time' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 3 months' },
  { key: '1y', label: 'Last year' },
];

const FILE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  PDF: { bg: 'bg-red-50', text: 'text-red-600' },
  DOC: { bg: 'bg-blue-50', text: 'text-blue-600' },
  DOCX: { bg: 'bg-blue-50', text: 'text-blue-600' },
  XLS: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  XLSX: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  JPEG: { bg: 'bg-purple-50', text: 'text-purple-600' },
  PNG: { bg: 'bg-purple-50', text: 'text-purple-600' },
  GIF: { bg: 'bg-purple-50', text: 'text-purple-600' },
  TXT: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type, large = false }: { type: string | null; large?: boolean }) {
  const t = type?.toUpperCase() ?? 'FILE';
  const colors = FILE_TYPE_COLORS[t] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
  const size = large ? 'w-12 h-12 rounded-xl text-xs' : 'w-10 h-10 rounded-xl text-[10px]';
  return (
    <div className={`${size} flex items-center justify-center shrink-0 ${colors.bg}`}>
      <span className={`font-bold uppercase tracking-wide ${colors.text}`}>{t.slice(0, 4)}</span>
    </div>
  );
}

function getCategoryMeta(key: string | null) {
  return DOCUMENT_CATEGORIES.find((c) => c.key === (key ?? 'other')) ?? DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1];
}

function isWithinDateRange(dateStr: string, rangeKey: string): boolean {
  if (rangeKey === 'all') return true;
  const now = new Date();
  const docDate = new Date(dateStr);
  const diffMs = now.getTime() - docDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (rangeKey === '7d') return diffDays <= 7;
  if (rangeKey === '30d') return diffDays <= 30;
  if (rangeKey === '90d') return diffDays <= 90;
  if (rangeKey === '1y') return diffDays <= 365;
  return true;
}

// ── E-Signature Inline Panel ──────────────────────────────────────────────────
type SignMode = 'draw' | 'type';

function ESignaturePanel({
  request,
  inquiry,
  user,
  existingSig,
  onSigned,
}: {
  request: SignatureRequest;
  inquiry: Inquiry;
  user: { id: string; email?: string; user_metadata?: { full_name?: string } };
  existingSig: Signature | null;
  onSigned: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [signMode, setSignMode] = useState<SignMode>('draw');
  const [typedSig, setTypedSig] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    setHasDrawn(false);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current?.x ?? pos.x, lastPos.current?.y ?? pos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  };

  const stopDraw = () => { setIsDrawing(false); lastPos.current = null; };

  const handleSign = async () => {
    if (!user) return;
    let sigData = '';
    if (signMode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) { setSignError('Please draw your signature.'); return; }
      sigData = canvas.toDataURL('image/png');
    } else {
      if (!typedSig.trim()) { setSignError('Please type your name to sign.'); return; }
      sigData = typedSig.trim();
    }

    setSigning(true);
    setSignError(null);
    const supabase = createClient();
    const signerName = user.user_metadata?.full_name ?? user.email ?? 'Client';

    const { error: sigErr } = await supabase.from('signatures').insert({
      request_id: request.id,
      inquiry_id: request.inquiry_id,
      user_id: user.id,
      signer_name: signerName,
      signer_email: user.email ?? '',
      signature_data: sigData,
      signature_type: signMode === 'draw' ? 'drawn' : 'typed',
    });

    if (sigErr) { setSignError('Failed to submit signature. Please try again.'); setSigning(false); return; }

    await supabase.from('signature_requests').update({ status: 'signed' }).eq('id', request.id);
    setSigning(false);
    setExpanded(false);
    trackPortalDocumentSigned(request.title);
    onSigned();
  };

  const isSigned = request.status === 'signed' || !!existingSig;
  const isExpired = request.status === 'expired';

  return (
    <div className={`rounded-xl border ${isSigned ? 'border-emerald-200 bg-emerald-50/40' : isExpired ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'} overflow-hidden`}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSigned ? 'bg-emerald-100' : isExpired ? 'bg-red-100' : 'bg-amber-100'}`}>
          {isSigned ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isExpired ? 'text-red-600' : 'text-amber-600'}>
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{request.title}</p>
          {request.document_description && (
            <p className="text-xs text-muted-foreground truncate">{request.document_description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isSigned ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Signed {existingSig ? `· ${formatDate(existingSig.signed_at)}` : ''}
            </span>
          ) : isExpired ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Expired
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                Awaiting Signature
              </span>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                {expanded ? 'Cancel' : 'Sign Now'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded sign panel */}
      {expanded && !isSigned && !isExpired && (
        <div className="border-t border-amber-200 p-4 bg-white/80 space-y-4">
          {/* Document preview */}
          <div className="bg-muted/30 rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-2">Document Preview</p>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{request.document_content.slice(0, 800)}{request.document_content.length > 800 ? '…' : ''}</p>
          </div>

          {/* Sign mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
            {(['draw', 'type'] as SignMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSignMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${signMode === m ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {m === 'draw' ? 'Draw Signature' : 'Type Name'}
              </button>
            ))}
          </div>

          {signMode === 'draw' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Draw your signature below</p>
                <button onClick={clearCanvas} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>
              </div>
              <canvas
                ref={canvasRef}
                width={480}
                height={120}
                className="w-full border border-border rounded-lg bg-white cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Type your full legal name</p>
              <input
                type="text"
                value={typedSig}
                onChange={(e) => setTypedSig(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem' }}
              />
            </div>
          )}

          {signError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {signError}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSign}
              disabled={signing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {signing ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              {signing ? 'Submitting…' : 'Submit Signature'}
            </button>
            <button onClick={() => setExpanded(false)} className="px-4 py-2 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <p className="text-[10px] text-muted-foreground ml-auto">By signing, you agree to the terms above.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Document Version History ──────────────────────────────────────────────────
function DocumentVersionHistory({
  doc,
  allDocs,
}: {
  doc: CaseDocument;
  allDocs: CaseDocument[];
}) {
  const [open, setOpen] = useState(false);

  // Find all versions in the same chain
  const rootId = doc.parent_document_id ?? doc.id;
  const versions = allDocs
    .filter((d) => d.id === rootId || d.parent_document_id === rootId || d.id === doc.id)
    .sort((a, b) => b.version - a.version);

  if (versions.length <= 1) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
        </svg>
        {versions.length} versions
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-3 border-l-2 border-border">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className={`font-semibold ${v.id === doc.id ? 'text-primary' : ''}`}>v{v.version}</span>
              <span>{formatDate(v.created_at)}</span>
              {v.version_notes && <span className="italic">— {v.version_notes}</span>}
              <a href={v.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-auto">View</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Portal Document Analyzer ─────────────────────────────────────────────────

function PortalDocumentAnalyzer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const allowed = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) return;
    if (file.size > 20 * 1024 * 1024) return;
    setSelectedFile(file);
    setAnalysisResult(null);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const fileToText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      let content: any[];
      if (selectedFile.type === 'text/plain') {
        const text = await fileToText(selectedFile);
        content = [{ type: 'text', text: `Summarize this legal document for a client. Highlight: key dates, what they need to do, any deadlines, and important terms. Be clear and concise:\n\n${text}` }];
      } else {
        const base64 = await fileToBase64(selectedFile);
        content = [
          { type: 'text', text: 'Summarize this legal document for a client. Highlight: key dates, what they need to do, any deadlines, and important terms. Be clear and concise.' },
          { type: 'file', file: { file_data: base64, filename: selectedFile.name } },
        ];
      }
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'OPEN_AI',
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a helpful legal assistant summarizing documents for clients in plain English. Be concise, use bullet points, and highlight anything urgent.' },
            { role: 'user', content },
          ],
          stream: false,
          parameters: { max_completion_tokens: 800 },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed');
      setAnalysisResult(data.choices?.[0]?.message?.content ?? 'No analysis returned.');
    } catch {
      setAnalysisResult('Unable to analyze document. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/10' : 'border-primary/30 hover:border-primary/60 hover:bg-primary/5'}`}
      >
        <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {selectedFile ? (
          <p className="text-xs font-semibold text-foreground">{selectedFile.name} <span className="text-muted-foreground font-normal">· Click to change</span></p>
        ) : (
          <p className="text-xs text-muted-foreground">Drop a document here or <span className="text-primary font-semibold">browse</span> · PDF, DOC, TXT</p>
        )}
      </div>
      {selectedFile && (
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Analyzing…</>
          ) : 'Analyze Document with AI'}
        </button>
      )}
      {analysisResult && (
        <div className="bg-white border border-primary/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">AI Summary</p>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{analysisResult}</p>
        </div>
      )}
    </div>
  );
}

export default function PortalDocumentsPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState<'documents' | 'signatures' | 'intake'>('documents');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'size_desc'>('date_desc');
  const [uploadCategory, setUploadCategory] = useState<string>('intake');

  // Advanced filter state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mine' | 'shared'>('all');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data: accessData, error: accessError } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessError) throw accessError;
      if (!accessData) { setLoading(false); return; }

      const inquiryId = accessData.inquiry_id;

      const [inquiryRes, docsRes, sigReqRes, sigsRes] = await Promise.all([
        supabase.from('contact_inquiries').select('id,name,service,status').eq('id', inquiryId).single(),
        supabase.from('case_documents').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }),
        supabase.from('signature_requests').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }),
        supabase.from('signatures').select('*').eq('inquiry_id', inquiryId).order('signed_at', { ascending: false }),
      ]);

      if (inquiryRes.error) throw inquiryRes.error;
      setInquiry(inquiryRes.data);
      setDocuments(docsRes.data || []);
      setSignatureRequests(sigReqRes.data || []);
      setSignatures(sigsRes.data || []);
      const pendingSigs = (sigReqRes.data || []).filter((r: SignatureRequest) => r.status === 'pending').length;
      trackPortalDocumentsView((docsRes.data || []).length, pendingSigs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    let cleanup: (() => void) | undefined;

    supabase
      .from('client_portal_access')
      .select('inquiry_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const inquiryId = data?.inquiry_id ?? null;
        if (!inquiryId) return;

        const docsChannel = supabase
          .channel('portal-docs-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'case_documents', filter: `inquiry_id=eq.${inquiryId}` }, () => {
            fetchData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'signature_requests', filter: `inquiry_id=eq.${inquiryId}` }, () => {
            fetchData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'signatures', filter: `inquiry_id=eq.${inquiryId}` }, () => {
            fetchData();
          })
          .subscribe();

        cleanup = () => { supabase.removeChannel(docsChannel); };
      });

    return () => { cleanup?.(); };
  }, [user, fetchData]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES[file.type]) return `File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT`;
    if (file.size > MAX_FILE_SIZE) return `File too large. Maximum size is 10 MB.`;
    return null;
  };

  const handleUpload = async (file: File) => {
    if (!user || !inquiry) return;
    const validationError = validateFile(file);
    if (validationError) { setUploadError(validationError); return; }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const supabase = createClient();
      const storagePath = `${user.id}/${inquiry.id}/${Date.now()}_${file.name}`;

      const { error: storageError } = await supabase.storage
        .from('case-documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage.from('case-documents').getPublicUrl(storagePath);
      const ext = file.name.split('.').pop();

      const { error: dbError } = await supabase.from('case_documents').insert({
        inquiry_id: inquiry.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: ALLOWED_TYPES[file.type] ?? ext ?? null,
        file_size: file.size,
        uploaded_by: user.email ?? 'Client',
        uploaded_by_role: 'client',
        category: uploadCategory,
        document_type: 'other',
        version: 1,
      });

      if (dbError) throw dbError;
      setUploadSuccess(`"${file.name}" uploaded successfully.`);
      setShowUpload(false);
      trackPortalDocumentUpload({
        category: uploadCategory,
        fileType: ALLOWED_TYPES[file.type] ?? file.name.split('.').pop() ?? 'unknown',
        fileSizeBytes: file.size,
      });
      logPortalEvent('portal_document_upload', {
        category: uploadCategory,
        file_type: ALLOWED_TYPES[file.type] ?? file.name.split('.').pop() ?? 'unknown',
        file_size_kb: Math.round(file.size / 1024),
      });
      await fetchData();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDelete = async (doc: CaseDocument) => {
    if (!user) return;
    setDeletingId(doc.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const supabase = createClient();
      const urlParts = doc.file_url.split('/object/public/case-documents/');
      if (urlParts.length === 2) {
        await supabase.storage.from('case-documents').remove([decodeURIComponent(urlParts[1])]);
      }
      const { error: dbError } = await supabase.from('case_documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleDocType = (type: string) => {
    setSelectedDocTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const clearAllFilters = () => {
    setSearch('');
    setActiveCategory('all');
    setSelectedDocTypes([]);
    setSelectedDateRange('all');
    setSourceFilter('all');
  };

  // Derived
  const categoryCounts = DOCUMENT_CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = documents.filter((d) => (d.category ?? 'other') === cat.key).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredDocs = documents
    .filter((doc) => {
      const isAdmin = doc.uploaded_by_role === 'admin' || doc.uploaded_by_role === 'paralegal';
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'mine' && !isAdmin) ||
        (sourceFilter === 'shared' && isAdmin);

      const matchesCategory = activeCategory === 'all' || (doc.category ?? 'other') === activeCategory;

      const matchesSearch = !search ||
        doc.file_name.toLowerCase().includes(search.toLowerCase()) ||
        (doc.description ?? '').toLowerCase().includes(search.toLowerCase());

      const matchesDocType = selectedDocTypes.length === 0 ||
        selectedDocTypes.includes((doc.file_type ?? '').toUpperCase());

      const matchesDate = isWithinDateRange(doc.created_at, selectedDateRange);

      return matchesSource && matchesCategory && matchesSearch && matchesDocType && matchesDate;
    })
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'name_asc') return a.file_name.localeCompare(b.file_name);
      if (sortBy === 'size_desc') return (b.file_size ?? 0) - (a.file_size ?? 0);
      return 0;
    });

  const activeFilterCount = [
    selectedDocTypes.length > 0 ? 1 : 0,
    selectedDateRange !== 'all' ? 1 : 0,
    sourceFilter !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const hasAnyFilter = search || activeCategory !== 'all' || activeFilterCount > 0;

  const pendingSigCount = signatureRequests.filter((r) => r.status === 'pending').length;
  const intakeDocs = documents.filter((d) => d.category === 'intake');

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="w-28 h-7 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 md:px-10 py-10 space-y-6">
          <div className="w-48 h-8 bg-muted/60 rounded-lg animate-pulse" />
          <div className="flex gap-6">
            <div className="w-56 shrink-0 space-y-2">
              {[1,2,3,4,5,6,7].map((i) => <div key={i} className="h-10 bg-muted/40 rounded-xl animate-pulse" />)}
            </div>
            <div className="flex-1 space-y-3">
              {[1,2,3,4].map((i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link href="/portal/cases" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="hidden sm:inline">Cases</span>
              </Link>
              <Link href="/portal/messages" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="hidden sm:inline">Messages</span>
              </Link>
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[160px]">{user?.email}</span>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-10 py-8">
        {/* Page heading */}
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Portal</p>
            <h1 className="font-serif text-4xl text-foreground">Document Center</h1>
            {inquiry && (
              <p className="text-sm text-muted-foreground font-light mt-1.5">
                Upload intake documents, sign agreements, and access all case files in one secure place.
              </p>
            )}
          </div>
          {inquiry && (
            <button
              onClick={() => { setShowUpload(!showUpload); setUploadError(null); setUploadSuccess(null); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Upload File
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {!inquiry && !error && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-foreground mb-2">No documents yet</h2>
            <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
              Your account hasn&apos;t been linked to a case yet. Please contact Maggi May Broussard directly.
            </p>
            <Link href="/contact" className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity">
              Contact Us
            </Link>
          </div>
        )}

        {inquiry && (
          <div className="space-y-5">

            {/* Upload Panel */}
            {showUpload && (
              <section className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-serif text-lg text-foreground">Upload a Document</h2>
                  <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* Category selector */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Document Category</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DOCUMENT_CATEGORIES.filter((c) => c.key !== 'other').map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setUploadCategory(cat.key)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          uploadCategory === cat.key
                            ? `${cat.bg} ${cat.border} ${cat.color}`
                            : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                        }`}
                      >
                        <span className={uploadCategory === cat.key ? cat.color : 'text-muted-foreground'}>{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all ${
                    dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      <p className="text-sm text-muted-foreground">Uploading…</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-primary/8 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">Drop file here or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT · Max 10 MB</p>
                      </div>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt" />
                </div>

                {uploadError && (
                  <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {uploadError}
                  </div>
                )}
              </section>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {uploadSuccess}
              </div>
            )}

            {/* Tab navigation */}
            <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-fit">
              {[
                { key: 'documents', label: 'All Documents', count: documents.length },
                { key: 'intake', label: 'Intake Upload', count: intakeDocs.length },
                { key: 'signatures', label: 'Signatures', count: signatureRequests.length, badge: pendingSigCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {tab.badge && tab.badge > 0 ? (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">{tab.badge}</span>
                  ) : tab.count > 0 ? (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">{tab.count}</span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* ── SIGNATURES TAB ── */}
            {activeTab === 'signatures' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl text-foreground">E-Signature Requests</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Review and sign documents sent by your attorney.</p>
                  </div>
                  {pendingSigCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                      {pendingSigCount} awaiting signature
                    </span>
                  )}
                </div>

                {signatureRequests.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">No signature requests</p>
                    <p className="text-xs text-muted-foreground">Your attorney will send documents here when they need your signature.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {signatureRequests.map((req) => {
                      const existingSig = signatures.find((s) => s.request_id === req.id) ?? null;
                      return (
                        <ESignaturePanel
                          key={req.id}
                          request={req}
                          inquiry={inquiry}
                          user={user!}
                          existingSig={existingSig}
                          onSigned={fetchData}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Signature status summary */}
                {signatureRequests.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[
                      { label: 'Total', count: signatureRequests.length, color: 'text-foreground', bg: 'bg-card' },
                      { label: 'Signed', count: signatureRequests.filter((r) => r.status === 'signed').length, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                      { label: 'Pending', count: pendingSigCount, color: 'text-amber-700', bg: 'bg-amber-50' },
                    ].map((s) => (
                      <div key={s.label} className={`${s.bg} border border-border rounded-xl p-4 text-center`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── INTAKE TAB ── */}
            {activeTab === 'intake' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl text-foreground">Intake Documents</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload your intake forms, questionnaires, and onboarding materials here.</p>
                  </div>
                  <button
                    onClick={() => { setUploadCategory('intake'); setShowUpload(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Upload Intake Doc
                  </button>
                </div>

                {/* Intake checklist */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-widest mb-3">Typical Intake Documents</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Completed intake questionnaire',
                      'Government-issued ID (front & back)',
                      'Relevant contracts or agreements',
                      'Prior legal correspondence',
                      'Supporting evidence or documentation',
                      'Financial records (if applicable)',
                    ].map((item) => {
                      const uploaded = intakeDocs.some((d) => d.file_name.toLowerCase().includes(item.split(' ')[0].toLowerCase()));
                      return (
                        <div key={item} className="flex items-center gap-2 text-xs">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${uploaded ? 'bg-emerald-500' : 'bg-white border border-indigo-300'}`}>
                            {uploaded && (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </span>
                          <span className={uploaded ? 'text-emerald-700 line-through' : 'text-indigo-800'}>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {intakeDocs.length === 0 ? (
                  <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">No intake documents uploaded</p>
                    <p className="text-xs text-muted-foreground mb-4">Upload your intake forms and supporting documents to get started.</p>
                    <button
                      onClick={() => { setUploadCategory('intake'); setShowUpload(true); }}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      Upload Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {intakeDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-foreground/20 transition-colors group">
                        <FileTypeIcon type={doc.file_type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(doc.created_at)} · {formatFileSize(doc.file_size)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                            View
                          </a>
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Document Analysis Panel */}
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">AI Document Analysis</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Upload a document to have AI extract key information, deadlines, and action items.</p>
                    </div>
                  </div>
                  <PortalDocumentAnalyzer />
                </div>
              </section>
            )}

            {/* ── DOCUMENTS TAB ── */}
            {activeTab === 'documents' && (
              <div className="flex gap-6">
                {/* Sidebar */}
                <aside className="w-52 shrink-0 hidden md:block">
                  <div className="sticky top-24 space-y-1">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        activeCategory === 'all' ?'bg-foreground text-background' :'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span>All Documents</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeCategory === 'all' ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'}`}>
                        {documents.length}
                      </span>
                    </button>
                    {DOCUMENT_CATEGORIES.map((cat) => {
                      const count = categoryCounts[cat.key] ?? 0;
                      return (
                        <button
                          key={cat.key}
                          onClick={() => setActiveCategory(cat.key)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                            activeCategory === cat.key
                              ? `${cat.bg} ${cat.color} border ${cat.border}`
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={activeCategory === cat.key ? cat.color : 'text-muted-foreground'}>{cat.icon}</span>
                            {cat.label}
                          </span>
                          {count > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeCategory === cat.key ? `${cat.bg} ${cat.color}` : 'bg-muted text-muted-foreground'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </aside>

                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Search + filters bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search documents…"
                        className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                      />
                    </div>

                    <button
                      onClick={() => setShowFilters((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${showFilters ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                      </svg>
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">{activeFilterCount}</span>
                      )}
                    </button>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="px-3 py-2 border border-border rounded-xl text-xs font-semibold bg-card text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="date_desc">Newest first</option>
                      <option value="date_asc">Oldest first</option>
                      <option value="name_asc">Name A–Z</option>
                      <option value="size_desc">Largest first</option>
                    </select>

                    <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg">
                      {(['list', 'grid'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setViewMode(m)}
                          className={`p-1.5 rounded-md transition-all ${viewMode === m ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {m === 'list' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced filters */}
                  {showFilters && (
                    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground uppercase tracking-widest">Advanced Filters</p>
                        {hasAnyFilter && (
                          <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground underline">Clear all</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">File Type</p>
                          <div className="flex flex-wrap gap-1.5">
                            {FILE_TYPE_OPTIONS.map((t) => (
                              <button
                                key={t}
                                onClick={() => toggleDocType(t)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                  selectedDocTypes.includes(t)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border text-muted-foreground hover:border-foreground/30'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Date Range</p>
                          <div className="space-y-1">
                            {DATE_RANGE_OPTIONS.map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => setSelectedDateRange(opt.key)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                                  selectedDateRange === opt.key
                                    ? 'bg-primary/10 text-primary font-semibold' :'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Source</p>
                          <div className="space-y-1">
                            {[
                              { key: 'all', label: 'All documents' },
                              { key: 'mine', label: 'Uploaded by me' },
                              { key: 'shared', label: 'Shared by attorney' },
                            ].map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => setSourceFilter(opt.key as typeof sourceFilter)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                                  sourceFilter === opt.key
                                    ? 'bg-primary/10 text-primary font-semibold' :'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Results count */}
                  {hasAnyFilter && (
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredDocs.length} of {documents.length} documents
                      {search && <> matching &ldquo;<span className="font-semibold text-foreground">{search}</span>&rdquo;</>}
                    </p>
                  )}

                  {/* Document list */}
                  {filteredDocs.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-10 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {hasAnyFilter ? 'No documents match your filters' : 'No documents yet'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {hasAnyFilter ? 'Try adjusting your search or filters.' : 'Documents shared by your attorney will appear here.'}
                      </p>
                      {hasAnyFilter && (
                        <button onClick={clearAllFilters} className="mt-4 text-xs text-primary hover:underline">Clear filters</button>
                      )}
                    </div>
                  ) : viewMode === 'list' ? (
                    <div className="space-y-2">
                      {filteredDocs.map((doc) => {
                        const catMeta = getCategoryMeta(doc.category);
                        const isAdmin = doc.uploaded_by_role === 'admin' || doc.uploaded_by_role === 'paralegal';
                        return (
                          <div key={doc.id} className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:border-foreground/20 transition-colors group">
                            <FileTypeIcon type={doc.file_type} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-foreground truncate">{doc.file_name}</p>
                                {doc.version > 1 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-200">
                                    v{doc.version}
                                  </span>
                                )}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catMeta.bg} ${catMeta.color} ${catMeta.border}`}>
                                  <span className={`w-1 h-1 rounded-full ${catMeta.dot} inline-block`} />
                                  {catMeta.label}
                                </span>
                                {isAdmin && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-semibold border border-sky-200">
                                    From Attorney
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(doc.created_at)} · {formatFileSize(doc.file_size)}
                                {doc.description && ` · ${doc.description}`}
                              </p>
                              <DocumentVersionHistory doc={doc} allDocs={documents} />
                            </div>
                            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                View
                              </a>
                              {!isAdmin && (
                                <button
                                  onClick={() => handleDelete(doc)}
                                  disabled={deletingId === doc.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  {deletingId === doc.id ? (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                  ) : (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                                  )}
                                  {deletingId === doc.id ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filteredDocs.map((doc) => {
                        const catMeta = getCategoryMeta(doc.category);
                        return (
                          <div key={doc.id} className="bg-card border border-border rounded-xl p-4 hover:border-foreground/20 transition-colors group flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <FileTypeIcon type={doc.file_type} large />
                              {doc.version > 1 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-200">
                                  v{doc.version}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{doc.file_name}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatDate(doc.created_at)}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catMeta.bg} ${catMeta.color} ${catMeta.border}`}>
                                <span className={`w-1 h-1 rounded-full ${catMeta.dot} inline-block`} />
                                {catMeta.shortDesc}
                              </span>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline font-semibold">View</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
