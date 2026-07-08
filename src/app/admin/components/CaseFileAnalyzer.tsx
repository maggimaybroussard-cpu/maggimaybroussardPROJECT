'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  document_type?: string | null;
  description: string | null;
  created_at: string;
  storage_path: string | null;
}

interface AnalysisResult {
  keyDates: Array<{ date: string; description: string; significance: string }>;
  parties: Array<{ name: string; role: string; details: string }>;
  obligations: Array<{ party: string; obligation: string; deadline?: string }>;
  insights: Array<{ category: string; insight: string; priority: 'high' | 'medium' | 'low' }>;
  summary: string;
  analyzedFiles: string[];
  analyzedAt: string;
}

interface CaseFileAnalyzerProps {
  caseId: string;
  caseName: string;
  caseService: string;
  caseMessage?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fileUrlToBase64(url: string, mimeType: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  } catch {
    return null;
  }
}

function isAnalyzableFile(doc: CaseDocument): boolean {
  const type = (doc.file_type ?? '').toLowerCase();
  const name = (doc.file_name ?? '').toLowerCase();
  return (
    type === 'application/pdf' ||
    type === 'text/plain'|| type.startsWith('image/') ||
    name.endsWith('.pdf') ||
    name.endsWith('.txt') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp')
  );
}

