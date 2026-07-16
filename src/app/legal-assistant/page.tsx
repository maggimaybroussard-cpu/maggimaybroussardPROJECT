'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useChat } from '@/lib/hooks/useChat';
import LexiSettlementEstimator from '@/components/LexiSettlementEstimator';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  summary: string;
  documentType: string;
  parties: string[];
  keyDates: string[];
  keyPoints: string[];
  riskFlags: string[];
  jurisdiction: string;
  caseNumber: string;
}

interface ResearchResult {
  query: string;
  content: string;
  citations: string[];
  timestamp: number;
}

type ActiveTab = 'analyze' | 'research' | 'settlement';
type ResearchCategory = 'case_law' | 'statutes' | 'precedent' | 'all';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

function buildAnalysisPrompt(fileName: string): string {
  return `You are a senior legal analyst at Broussard Legal Services. Analyze this legal document "${fileName}" and return a JSON object with this exact structure:

{
  "documentType": "string (e.g., Complaint, Motion, Contract, Court Order, Pleading, Brief, etc.)",
  "summary": "string (3-4 sentence plain-English overview of the document)",
  "parties": ["string array of all parties and their roles, e.g. 'John Smith — Plaintiff'"],
  "keyDates": ["string array of important dates with context, e.g. 'March 15, 2024 — Filing deadline'"],
  "keyPoints": ["string array of 5-8 most important legal points, holdings, or provisions"],
  "riskFlags": ["string array of potential risks, issues, or concerns (empty array if none)"],
  "jurisdiction": "string or empty string",
  "caseNumber": "string or empty string"
}

Return ONLY valid JSON. No markdown, no extra text.`;
}

const CATEGORY_OPTIONS: Array<{ id: ResearchCategory; label: string; icon: string }> = [
  { id: 'all', label: 'All Sources', icon: '🔍' },
  { id: 'case_law', label: 'Case Law', icon: '⚖️' },
  { id: 'statutes', label: 'Statutes', icon: '📚' },
  { id: 'precedent', label: 'Precedent', icon: '🏛️' },
];

