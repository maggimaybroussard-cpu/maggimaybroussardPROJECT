'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Party {
  name: string;
  role: string;
  contact: string | null;
}

interface KeyDate {
  date: string;
  description: string;
  type: string;
}

interface Clause {
  title: string;
  summary: string;
  importance: 'high' | 'medium' | 'low';
}

interface Obligation {
  party: string;
  obligation: string;
  deadline: string | null;
  consequence: string | null;
}

interface MonetaryAmount {
  amount: string;
  description: string;
  party: string | null;
}

interface RiskFlag {
  flag: string;
  severity: 'high' | 'medium' | 'low';
}

interface ExtractionResult {
  document_type: string;
  summary: string;
  parties: Party[];
  key_dates: KeyDate[];
  clauses: Clause[];
  obligations: Obligation[];
  monetary_amounts: MonetaryAmount[];
  jurisdiction: string | null;
  case_number: string | null;
  governing_law: string | null;
  risk_flags: RiskFlag[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPORTANCE_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

const DATE_TYPE_COLORS: Record<string, string> = {
  'Filing Date': 'bg-blue-50 text-blue-700',
  'Hearing Date': 'bg-purple-50 text-purple-700',
  'Deadline': 'bg-red-50 text-red-700',
  'Effective Date': 'bg-emerald-50 text-emerald-700',
  'Expiration Date': 'bg-orange-50 text-orange-700',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, icon, children, count }: { title: string; icon: React.ReactNode; children: React.ReactNode; count?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2.5">
          <span className="text-gray-500">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {count !== undefined && (
          <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LegalDocumentExtractor() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [activeSection, setActiveSection] = useState<string>('summary');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp'];
  const ACCEPTED_EXTS = '.pdf,.txt,.jpg,.jpeg,.png,.webp';

  const handleFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Supported formats: PDF, TXT, JPG, PNG, WebP');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20 MB');
      return;
    }
    setSelectedFile(file);
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const handleExtract = async () => {
    if (!selectedFile) return;
    setIsExtracting(true);
    try {
      const fileData = await fileToBase64(selectedFile);
      const res = await fetch('/api/lexi/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || 'Extraction failed');
        return;
      }
      setResult(data.extracted as ExtractionResult);
      setActiveSection('summary');
      toast.success('Document analyzed successfully');
    } catch {
      toast.error('Failed to extract document information');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sections = [
    { id: 'summary', label: 'Summary' },
    { id: 'parties', label: `Parties${result ? ` (${result.parties.length})` : ''}` },
    { id: 'dates', label: `Key Dates${result ? ` (${result.key_dates.length})` : ''}` },
    { id: 'clauses', label: `Clauses${result ? ` (${result.clauses.length})` : ''}` },
    { id: 'obligations', label: `Obligations${result ? ` (${result.obligations.length})` : ''}` },
    { id: 'financials', label: `Financials${result ? ` (${result.monetary_amounts.length})` : ''}` },
    { id: 'risks', label: `Risk Flags${result ? ` (${result.risk_flags.length})` : ''}` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Legal Document Extractor</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload court documents or legal files — Lexi automatically extracts key dates, parties, clauses, and obligations.
          </p>
        </div>
        {result && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
            Clear & Upload New
          </button>
        )}
      </div>

      {/* Upload Zone */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : selectedFile
              ? 'border-emerald-300 bg-emerald-50 cursor-default' :'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTS}
            onChange={handleInputChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedFile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type.split('/')[1].toUpperCase()}</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); handleExtract(); }}
                  disabled={isExtracting}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  {isExtracting ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Analyzing Document…
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      Extract Key Information
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleClear(); }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Drop a legal document here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Supports PDF, TXT, JPG, PNG, WebP · Max 20 MB</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extraction Loading State */}
      {isExtracting && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="animate-spin text-indigo-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-800">Lexi is analyzing your document…</p>
            <p className="text-xs text-indigo-600 mt-0.5">Extracting parties, dates, clauses, obligations, and risk flags</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isExtracting && (
        <div className="space-y-5">
          {/* Document Meta Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className="text-sm font-semibold text-gray-800">{result.document_type}</span>
            </div>
            {result.case_number && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="font-medium text-gray-600">Case #:</span> {result.case_number}
              </div>
            )}
            {result.jurisdiction && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="font-medium text-gray-600">Jurisdiction:</span> {result.jurisdiction}
              </div>
            )}
            {result.governing_law && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="font-medium text-gray-600">Governing Law:</span> {result.governing_law}
              </div>
            )}
            {result.risk_flags.filter(r => r.severity === 'high').length > 0 && (
              <Badge
                label={`${result.risk_flags.filter(r => r.severity === 'high').length} High Risk Flag${result.risk_flags.filter(r => r.severity === 'high').length > 1 ? 's' : ''}`}
                colorClass="bg-red-50 text-red-700 border-red-200"
              />
            )}
          </div>

          {/* Section Nav */}
          <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                  activeSection === s.id
                    ? 'text-indigo-700 border-indigo-600 bg-indigo-50/60' :'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {activeSection === 'summary' && (
            <SectionCard
              title="Document Summary"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
            >
              <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
            </SectionCard>
          )}

          {/* Parties Tab */}
          {activeSection === 'parties' && (
            <SectionCard
              title="Parties Involved"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              count={result.parties.length}
            >
              {result.parties.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No parties identified</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.parties.map((p, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3.5 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <Badge label={p.role} colorClass="bg-indigo-50 text-indigo-700 border-indigo-200" />
                      </div>
                      {p.contact && (
                        <p className="text-xs text-gray-500 mt-1.5">{p.contact}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Key Dates Tab */}
          {activeSection === 'dates' && (
            <SectionCard
              title="Key Dates & Deadlines"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              count={result.key_dates.length}
            >
              {result.key_dates.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No key dates identified</p>
              ) : (
                <div className="space-y-2.5">
                  {result.key_dates.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
                      <div className={`text-xs font-medium px-2 py-1 rounded-md flex-shrink-0 ${DATE_TYPE_COLORS[d.type] || 'bg-gray-100 text-gray-600'}`}>
                        {d.date}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{d.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{d.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Clauses Tab */}
          {activeSection === 'clauses' && (
            <SectionCard
              title="Key Clauses"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
              count={result.clauses.length}
            >
              {result.clauses.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No clauses identified</p>
              ) : (
                <div className="space-y-2.5">
                  {result.clauses.map((c, i) => (
                    <div key={i} className="p-3.5 border border-gray-100 rounded-lg bg-gray-50">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-gray-800">{c.title}</p>
                        <Badge
                          label={c.importance.charAt(0).toUpperCase() + c.importance.slice(1)}
                          colorClass={IMPORTANCE_COLORS[c.importance]}
                        />
                      </div>
                      <p className="text-sm text-gray-600">{c.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Obligations Tab */}
          {activeSection === 'obligations' && (
            <SectionCard
              title="Obligations"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              count={result.obligations.length}
            >
              {result.obligations.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No obligations identified</p>
              ) : (
                <div className="space-y-3">
                  {result.obligations.map((o, i) => (
                    <div key={i} className="p-3.5 border border-gray-100 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge label={o.party} colorClass="bg-blue-50 text-blue-700 border-blue-200" />
                        {o.deadline && (
                          <span className="text-xs text-gray-500">Due: <span className="font-medium text-gray-700">{o.deadline}</span></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{o.obligation}</p>
                      {o.consequence && (
                        <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          {o.consequence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Financials Tab */}
          {activeSection === 'financials' && (
            <SectionCard
              title="Monetary Amounts"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              count={result.monetary_amounts.length}
            >
              {result.monetary_amounts.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No monetary amounts identified</p>
              ) : (
                <div className="space-y-2.5">
                  {result.monetary_amounts.map((m, i) => (
                    <div key={i} className="flex items-start gap-4 p-3.5 border border-gray-100 rounded-lg bg-gray-50">
                      <div className="text-base font-bold text-emerald-700 flex-shrink-0">{m.amount}</div>
                      <div>
                        <p className="text-sm text-gray-700">{m.description}</p>
                        {m.party && <p className="text-xs text-gray-500 mt-0.5">Party: {m.party}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Risk Flags Tab */}
          {activeSection === 'risks' && (
            <SectionCard
              title="Risk Flags"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              count={result.risk_flags.length}
            >
              {result.risk_flags.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <p className="text-sm font-medium">No risk flags identified</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {result.risk_flags.map((r, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3.5 rounded-lg border ${SEVERITY_COLORS[r.severity]}`}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm">{r.flag}</p>
                      </div>
                      <Badge
                        label={r.severity.charAt(0).toUpperCase() + r.severity.slice(1)}
                        colorClass={SEVERITY_COLORS[r.severity]}
                      />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