function getMimeType(doc: CaseDocument): string {
  if (doc.file_type) return doc.file_type;
  const name = (doc.file_name ?? '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.txt')) return 'text/plain';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function getPriorityColor(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'bg-red-50 text-red-700 border-red-200';
  if (priority === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function getPriorityDot(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'bg-red-500';
  if (priority === 'medium') return 'bg-amber-500';
  return 'bg-emerald-500';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CaseFileAnalyzer({ caseId, caseName, caseService, caseMessage }: CaseFileAnalyzerProps) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeSection, setActiveSection] = useState<'summary' | 'dates' | 'parties' | 'obligations' | 'insights'>('summary');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('case_documents')
        .select('id,file_name,file_url,file_type,file_size,category,document_type,description,created_at,storage_path')
        .eq('inquiry_id', caseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const analyzable = (data || []).filter(isAnalyzableFile);
      setDocuments(analyzable);
      setSelectedDocIds(new Set(analyzable.map((d) => d.id)));
    } catch {
      toast.error('Failed to load case documents.');
    } finally {
      setLoadingDocs(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAnalyze = async () => {
    const selected = documents.filter((d) => selectedDocIds.has(d.id));
    if (selected.length === 0) {
      toast.error('Select at least one document to analyze.');
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setProgress('Preparing documents…');

    try {
      // Build multimodal content parts
      const contentParts: Array<Record<string, unknown>> = [];

      const systemPrompt = `You are a legal AI assistant specializing in case analysis for Broussard Legal Services. 
Analyze the provided case documents and extract structured information. 
Return ONLY valid JSON matching the exact schema provided. Do not include markdown code blocks or extra text.`;

      const userPromptText = `Analyze the following case documents for:
- Case: ${caseName}
- Service: ${caseService}
${caseMessage ? `- Matter Description: ${caseMessage}` : ''}

Extract and return a JSON object with this exact structure:
{
  "keyDates": [{ "date": "YYYY-MM-DD or descriptive", "description": "what happened", "significance": "why it matters" }],
  "parties": [{ "name": "party name", "role": "role in case (plaintiff/defendant/counsel/witness/etc)", "details": "relevant details" }],
  "obligations": [{ "party": "who", "obligation": "what they must do", "deadline": "when (if specified)" }],
  "insights": [{ "category": "category name", "insight": "actionable insight or risk", "priority": "high|medium|low" }],
  "summary": "2-3 sentence executive summary of the case based on the documents"
}

Focus on: deadlines, court dates, contract terms, payment obligations, key parties, legal risks, statute of limitations, and any time-sensitive matters.`;

      contentParts.push({ type: 'text', text: userPromptText });

      // Fetch and attach each selected document
      let attachedCount = 0;
      for (const doc of selected) {
        setProgress(`Loading document ${attachedCount + 1} of ${selected.length}: ${doc.file_name}…`);
        const mime = getMimeType(doc);
        const base64 = await fileUrlToBase64(doc.file_url, mime);
        if (!base64) continue;

        if (mime.startsWith('image/')) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: base64 },
          });
        } else {
          contentParts.push({
            type: 'file',
            file: { file_data: base64 },
          });
        }
        attachedCount++;
      }

      if (attachedCount === 0) {
        toast.error('Could not load any documents for analysis. Check file URLs.');
        setAnalyzing(false);
        setProgress('');
        return;
      }

      setProgress(`Analyzing ${attachedCount} document${attachedCount !== 1 ? 's' : ''} with Gemini…`);

      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-2.5-flash',
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contentParts as unknown as string },
        ],
        {
          temperature: 0.2,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }
      );

      const rawContent = response?.choices?.[0]?.message?.content ?? '';
      let parsed: Omit<AnalysisResult, 'analyzedFiles' | 'analyzedAt'>;
      try {
        // Strip markdown code fences if present
        const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        toast.error('Gemini returned an unexpected format. Try again.');
        setAnalyzing(false);
        setProgress('');
        return;
      }

      setResult({
        ...parsed,
        keyDates: parsed.keyDates ?? [],
        parties: parsed.parties ?? [],
        obligations: parsed.obligations ?? [],
        insights: parsed.insights ?? [],
        summary: parsed.summary ?? '',
        analyzedFiles: selected.map((d) => d.file_name),
        analyzedAt: new Date().toISOString(),
      });
      setActiveSection('summary');
      toast.success('Analysis complete.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
      setProgress('');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingDocs) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-border border-t-foreground animate-spin shrink-0" />
        <p className="text-sm text-muted-foreground">Loading case documents…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Document Selector */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Gemini Case File Analyzer</h3>
              <p className="text-[11px] text-muted-foreground">Auto-extract key dates, parties, obligations &amp; insights</p>
            </div>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || selectedDocIds.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: analyzing ? '#6B7280' : '#355E3B' }}
          >
            {analyzing ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Analyzing…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Analyze {selectedDocIds.size} File{selectedDocIds.size !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>

        {analyzing && progress && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-secondary/60 mb-4">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-border border-t-foreground animate-spin shrink-0" />
            <p className="text-xs text-muted-foreground">{progress}</p>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center mx-auto mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No analyzable documents found.</p>
            <p className="text-xs text-muted-foreground mt-1">Upload PDF, TXT, or image files in the Documents tab.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                Select files to analyze ({selectedDocIds.size}/{documents.length})
              </p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedDocIds(new Set(documents.map((d) => d.id)))}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">All</button>
                <span className="text-[11px] text-muted-foreground">·</span>
                <button onClick={() => setSelectedDocIds(new Set())}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">None</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {documents.map((doc) => {
                const selected = selectedDocIds.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-foreground/30 bg-foreground/5'
                        : 'border-border bg-background hover:border-foreground/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                      selected ? 'border-foreground bg-foreground' : 'border-border bg-background'
                    }`}>
                      {selected && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{doc.document_type ?? doc.category ?? 'document'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Analysis Results */}
      {result && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Results Header */}
          <div className="px-5 py-4 border-b border-border" style={{ background: 'rgba(53,94,59,0.04)' }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-semibold text-foreground">Analysis Complete</p>
                <span className="text-[10px] text-muted-foreground">· {result.analyzedFiles.length} file{result.analyzedFiles.length !== 1 ? 's' : ''} · {formatDate(result.analyzedAt)}</span>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.51" />
                </svg>
                Re-analyze
              </button>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex items-center gap-1 px-5 py-3 border-b border-border overflow-x-auto">
            {([
              { id: 'summary', label: 'Summary', count: undefined },
              { id: 'dates', label: 'Key Dates', count: result.keyDates.length },
              { id: 'parties', label: 'Parties', count: result.parties.length },
              { id: 'obligations', label: 'Obligations', count: result.obligations.length },
              { id: 'insights', label: 'Insights', count: result.insights.length },
            ] as Array<{ id: typeof activeSection; label: string; count?: number }>).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                  activeSection === tab.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                    activeSection === tab.id ? 'bg-background/20 text-background' : 'bg-foreground/10 text-foreground'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Section Content */}
          <div className="p-5">
            {/* Summary */}
            {activeSection === 'summary' && (
              <div className="space-y-4">
                <div className="px-4 py-3.5 rounded-xl bg-secondary/40 border border-border">
                  <p className="text-sm text-foreground leading-relaxed">{result.summary || 'No summary generated.'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Analyzed Files</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.analyzedFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/60 border border-border text-[11px] text-muted-foreground">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Key Dates', value: result.keyDates.length, icon: '📅' },
                    { label: 'Parties', value: result.parties.length, icon: '👥' },
                    { label: 'Obligations', value: result.obligations.length, icon: '⚖️' },
                    { label: 'Insights', value: result.insights.length, icon: '💡' },
                  ].map((s) => (
                    <div key={s.label} className="bg-background border border-border rounded-xl px-3.5 py-3 text-center">
                      <p className="text-lg mb-0.5">{s.icon}</p>
                      <p className="text-lg font-bold text-foreground">{s.value}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Dates */}
            {activeSection === 'dates' && (
              <div className="space-y-3">
                {result.keyDates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No key dates extracted.</p>
                ) : (
                  result.keyDates.map((item, i) => (
                    <div key={i} className="flex gap-3 p-3.5 rounded-xl border border-border bg-background">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 border border-blue-100">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-xs font-bold text-foreground">{item.date}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">{item.description}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.significance}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Parties */}
            {activeSection === 'parties' && (
              <div className="space-y-3">
                {result.parties.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No parties extracted.</p>
                ) : (
                  result.parties.map((item, i) => (
                    <div key={i} className="flex gap-3 p-3.5 rounded-xl border border-border bg-background">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-purple-50 border border-purple-100">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-xs font-bold text-foreground">{item.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 font-medium capitalize">{item.role}</span>
                        </div>
                        {item.details && <p className="text-xs text-muted-foreground leading-relaxed">{item.details}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Obligations */}
            {activeSection === 'obligations' && (
              <div className="space-y-3">
                {result.obligations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No obligations extracted.</p>
                ) : (
                  result.obligations.map((item, i) => (
                    <div key={i} className="flex gap-3 p-3.5 rounded-xl border border-border bg-background">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-50 border border-amber-100">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium">{item.party}</span>
                          {item.deadline && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100 font-medium">Due: {item.deadline}</span>
                          )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{item.obligation}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Insights */}
            {activeSection === 'insights' && (
              <div className="space-y-3">
                {result.insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No insights extracted.</p>
                ) : (
                  result.insights.map((item, i) => (
                    <div key={i} className="flex gap-3 p-3.5 rounded-xl border border-border bg-background">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        item.priority === 'high' ? 'bg-red-50 border-red-100' :
                        item.priority === 'medium'? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
                      }`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={
                          item.priority === 'high' ? '#DC2626' :
                          item.priority === 'medium' ? '#D97706' : '#059669'
                        } strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{item.category}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-widest ${getPriorityColor(item.priority)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getPriorityDot(item.priority)}`} />
                            {item.priority}
                          </span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{item.insight}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