function buildResearchPrompt(query: string, category: ResearchCategory): string {
  const categoryInstructions: Record<ResearchCategory, string> = {
    case_law: 'Focus on relevant federal and state court decisions. Include case names, citations, courts, years, and key holdings. Prioritize Fifth Circuit and Louisiana courts when applicable.',
    statutes: 'Focus on relevant federal statutes (U.S.C.), Louisiana Revised Statutes (La. R.S.), Louisiana Code of Civil Procedure (La. C.C.P.), and Louisiana Civil Code (La. C.C.). Include exact code sections.',
    precedent: 'Identify controlling authority (binding precedent) and persuasive authority. Distinguish between circuit splits, majority/minority positions, and recent trends. Include proper Bluebook citations.',
    all: 'Provide comprehensive legal research including case law, statutes, regulations, and secondary sources. Organize by source type. Include proper Bluebook citations for all authorities.',
  };

  return `You are Lexi, a legal research assistant at Broussard Legal Services specializing in Louisiana law and Fifth Circuit federal practice.

RESEARCH QUERY: ${query}
RESEARCH FOCUS: ${categoryInstructions[category]}

Provide structured legal research with:

1. **SUMMARY** — 2-3 sentence overview of the legal landscape

2. **KEY AUTHORITIES** — Most important cases, statutes, or rules with:
   - Full Bluebook citation
   - Court/jurisdiction and year
   - Key holding (1-2 sentences)

3. **CONTROLLING LAW** — Binding authority in Louisiana / Fifth Circuit

4. **RECENT DEVELOPMENTS** — Notable cases or statutory changes (last 5 years)

5. **PRACTICE NOTES** — Practical tips for Louisiana/Fifth Circuit practice

Format citations in proper Bluebook format. Cite only real, verifiable authorities.`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UploadZone({
  onFileSelect,
  file,
  onClear,
}: {
  onFileSelect: (f: File) => void;
  file: File | null;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFileSelect(dropped);
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileSelect(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-[#355E3B]/30 bg-[#355E3B]/5">
        <div className="w-10 h-10 rounded-lg bg-[#355E3B]/10 flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Remove file"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
        dragging
          ? 'border-[#355E3B] bg-[#355E3B]/8'
          : 'border-border hover:border-[#355E3B]/50 hover:bg-secondary/40'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        onChange={handleChange}
        className="hidden"
        aria-label="Upload legal document"
      />
      <div className="w-14 h-14 rounded-2xl bg-[#355E3B]/10 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Drop your document here</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, TXT, DOC, DOCX — or click to browse</p>
      </div>
    </div>
  );
}

function AnalysisCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#355E3B]/10 text-[#355E3B]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {result.documentType}
        </span>
        {result.jurisdiction && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">
            📍 {result.jurisdiction}
          </span>
        )}
        {result.caseNumber && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">
            # {result.caseNumber}
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 rounded-xl bg-secondary/50 border border-border">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Summary</h3>
        <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
      </div>

      {/* Grid: Parties + Key Dates */}
      <div className="grid md:grid-cols-2 gap-4">
        {result.parties.length > 0 && (
          <div className="p-4 rounded-xl border border-border">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Parties
            </h3>
            <ul className="space-y-1.5">
              {result.parties.map((p, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#355E3B] shrink-0" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.keyDates.length > 0 && (
          <div className="p-4 rounded-xl border border-border">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Key Dates
            </h3>
            <ul className="space-y-1.5">
              {result.keyDates.map((d, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8B3A45] shrink-0" aria-hidden="true" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Key Points */}
      {result.keyPoints.length > 0 && (
        <div className="p-4 rounded-xl border border-border">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Key Legal Points
          </h3>
          <ul className="space-y-2">
            {result.keyPoints.map((pt, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#355E3B]/10 text-[#355E3B] text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Flags */}
      {result.riskFlags.length > 0 && (
        <div className="p-4 rounded-xl border border-[#8B3A45]/30 bg-[#8B3A45]/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#8B3A45] mb-3 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Risk Flags
          </h3>
          <ul className="space-y-1.5">
            {result.riskFlags.map((flag, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8B3A45] shrink-0" aria-hidden="true" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LegalAssistantPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyze');

  // Document Analysis state
  const [file, setFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Research state
  const [researchQuery, setResearchQuery] = useState('');
  const [researchCategory, setResearchCategory] = useState<ResearchCategory>('all');
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);
  const [activeResearch, setActiveResearch] = useState<ResearchResult | null>(null);

  // Anthropic hook for document analysis
  const {
    response: analysisResponse,
    isLoading: analysisLoading,
    error: analysisError,
    sendMessage: sendAnalysis,
  } = useChat('ANTHROPIC', 'claude-sonnet-4-6', false);

  // Perplexity hook for legal research
  const {
    response: researchResponse,
    fullResponse: researchFullResponse,
    isLoading: researchLoading,
    error: researchError,
    sendMessage: sendResearch,
  } = useChat('PERPLEXITY', 'perplexity/sonar-pro', false);

  // Handle analysis errors
  useEffect(() => {
    if (analysisError) toast.error('Document analysis failed: ' + analysisError.message);
  }, [analysisError]);

  // Handle research errors
  useEffect(() => {
    if (researchError) toast.error('Legal research failed: ' + researchError.message);
  }, [researchError]);

  // Parse analysis response
  useEffect(() => {
    if (analysisResponse && !analysisLoading) {
      setIsAnalyzing(false);
      try {
        const cleaned = analysisResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        setAnalysisResult({
          summary: parsed.summary || '',
          documentType: parsed.documentType || 'Legal Document',
          parties: parsed.parties || [],
          keyDates: parsed.keyDates || [],
          keyPoints: parsed.keyPoints || [],
          riskFlags: parsed.riskFlags || [],
          jurisdiction: parsed.jurisdiction || '',
          caseNumber: parsed.caseNumber || '',
        });
      } catch {
        setAnalysisResult({
          summary: analysisResponse,
          documentType: 'Legal Document',
          parties: [],
          keyDates: [],
          keyPoints: [],
          riskFlags: [],
          jurisdiction: '',
          caseNumber: '',
        });
      }
    }
  }, [analysisResponse, analysisLoading]);

  // Parse research response
  useEffect(() => {
    if (researchResponse && !researchLoading && researchQuery) {
      const citations: string[] =
        (researchFullResponse as { citations?: string[] })?.citations ?? [];
      const result: ResearchResult = {
        query: researchQuery,
        content: researchResponse,
        citations,
        timestamp: Date.now(),
      };
      setActiveResearch(result);
      setResearchResults((prev) => [result, ...prev.slice(0, 9)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchResponse, researchLoading]);

  const handleFileSelect = (f: File) => {
    const allowed = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|txt|doc|docx)$/i)) {
      toast.error('Please upload a PDF, TXT, DOC, or DOCX file');
      return;
    }
    setFile(f);
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    if (!file) { toast.error('Please upload a document first'); return; }
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const dataUri = await fileToBase64(file);
      const isImage = file.type.startsWith('image/');
      const contentBlocks: Array<Record<string, unknown>> = [
        { type: 'text', text: buildAnalysisPrompt(file.name) },
      ];
      if (isImage) {
        contentBlocks.push({ type: 'image_url', image_url: { url: dataUri } });
      } else {
        contentBlocks.push({ type: 'file', file: { file_data: dataUri } });
      }
      sendAnalysis(
        [
          {
            role: 'system',
            content: 'You are a senior legal analyst. Always return valid JSON only — no markdown, no extra text.',
          },
          { role: 'user', content: contentBlocks },
        ],
        { temperature: 0.1, max_tokens: 2000 }
      );
    } catch {
      setIsAnalyzing(false);
      toast.error('Failed to read file. Please try again.');
    }
  };

  const handleResearch = () => {
    if (!researchQuery.trim() || researchLoading) return;
    sendResearch(
      [
        {
          role: 'system',
          content:
            'You are a legal research assistant specializing in Louisiana law and Fifth Circuit federal practice. Always cite real, verifiable authorities in proper Bluebook format.',
        },
        { role: 'user', content: buildResearchPrompt(researchQuery.trim(), researchCategory) },
      ],
      { temperature: 0.2, max_tokens: 1800 }
    );
  };

  const quickSearches = [
    'Summary judgment standard Louisiana',
    'Motion to dismiss 12(b)(6) Fifth Circuit',
    'Louisiana contract breach elements',
    'Personal injury damages Louisiana',
    'Employment discrimination burden shifting',
    'Negligence standard of care Louisiana',
  ];

  const isAnalysisLoading = isAnalyzing || analysisLoading;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-32 pb-20">
        {/* Hero */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#355E3B]/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#355E3B]">Legal Assistant Pro</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-3">
            AI-Powered Legal Document Analysis
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl">
            Upload court documents, case files, pleadings, or legal briefs for instant AI-generated summaries, key point extraction, automated case law research, and settlement value estimates.
          </p>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit mb-8 flex-wrap">
            {([
              { id: 'analyze', label: 'Document Analysis', icon: '📄' },
              { id: 'research', label: 'Case Law Research', icon: '⚖️' },
              { id: 'settlement', label: 'Settlement Estimator', icon: '💰' },
            ] as { id: ActiveTab; label: string; icon: string }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Document Analysis Tab ── */}
          {activeTab === 'analyze' && (
            <div className="grid lg:grid-cols-[420px_1fr] gap-6">
              {/* Left: Upload panel */}
              <div className="space-y-4">
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    Upload Document
                  </h2>
                  <UploadZone
                    onFileSelect={handleFileSelect}
                    file={file}
                    onClear={() => { setFile(null); setAnalysisResult(null); }}
                  />
                  <button
                    onClick={handleAnalyze}
                    disabled={!file || isAnalysisLoading}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200 bg-[#355E3B] text-white hover:bg-[#2a4a30] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnalysisLoading ? (
                      <>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Run Analysis
                      </>
                    )}
                  </button>
                </div>

                {/* Info card */}
                <div className="p-5 rounded-2xl border border-border bg-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">How It Works</h3>
                  <ul className="space-y-2.5">
                    {[
                      'Upload any legal document (PDF, TXT, DOC)',
                      'Claude AI extracts parties, dates & key points',
                      'Risk flags and obligations are identified',
                      'Results ready in seconds',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#355E3B]/10 text-[#355E3B] text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right: Results */}
              <div className="p-6 rounded-2xl border border-border bg-card min-h-[400px]">
                {isAnalysisLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#355E3B]/10 flex items-center justify-center">
                      <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Analyzing document…</p>
                      <p className="text-xs text-muted-foreground mt-1">Claude AI is extracting key legal information</p>
                    </div>
                  </div>
                ) : analysisResult ? (
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Analysis Results</h2>
                      <button
                        onClick={() => {
                          setActiveTab('research');
                          setResearchQuery(analysisResult.documentType + ' ' + (analysisResult.jurisdiction || 'Louisiana'));
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#355E3B] hover:underline"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Research this document type
                      </button>
                    </div>
                    <AnalysisCard result={analysisResult} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Upload a document to get started</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        Upload court documents, case files, pleadings, or legal briefs and get instant AI-generated summaries and key point extraction.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Case Law Research Tab ── */}
          {activeTab === 'research' && (
            <div className="grid lg:grid-cols-[380px_1fr] gap-6">
              {/* Left: Search panel */}
              <div className="space-y-4">
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    Legal Research
                  </h2>

                  {/* Category selector */}
                  <div className="grid grid-cols-2 gap-1.5 mb-4">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setResearchCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          researchCategory === cat.id
                            ? 'bg-[#355E3B] text-white'
                            : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                        }`}
                      >
                        <span aria-hidden="true">{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    placeholder="e.g. Summary judgment standard Louisiana, Motion to dismiss Fifth Circuit…"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#355E3B]/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleResearch();
                    }}
                  />
                  <button
                    onClick={handleResearch}
                    disabled={!researchQuery.trim() || researchLoading}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all duration-200 bg-[#355E3B] text-white hover:bg-[#2a4a30] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {researchLoading ? (
                      <>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Researching…
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Search Case Law
                      </>
                    )}
                  </button>
                </div>

                {/* Quick searches */}
                <div className="p-5 rounded-2xl border border-border bg-card">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Quick Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {quickSearches.map((qs) => (
                      <button
                        key={qs}
                        onClick={() => setResearchQuery(qs)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary hover:bg-[#355E3B]/10 hover:text-[#355E3B] text-muted-foreground transition-colors"
                      >
                        {qs}
                      </button>
                    ))}
                  </div>
                </div>

                {/* History */}
                {researchResults.length > 0 && (
                  <div className="p-5 rounded-2xl border border-border bg-card">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Recent Searches</h3>
                    <ul className="space-y-1.5">
                      {researchResults.map((r, i) => (
                        <li key={i}>
                          <button
                            onClick={() => setActiveResearch(r)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                              activeResearch?.timestamp === r.timestamp
                                ? 'bg-[#355E3B]/10 text-[#355E3B] font-semibold'
                                : 'text-muted-foreground hover:bg-secondary'
                            }`}
                          >
                            {r.query}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right: Research results */}
              <div className="p-6 rounded-2xl border border-border bg-card min-h-[400px]">
                {researchLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#355E3B]/10 flex items-center justify-center">
                      <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Searching case law…</p>
                      <p className="text-xs text-muted-foreground mt-1">Perplexity AI is finding relevant authorities</p>
                    </div>
                  </div>
                ) : activeResearch ? (
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Research Results</h2>
                        <p className="text-base font-semibold text-foreground">{activeResearch.query}</p>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-foreground">
                      {activeResearch.content.split('\n').map((line, i) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return (
                            <h3 key={i} className="text-sm font-bold text-foreground mt-5 mb-2 first:mt-0">
                              {line.replace(/\*\*/g, '')}
                            </h3>
                          );
                        }
                        if (line.startsWith('# ')) {
                          return <h3 key={i} className="text-sm font-bold text-foreground mt-5 mb-2 first:mt-0">{line.slice(2)}</h3>;
                        }
                        if (line.startsWith('## ')) {
                          return <h4 key={i} className="text-sm font-semibold text-foreground mt-4 mb-1.5">{line.slice(3)}</h4>;
                        }
                        if (line.startsWith('- ') || line.startsWith('• ')) {
                          return (
                            <div key={i} className="flex items-start gap-2 my-1">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#355E3B] shrink-0" aria-hidden="true" />
                              <span className="text-sm text-foreground">{line.slice(2)}</span>
                            </div>
                          );
                        }
                        if (line.trim() === '') return <div key={i} className="h-2" />;
                        return <p key={i} className="text-sm text-foreground leading-relaxed my-1">{line}</p>;
                      })}
                    </div>
                    {activeResearch.citations.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-border">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Sources</h3>
                        <ul className="space-y-1.5">
                          {activeResearch.citations.map((c, i) => (
                            <li key={i}>
                              <a
                                href={c}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#355E3B] hover:underline break-all"
                              >
                                {c}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden="true">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Enter a research query to begin</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        Search for case law, statutes, and legal precedents. Powered by Perplexity AI with real-time web search.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Settlement Estimator Tab ── */}
          {activeTab === 'settlement' && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden min-h-[600px]">
              <LexiSettlementEstimator />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
