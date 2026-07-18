'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import {
  FEDERAL_CONFLICT_AREAS,
  ALL_50_STATES_LAW_PROFILES,
  buildConflictCheckPrompt,
  type FederalConflictArea,
} from '@/lib/lexi/legalResearchProviders';

interface ConflictResult {
  topic: string;
  state: string;
  federalArea: string;
  analysis: string;
  timestamp: number;
}

interface LexiConflictCheckerProps {
  defaultState?: string;
  defaultOpen?: boolean;
}

const PREEMPTION_COLORS: Record<string, string> = {
  express: 'bg-red-100 text-red-700 border-red-200',
  field: 'bg-orange-100 text-orange-700 border-orange-200',
  conflict: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  obstacle: 'bg-blue-100 text-blue-700 border-blue-200',
};

const PREEMPTION_LABELS: Record<string, string> = {
  express: 'Express Preemption',
  field: 'Field Preemption',
  conflict: 'Conflict Preemption',
  obstacle: 'Obstacle Preemption',
};

export default function LexiConflictChecker({ defaultState = 'LA', defaultOpen = false }: LexiConflictCheckerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedState, setSelectedState] = useState(defaultState);
  const [selectedConflictArea, setSelectedConflictArea] = useState<FederalConflictArea | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [mode, setMode] = useState<'browse' | 'custom'>('browse');
  const [results, setResults] = useState<ConflictResult[]>([]);
  const [activeResult, setActiveResult] = useState<ConflictResult | null>(null);

  const { response, isLoading, error, sendMessage } = useChat(
    'PERPLEXITY',
    'perplexity/sonar-pro',
    false
  );

  const stateProfile = ALL_50_STATES_LAW_PROFILES.find(s => s.abbr === selectedState);

  // Filter conflict areas relevant to selected state
  const relevantConflicts = FEDERAL_CONFLICT_AREAS.filter(area =>
    !area.affectedStates || area.affectedStates.length === 0 || area.affectedStates.includes(selectedState)
  );

  useEffect(() => {
    if (response && !isLoading && response.length > 100) {
      const result: ConflictResult = {
        topic: selectedConflictArea?.title || customQuery,
        state: selectedState,
        federalArea: selectedConflictArea?.federalLaw || 'Custom Query',
        analysis: response,
        timestamp: Date.now(),
      };
      setActiveResult(result);
      setResults(prev => [result, ...prev.slice(0, 4)]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading]);

  const runConflictCheck = (area: FederalConflictArea) => {
    setSelectedConflictArea(area);
    setActiveResult(null);
    const stateInfo = stateProfile
      ? `${stateProfile.state} (${stateProfile.abbr}) — ${stateProfile.circuit}`
      : selectedState;
    const prompt = buildConflictCheckPrompt(
      `${stateInfo} state law on ${area.title}`,
      `${area.federalLaw} (${area.citation})`,
      area.title
    );
    sendMessage(
      [
        {
          role: 'system',
          content: 'You are Lexi, an expert legal analyst specializing in federal preemption and state-federal law conflicts. Cite only real, verifiable authorities in Bluebook format.',
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.15, max_tokens: 1800, web_search_options: { search_context_size: 'medium' } }
    );
  };

  const runCustomConflictCheck = () => {
    if (!customQuery.trim() || isLoading) return;
    setSelectedConflictArea(null);
    setActiveResult(null);
    const stateInfo = stateProfile
      ? `${stateProfile.state} (${stateProfile.abbr}) — ${stateProfile.circuit}`
      : selectedState;
    const prompt = buildConflictCheckPrompt(
      `${stateInfo} state law`,
      'Applicable federal law',
      customQuery.trim()
    );
    sendMessage(
      [
        {
          role: 'system',
          content: 'You are Lexi, an expert legal analyst specializing in federal preemption and state-federal law conflicts. Cite only real, verifiable authorities in Bluebook format.',
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.15, max_tokens: 1800, web_search_options: { search_context_size: 'medium' } }
    );
  };

  const formatContent = (text: string) => {
    return text
      .replace(/## ([^\n]+)/g, '<h3 class="text-xs font-bold text-foreground mt-3 mb-1 uppercase tracking-wide">$1</h3>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p class="mb-2 text-xs">')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500/5 to-amber-500/10 hover:from-amber-500/10 hover:to-amber-500/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <div className="text-left">
            <p className="text-xs font-semibold text-foreground">Lexi Conflict Checker</p>
            <p className="text-[10px] text-muted-foreground">State vs. Federal law — preemption & conflict analysis</p>
          </div>
          {isLoading && (
            <span className="ml-2 flex items-center gap-1 text-[10px] text-amber-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Analyzing…
            </span>
          )}
        </div>
        <span className={`text-muted-foreground text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 border-t border-border">
          {/* State Selector */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                Select State
              </label>
              <select
                value={selectedState}
                onChange={e => { setSelectedState(e.target.value); setActiveResult(null); setSelectedConflictArea(null); }}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ALL_50_STATES_LAW_PROFILES.map(s => (
                  <option key={s.abbr} value={s.abbr}>
                    {s.state} ({s.abbr}) — {s.circuit}
                  </option>
                ))}
              </select>
            </div>
            {stateProfile && (
              <div className="text-[10px] text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2 shrink-0">
                <div className="font-semibold text-foreground">{stateProfile.circuit}</div>
                <div>{stateProfile.lawTypes.length} law categories</div>
              </div>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-1">
            {[
              { id: 'browse' as const, label: '📋 Known Conflict Areas', count: relevantConflicts.length },
              { id: 'custom' as const, label: '🔍 Custom Query' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {'count' in tab && tab.count !== undefined && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${mode === tab.id ? 'bg-white/20' : 'bg-border'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Browse Mode */}
          {mode === 'browse' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {relevantConflicts.map(area => (
                <div
                  key={area.id}
                  className={`border rounded-xl p-3 transition-all ${
                    selectedConflictArea?.id === area.id
                      ? 'border-primary/50 bg-primary/5' :'border-border bg-card hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-foreground">{area.title}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${PREEMPTION_COLORS[area.preemptionType]}`}>
                          {PREEMPTION_LABELS[area.preemptionType]}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug">{area.description}</p>
                      <p className="text-[10px] text-primary font-mono mt-1">{area.citation}</p>
                      {area.affectedStates && area.affectedStates.includes(selectedState) && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-amber-600 font-medium mt-1">
                          ⚠️ Directly affects {selectedState}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => runConflictCheck(area)}
                      disabled={isLoading}
                      className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      {isLoading && selectedConflictArea?.id === area.id ? '…' : 'Analyze'}
                    </button>
                  </div>
                  {/* Common conflicts */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {area.commonStateConflicts.slice(0, 2).map((c, i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 bg-secondary/40 border border-border rounded-full text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Query Mode */}
          {mode === 'custom' && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                  Describe the conflict or legal issue
                </label>
                <textarea
                  value={customQuery}
                  onChange={e => setCustomQuery(e.target.value)}
                  placeholder={`e.g., "Does ${stateProfile?.state || selectedState} non-compete law conflict with federal antitrust law?" or "State marijuana dispensary licensing vs. federal CSA"`}
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <button
                onClick={runCustomConflictCheck}
                disabled={!customQuery.trim() || isLoading}
                className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {isLoading ? 'Analyzing conflict…' : '⚡ Run Conflict Analysis'}
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-3 py-4 px-3 bg-amber-500/5 border border-amber-200 rounded-xl">
              <div className="w-5 h-5 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Analyzing federal-state conflict…</p>
                <p className="text-[10px] text-muted-foreground">Lexi is checking preemption doctrine, case law, and circuit authority</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              Analysis failed: {error.message}
            </div>
          )}

          {/* Results */}
          {activeResult && !isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Conflict Analysis: <span className="text-primary">{activeResult.topic}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {activeResult.state} state law vs. {activeResult.federalArea}
                  </p>
                </div>
                <button
                  onClick={() => { setActiveResult(null); setSelectedConflictArea(null); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Clear ✕
                </button>
              </div>

              <div className="bg-secondary/20 border border-border rounded-xl p-3 max-h-80 overflow-y-auto">
                <div
                  className="text-xs text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: '<p class="mb-2 text-xs">' + formatContent(activeResult.analysis) + '</p>',
                  }}
                />
              </div>

              {/* Disclaimer */}
              <p className="text-[9px] text-muted-foreground italic">
                ⚖️ This analysis is for research purposes only and does not constitute legal advice. Verify all citations through official sources.
              </p>
            </div>
          )}

          {/* Recent analyses */}
          {results.length > 1 && !activeResult && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Recent analyses:</p>
              <div className="flex flex-wrap gap-1.5">
                {results.slice(1, 4).map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveResult(r)}
                    className="px-2 py-0.5 bg-secondary/40 border border-border rounded-full text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors truncate max-w-[160px]"
                    title={r.topic}
                  >
                    {r.state}: {r.topic}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
