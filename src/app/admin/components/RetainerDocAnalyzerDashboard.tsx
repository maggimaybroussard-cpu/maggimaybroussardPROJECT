'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  documentType: string;
  scope: string;
  estimatedHours: string;
  deadlines: Array<{ date: string; description: string; urgent: boolean }>;
  opposingCounsel: Array<{ name: string; firm: string; contact: string }>;
  actionItems: Array<{ item: string; priority: 'urgent' | 'high' | 'medium' | 'low'; dueDate: string | null }>;
  keyTerms: string[];
  clientName: string;
  matterType: string;
  summary: string;
}

interface SavedAnalysis {
  id: string;
  fileName: string;
  analyzedAt: string;
  result: AnalysisResult;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority] ?? PRIORITY_DOT.low}`} />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
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

const SYSTEM_PROMPT = `You are a senior legal analyst AI. When given a legal document (retainer agreement, case summary, or legal filing), extract and return a JSON object with EXACTLY this structure:
{
  "documentType": "string (e.g. Retainer Agreement, Case Summary, Motion, etc.)",
  "scope": "string (detailed description of legal scope and services covered)",
  "estimatedHours": "string (e.g. '40-60 hours' or 'Not specified')",
  "deadlines": [{"date": "string (ISO or readable date)", "description": "string", "urgent": boolean}],
  "opposingCounsel": [{"name": "string", "firm": "string", "contact": "string or empty"}],
  "actionItems": [{"item": "string", "priority": "urgent|high|medium|low", "dueDate": "string or null"}],
  "keyTerms": ["array of important legal terms, clauses, or conditions"],
  "clientName": "string (client name or 'Not identified')",
  "matterType": "string (e.g. Civil Litigation, Family Law, Business, etc.)",
  "summary": "string (2-3 sentence executive summary)"
}
Mark action items as 'urgent' if they have deadlines within 7 days or involve court filings, statute of limitations, or immediate legal obligations. Return ONLY valid JSON, no markdown.`;

// ── Main Component ────────────────────────────────────────────────────────────

export default function RetainerDocAnalyzerDashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [activeSection, setActiveSection] = useState<string>('summary');
  const [selectedSaved, setSelectedSaved] = useState<SavedAnalysis | null>(null);
  const [rawText, setRawText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, isLoading, error } = useChat('OPEN_AI', 'gpt-4o', false);
  const [aiResponse, setAiResponse] = useState<string>('');

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  // Load saved analyses from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('retainer_doc_analyses');
      if (saved) setSavedAnalyses(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const fileToText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const handleFile = useCallback((file: File) => {
    const allowed = ['application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
      toast.error('Supported formats: PDF, TXT, DOC, DOCX');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20 MB');
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setSelectedSaved(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (inputMode === 'file' && !selectedFile) return;
    if (inputMode === 'text' && !rawText.trim()) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      let content: any[];

      if (inputMode === 'text') {
        content = [{ type: 'text', text: `Analyze this legal document:\n\n${rawText}` }];
      } else if (selectedFile!.type === 'text/plain') {
        const text = await fileToText(selectedFile!);
        content = [{ type: 'text', text: `Analyze this legal document:\n\n${text}` }];
      } else {
        const base64 = await fileToBase64(selectedFile!);
        content = [
          { type: 'text', text: 'Analyze this legal document and extract all required information:' },
          { type: 'file', file: { file_data: base64, filename: selectedFile!.name } },
        ];
      }

      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ];

      // Use direct fetch to the AI route for structured output
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'OPEN_AI',
          model: 'gpt-4o',
          messages,
          stream: false,
          parameters: { max_completion_tokens: 2000 },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed');

      const rawContent = data.choices?.[0]?.message?.content ?? '';
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: AnalysisResult = JSON.parse(cleaned);
      setResult(parsed);
      setActiveSection('summary');

      // Save to localStorage
      const newEntry: SavedAnalysis = {
        id: Date.now().toString(),
        fileName: inputMode === 'file' ? selectedFile!.name : 'Pasted Text',
        analyzedAt: new Date().toISOString(),
        result: parsed,
      };
      const updated = [newEntry, ...savedAnalyses].slice(0, 20);
      setSavedAnalyses(updated);
      localStorage.setItem('retainer_doc_analyses', JSON.stringify(updated));
      toast.success('Document analyzed successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const urgentCount = result
    ? result.actionItems.filter((a) => a.priority === 'urgent').length +
      result.deadlines.filter((d) => d.urgent).length
    : 0;

  const displayResult = selectedSaved?.result ?? result;
  const displayFileName = selectedSaved?.fileName ?? selectedFile?.name ?? 'Pasted Text';

  const sections = displayResult ? [
    { id: 'summary', label: 'Overview' },
    { id: 'actions', label: `Action Items (${displayResult.actionItems.length})` },
    { id: 'deadlines', label: `Deadlines (${displayResult.deadlines.length})` },
    { id: 'counsel', label: `Opposing Counsel (${displayResult.opposingCounsel.length})` },
    { id: 'terms', label: `Key Terms (${displayResult.keyTerms.length})` },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif text-foreground">Retainer & Case Document Analyzer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload retainer agreements or case summaries — AI extracts scope, deadlines, opposing counsel, estimated hours, and flags urgent action items.
          </p>
        </div>
        {urgentCount > 0 && !selectedSaved && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-700">{urgentCount} Urgent Item{urgentCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + History */}
        <div className="space-y-4">
          {/* Input Mode Toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden bg-secondary/30">
            {(['file', 'text'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex-1 py-2 text-xs font-semibold transition-all ${
                  inputMode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'file' ? '📎 Upload File' : '✏️ Paste Text'}
              </button>
            ))}
          </div>

          {inputMode === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              {selectedFile ? (
                <div>
                  <p className="text-sm font-semibold text-foreground truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-foreground">Drop file or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, TXT, DOC, DOCX · Max 20 MB</p>
                </div>
              )}
            </div>
          ) : (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste retainer agreement or case summary text here..."
              rows={8}
              className="w-full border border-border rounded-xl p-3 text-sm text-foreground bg-card resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
          )}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (inputMode === 'file' ? !selectedFile : !rawText.trim())}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Analyzing Document…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Analyze with AI
              </>
            )}
          </button>

          {/* Saved Analyses */}
          {savedAnalyses.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recent Analyses</p>
              </div>
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {savedAnalyses.map((s) => {
                  const urgents = s.result.actionItems.filter((a) => a.priority === 'urgent').length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSaved(s); setResult(null); setActiveSection('summary'); }}
                      className={`w-full text-left px-4 py-3 hover:bg-secondary/30 transition-all ${selectedSaved?.id === s.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{s.fileName}</p>
                        {urgents > 0 && (
                          <span className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                            {urgents} urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.result.matterType} · {new Date(s.analyzedAt).toLocaleDateString()}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {!displayResult && !isAnalyzing && (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground">No document analyzed yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">Upload a retainer agreement or case summary to extract scope, deadlines, opposing counsel, and flag urgent action items.</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="h-full min-h-64 flex flex-col items-center justify-center text-center p-8 border border-border rounded-xl bg-card">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground">Analyzing document…</p>
              <p className="text-xs text-muted-foreground mt-1">Extracting scope, deadlines, opposing counsel, and action items</p>
            </div>
          )}

          {displayResult && (
            <div className="space-y-4">
              {/* File + doc type header */}
              <div className="flex items-center justify-between gap-3 p-4 bg-card border border-border rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{displayFileName}</p>
                    <p className="text-xs text-muted-foreground">{displayResult.documentType} · {displayResult.matterType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {displayResult.actionItems.filter((a) => a.priority === 'urgent').length > 0 && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-semibold text-red-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      {displayResult.actionItems.filter((a) => a.priority === 'urgent').length} Urgent
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-primary/10 rounded-full text-xs font-semibold text-primary">
                    ~{displayResult.estimatedHours}
                  </span>
                </div>
              </div>

              {/* Section Tabs */}
              <div className="flex gap-1 flex-wrap">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeSection === s.id
                        ? 'bg-primary text-white' :'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Section Content */}
              {activeSection === 'summary' && (
                <div className="space-y-4">
                  <SectionCard
                    title="Executive Summary"
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  >
                    <p className="text-sm text-gray-700 leading-relaxed">{displayResult.summary}</p>
                  </SectionCard>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Client</p>
                      <p className="text-sm font-semibold text-gray-800">{displayResult.clientName}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Estimated Hours</p>
                      <p className="text-sm font-semibold text-gray-800">{displayResult.estimatedHours}</p>
                    </div>
                  </div>
                  <SectionCard
                    title="Scope of Representation"
                    icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                  >
                    <p className="text-sm text-gray-700 leading-relaxed">{displayResult.scope}</p>
                  </SectionCard>
                </div>
              )}

              {activeSection === 'actions' && (
                <SectionCard
                  title="Action Items"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
                  count={displayResult.actionItems.length}
                >
                  {displayResult.actionItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No action items identified.</p>
                  ) : (
                    <div className="space-y-3">
                      {displayResult.actionItems
                        .sort((a, b) => {
                          const order = { urgent: 0, high: 1, medium: 2, low: 3 };
                          return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
                        })
                        .map((item, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${item.priority === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                            <PriorityBadge priority={item.priority} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800">{item.item}</p>
                              {item.dueDate && (
                                <p className="text-xs text-gray-500 mt-0.5">Due: {item.dueDate}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </SectionCard>
              )}

              {activeSection === 'deadlines' && (
                <SectionCard
                  title="Key Deadlines"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                  count={displayResult.deadlines.length}
                >
                  {displayResult.deadlines.length === 0 ? (
                    <p className="text-sm text-gray-500">No deadlines identified.</p>
                  ) : (
                    <div className="space-y-3">
                      {displayResult.deadlines.map((d, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${d.urgent ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${d.urgent ? 'bg-red-100' : 'bg-gray-100'}`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={d.urgent ? 'text-red-600' : 'text-gray-500'}>
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800">{d.date}</p>
                              {d.urgent && <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Urgent</span>}
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">{d.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )}

              {activeSection === 'counsel' && (
                <SectionCard
                  title="Opposing Counsel"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  count={displayResult.opposingCounsel.length}
                >
                  {displayResult.opposingCounsel.length === 0 ? (
                    <p className="text-sm text-gray-500">No opposing counsel identified.</p>
                  ) : (
                    <div className="space-y-3">
                      {displayResult.opposingCounsel.map((c, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{c.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                            {c.firm && <p className="text-xs text-gray-600">{c.firm}</p>}
                            {c.contact && <p className="text-xs text-gray-500 mt-0.5">{c.contact}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )}

              {activeSection === 'terms' && (
                <SectionCard
                  title="Key Terms & Clauses"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                  count={displayResult.keyTerms.length}
                >
                  {displayResult.keyTerms.length === 0 ? (
                    <p className="text-sm text-gray-500">No key terms identified.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {displayResult.keyTerms.map((term, i) => (
                        <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
