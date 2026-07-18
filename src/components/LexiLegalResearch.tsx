'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';
import LexiVoiceIntake from '@/components/LexiVoiceIntake';

// ── Types ─────────────────────────────────────────────────────────────────────

type ResearchCategory = 'case_law' | 'statutes' | 'precedent' | 'federal' | 'all';
type DataSource = 'perplexity' | 'courtlistener' | 'ecfr' | 'openstates' | 'la_legislature' | 'govinfo' | 'case_law_links' | 'openai_research' | 'claude_drafting' | 'gemini_docs' | 'notion_kb' | 'voice_intake';

type OpenAIMode = 'case_law' | 'statute_lookup' | 'brief_generation';
type PerplexityMode = 'case_law' | 'statute_lookup' | 'brief_generation';

interface OpenAIResearchResult {
  mode: OpenAIMode;
  query: string;
  content: string;
  timestamp: number;
}

interface SearchResult {
  query: string;
  content: string;
  citations: string[];
  searchResults: Array<{ url: string; title: string; snippet?: string }>;
  timestamp: number;
}

interface LiveDataResult {
  source: string;
  query: string;
  results?: any[];
  bills?: any[];
  count?: number;
  searchLinks?: Array<{ source: string; url: string; description?: string }>;
  courtListenerResults?: any[];
  note?: string;
}

interface LexiLegalResearchProps {
  context?: string;
  onInsertCitation?: (citation: string) => void;
  defaultOpen?: boolean;
}

// ── All 50 States ─────────────────────────────────────────────────────────────

const ALL_STATES = [
  { code: 'AL', name: 'Alabama', citation: 'Ala. Code' },
  { code: 'AK', name: 'Alaska', citation: 'AS' },
  { code: 'AZ', name: 'Arizona', citation: 'A.R.S.' },
  { code: 'AR', name: 'Arkansas', citation: 'Ark. Code Ann.' },
  { code: 'CA', name: 'California', citation: 'Cal. [Code]' },
  { code: 'CO', name: 'Colorado', citation: 'C.R.S.' },
  { code: 'CT', name: 'Connecticut', citation: 'Conn. Gen. Stat.' },
  { code: 'DE', name: 'Delaware', citation: 'Del. Code Ann.' },
  { code: 'FL', name: 'Florida', citation: 'Fla. Stat.' },
  { code: 'GA', name: 'Georgia', citation: 'O.C.G.A.' },
  { code: 'HI', name: 'Hawaii', citation: 'H.R.S.' },
  { code: 'ID', name: 'Idaho', citation: 'Idaho Code' },
  { code: 'IL', name: 'Illinois', citation: 'ILCS' },
  { code: 'IN', name: 'Indiana', citation: 'Ind. Code' },
  { code: 'IA', name: 'Iowa', citation: 'Iowa Code' },
  { code: 'KS', name: 'Kansas', citation: 'K.S.A.' },
  { code: 'KY', name: 'Kentucky', citation: 'KRS' },
  { code: 'LA', name: 'Louisiana', citation: 'La. R.S.' },
  { code: 'ME', name: 'Maine', citation: 'M.R.S.A.' },
  { code: 'MD', name: 'Maryland', citation: 'Md. Code Ann.' },
  { code: 'MA', name: 'Massachusetts', citation: 'M.G.L.' },
  { code: 'MI', name: 'Michigan', citation: 'MCL' },
  { code: 'MN', name: 'Minnesota', citation: 'Minn. Stat.' },
  { code: 'MS', name: 'Mississippi', citation: 'Miss. Code Ann.' },
  { code: 'MO', name: 'Missouri', citation: 'Mo. Rev. Stat.' },
  { code: 'MT', name: 'Montana', citation: 'MCA' },
  { code: 'NE', name: 'Nebraska', citation: 'Neb. Rev. Stat.' },
  { code: 'NV', name: 'Nevada', citation: 'NRS' },
  { code: 'NH', name: 'New Hampshire', citation: 'RSA' },
  { code: 'NJ', name: 'New Jersey', citation: 'N.J.S.A.' },
  { code: 'NM', name: 'New Mexico', citation: 'NMSA' },
  { code: 'NY', name: 'New York', citation: 'N.Y. [Law]' },
  { code: 'NC', name: 'North Carolina', citation: 'N.C. Gen. Stat.' },
  { code: 'ND', name: 'North Dakota', citation: 'N.D.C.C.' },
  { code: 'OH', name: 'Ohio', citation: 'ORC' },
  { code: 'OK', name: 'Oklahoma', citation: 'Okla. Stat.' },
  { code: 'OR', name: 'Oregon', citation: 'ORS' },
  { code: 'PA', name: 'Pennsylvania', citation: 'Pa. C.S.' },
  { code: 'RI', name: 'Rhode Island', citation: 'R.I. Gen. Laws' },
  { code: 'SC', name: 'South Carolina', citation: 'S.C. Code Ann.' },
  { code: 'SD', name: 'South Dakota', citation: 'SDCL' },
  { code: 'TN', name: 'Tennessee', citation: 'Tenn. Code Ann.' },
  { code: 'TX', name: 'Texas', citation: 'Tex. [Code]' },
  { code: 'UT', name: 'Utah', citation: 'Utah Code' },
  { code: 'VT', name: 'Vermont', citation: 'V.S.A.' },
  { code: 'VA', name: 'Virginia', citation: 'Va. Code Ann.' },
  { code: 'WA', name: 'Washington', citation: 'RCW' },
  { code: 'WV', name: 'West Virginia', citation: 'W. Va. Code' },
  { code: 'WI', name: 'Wisconsin', citation: 'Wis. Stat.' },
  { code: 'WY', name: 'Wyoming', citation: 'Wyo. Stat. Ann.' },
];

const PRACTICE_AREAS = [
  'Personal Injury / Tort',
  'Contract Law',
  'Employment Law',
  'Family Law / Divorce',
  'Criminal Law',
  'Real Estate / Property',
  'Landlord-Tenant',
  'Business / Corporate',
  'Bankruptcy',
  'Immigration',
  'Intellectual Property',
  'Estate Planning / Probate',
  'Workers Compensation',
  'Tax Law',
  'Civil Rights',
  'Environmental Law',
  'Securities Law',
  'Administrative Law',
  'Federal Civil Procedure',
  'Constitutional Law',
];

const CATEGORY_OPTIONS: Array<{ id: ResearchCategory; label: string; icon: string; hint: string }> = [
  { id: 'case_law', label: 'Case Law', icon: '⚖️', hint: 'Search federal and state court decisions' },
  { id: 'statutes', label: 'Statutes & Codes', icon: '📚', hint: 'Search federal and state statutes' },
  { id: 'precedent', label: 'Precedent', icon: '🏛️', hint: 'Find controlling and persuasive authority' },
  { id: 'federal', label: 'Federal Law', icon: '🇺🇸', hint: 'FRCP, FRE, U.S.C., CFR, federal regulations' },
  { id: 'all', label: 'All Sources', icon: '🔍', hint: 'Comprehensive research across all sources' },
];

const OPENAI_MODE_OPTIONS: Array<{ id: OpenAIMode; label: string; icon: string; description: string; placeholder: string }> = [
  {
    id: 'case_law',
    label: 'Case Law Analysis',
    icon: '⚖️',
    description: 'Analyze relevant case law, identify holdings, and extract key precedents',
    placeholder: 'e.g. "Analyze negligence per se doctrine in Louisiana personal injury cases" or "Find Fifth Circuit cases on summary judgment standards"',
  },
  {
    id: 'statute_lookup',
    label: 'Statute Lookup',
    icon: '📖',
    description: 'Look up and interpret statutes, codes, and regulations with plain-language explanations',
    placeholder: 'e.g. "Louisiana R.S. 9:2800 premises liability" or "FLSA overtime exemptions 29 U.S.C. § 207"',
  },
  {
    id: 'brief_generation',
    label: 'Brief Generation',
    icon: '📝',
    description: 'Generate legal argument outlines, motion sections, or intake summaries',
    placeholder: 'e.g. "Draft argument section for motion to dismiss lack of personal jurisdiction" or "Summarize intake facts for breach of contract matter"',
  },
];

const OPENAI_QUICK_PROMPTS: Record<OpenAIMode, string[]> = {
  case_law: [
    'Louisiana negligence per se doctrine',
    'Fifth Circuit summary judgment standard',
    'Louisiana comparative fault allocation',
    'Employment discrimination McDonnell Douglas burden shifting',
    'Louisiana breach of contract damages',
    'Personal injury causation Louisiana',
  ],
  statute_lookup: [
    'Louisiana R.S. 9:2800 premises liability',
    'La. C.C. Art. 2315 tort liability',
    'FLSA overtime exemptions 29 U.S.C. § 207',
    'Title VII 42 U.S.C. § 2000e discrimination',
    'Louisiana workers comp La. R.S. 23:1021',
    'ADA reasonable accommodation 42 U.S.C. § 12112',
  ],
  brief_generation: [
    'Motion to dismiss 12(b)(6) argument section',
    'Summary judgment no genuine dispute of fact',
    'Intake summary breach of contract matter',
    'Opposition to motion to compel discovery',
    'Demand letter personal injury settlement',
    'Retainer agreement scope of services clause',
  ],
};

// ── Perplexity Research Modes ─────────────────────────────────────────────────

const PERPLEXITY_MODE_OPTIONS: Array<{ id: PerplexityMode; label: string; icon: string; description: string; placeholder: string; model: string }> = [
  {
    id: 'case_law',
    label: 'Case Law',
    icon: '⚖️',
    description: 'Real-time case law search — live court opinions, holdings, and circuit precedents via web',
    placeholder: 'e.g. "Louisiana negligence per se Fifth Circuit 2024" or "summary judgment standard recent cases"',
    model: 'perplexity/sonar-pro',
  },
  {
    id: 'statute_lookup',
    label: 'Statute Lookup',
    icon: '📖',
    description: 'Live statute & regulation lookup — current text, recent amendments, and regulatory updates',
    placeholder: 'e.g. "Louisiana R.S. 9:2800 premises liability current text" or "FLSA overtime 29 U.S.C. § 207 2024"',
    model: 'perplexity/sonar-pro',
  },
  {
    id: 'brief_generation',
    label: 'Brief Generation',
    icon: '📝',
    description: 'Deep research brief — comprehensive argument outlines with live-sourced citations and current law',
    placeholder: 'e.g. "Draft argument for motion to dismiss personal jurisdiction Louisiana" or "Brief section on FMLA interference claim elements"',
    model: 'perplexity/sonar-deep-research',
  },
];

const PERPLEXITY_QUICK_PROMPTS: Record<PerplexityMode, string[]> = {
  case_law: [
    'Louisiana negligence per se 2024',
    'Fifth Circuit summary judgment recent',
    'Louisiana comparative fault allocation cases',
    'Employment discrimination McDonnell Douglas 2024',
    'Louisiana breach of contract damages recent',
    'Personal injury causation Louisiana Fifth Circuit',
  ],
  statute_lookup: [
    'Louisiana R.S. 9:2800 premises liability',
    'La. C.C. Art. 2315 current text',
    'FLSA overtime exemptions 29 U.S.C. § 207',
    'Title VII 42 U.S.C. § 2000e current',
    'Louisiana workers comp La. R.S. 23:1021',
    'ADA reasonable accommodation 42 U.S.C. § 12112',
  ],
  brief_generation: [
    'Motion to dismiss 12(b)(6) Louisiana',
    'Summary judgment no genuine dispute',
    'Opposition to motion to compel discovery',
    'Demand letter personal injury Louisiana',
    'FMLA interference claim elements brief',
    'Title VII hostile work environment argument',
  ],
};

function buildPerplexityPrompt(
  query: string,
  mode: PerplexityMode,
  context?: string,
  selectedState?: string,
  practiceArea?: string
): string {
  const stateCtx = selectedState ? `\nPRIMARY JURISDICTION: ${selectedState}` : '';
  const practiceCtx = practiceArea ? `\nPRACTICE AREA: ${practiceArea}` : '';
  const matterCtx = context ? `\nMATTER CONTEXT: ${context}` : '';

  if (mode === 'case_law') {
    return `You are Lexi, a legal research assistant at Broussard Legal Services. Search for and analyze current case law on the following topic using real-time web sources.

RESEARCH QUERY: ${query}${stateCtx}${practiceCtx}${matterCtx}

Search legal databases, court websites, and legal research platforms to provide:

1. **OVERVIEW** — Current state of the law on this issue (2-3 sentences with sources)

2. **KEY CASES** — Most important recent and landmark cases with:
   - Full case name and Bluebook citation
   - Court, year, and docket number if available
   - Key holding (1-2 sentences)
   - Direct link or source where available

3. **CONTROLLING AUTHORITY** — Binding precedent in the relevant jurisdiction

4. **RECENT DEVELOPMENTS** — Cases from 2022-2025, including any circuit splits or emerging trends

5. **PRACTICAL APPLICATION** — How to use this case law in practice

Cite only real, verifiable cases. Include source URLs where available. Use proper Bluebook format.`;
  }

  if (mode === 'statute_lookup') {
    return `You are Lexi, a legal research assistant at Broussard Legal Services. Look up the current, live text of the following statute or regulation using real-time web sources.

LOOKUP QUERY: ${query}${stateCtx}${practiceCtx}${matterCtx}

Search official government websites (congress.gov, ecfr.gov, legis.la.gov, state legislature sites) to provide:

1. **CURRENT STATUTE TEXT** — The current, in-force text of the statute with full citation

2. **RECENT AMENDMENTS** — Any amendments or updates in the last 3 years with effective dates

3. **PLAIN LANGUAGE SUMMARY** — What the statute means in plain English

4. **KEY ELEMENTS** — Required elements for any cause of action or defense

5. **EXCEPTIONS & DEFENSES** — Statutory exceptions, safe harbors, or affirmative defenses

6. **RELATED REGULATIONS** — Implementing regulations or related code sections

7. **RECENT CASE LAW** — 2-3 recent cases interpreting this statute (with citations and sources)

8. **OFFICIAL SOURCE LINK** — Direct URL to the official statute text

Use proper Bluebook citations. Prioritize official government sources.`;
  }

  // brief_generation — uses sonar-deep-research
  return `You are Lexi, a legal research assistant at Broussard Legal Services. Conduct deep research and generate a comprehensive legal brief section on the following topic using real-time web sources.

BRIEF REQUEST: ${query}${stateCtx}${practiceCtx}${matterCtx}

Conduct thorough research across legal databases, court opinions, and official sources to generate:

1. **DOCUMENT TYPE & STRATEGIC PURPOSE** — What this document is and its litigation strategy

2. **APPLICABLE LEGAL STANDARD** — The controlling legal standard with current citations and sources

3. **ARGUMENT SECTION** — Structured legal argument with:
   - Main thesis statement
   - Supporting case law (Bluebook citations + source links)
   - Statutory authority
   - Application to facts (use [PLACEHOLDER] where case-specific facts needed)
   - Anticipated counterarguments and responses

4. **SUPPORTING AUTHORITIES** — Table of authorities with full Bluebook citations

5. **CONCLUSION** — Requested relief or summary

6. **RESEARCH SOURCES** — URLs to primary sources used

Format as a professional legal document. Cite only real, verifiable authorities with source links where available.`;
}

function buildOpenAIPrompt(query: string, mode: OpenAIMode, context?: string, selectedState?: string, practiceArea?: string): string {
  const stateCtx = selectedState ? `\nPRIMARY JURISDICTION: ${selectedState}` : '';
  const practiceCtx = practiceArea ? `\nPRACTICE AREA: ${practiceArea}` : '';
  const matterCtx = context ? `\nMATTER CONTEXT: ${context}` : '';

  if (mode === 'case_law') {
    return `You are Lexi, a highly experienced legal research assistant at Broussard Legal Services. Conduct a thorough case law analysis on the following topic.

RESEARCH QUERY: ${query}${stateCtx}${practiceCtx}${matterCtx}

Provide a structured case law analysis with:

1. **OVERVIEW** — Brief summary of the legal issue and controlling doctrine (2-3 sentences)

2. **LANDMARK CASES** — List 3-5 most important cases with:
   - Full case name and Bluebook citation
   - Court and year
   - Key holding (1-2 sentences)
   - Relevance to the query

3. **CONTROLLING AUTHORITY** — Identify binding precedent in the relevant jurisdiction

4. **CIRCUIT/STATE SPLIT** (if applicable) — Note any disagreements between courts

5. **RECENT DEVELOPMENTS** — Notable cases from the last 5 years

6. **PRACTICAL APPLICATION** — How to use this case law in practice

Use proper Bluebook citations. Cite only real, verifiable cases.`;
  }

  if (mode === 'statute_lookup') {
    return `You are Lexi, a highly experienced legal research assistant at Broussard Legal Services. Look up and interpret the following statute or legal provision.

LOOKUP QUERY: ${query}${stateCtx}${practiceCtx}${matterCtx}

Provide a structured statute analysis with:

1. **STATUTE IDENTIFICATION** — Full citation, title, and current status (in effect / amended / repealed)

2. **PLAIN LANGUAGE SUMMARY** — What the statute says in plain English (2-3 sentences)

3. **KEY PROVISIONS** — List the most important subsections with their requirements or prohibitions

4. **ELEMENTS / REQUIREMENTS** — If it creates a cause of action or defense, list all required elements

5. **EXCEPTIONS & DEFENSES** — Statutory exceptions, safe harbors, or affirmative defenses

6. **RELATED STATUTES & REGULATIONS** — Cross-references to related code sections or CFR provisions

7. **CASE LAW INTERPRETING THIS STATUTE** — 2-3 key cases that have interpreted or applied this statute

8. **PRACTICAL NOTES** — Filing deadlines, notice requirements, or procedural traps

Use proper Bluebook citations throughout.`;
  }

  // brief_generation
  return `You are Lexi, a highly experienced legal research assistant at Broussard Legal Services. Generate a professional legal brief section or document based on the following request.

BRIEF REQUEST: ${query}${stateCtx}${practiceCtx}${matterCtx}

Generate a well-structured legal document with:

1. **DOCUMENT TYPE & PURPOSE** — Identify what this document is and its strategic purpose

2. **STATEMENT OF FACTS** (if applicable) — Key facts to include (placeholder format if facts not provided)

3. **LEGAL STANDARD** — The applicable legal standard with citations

4. **ARGUMENT** — Structured legal argument with:
   - Main thesis
   - Supporting case law (with Bluebook citations)
   - Application to facts
   - Anticipated counterarguments and responses

5. **CONCLUSION** — Requested relief or summary

6. **CITATIONS USED** — List all authorities cited in Bluebook format

Format as a professional legal document. Use [PLACEHOLDER] for case-specific facts not provided. Cite only real, verifiable authorities.`;
}

// ── Live Data Source Tabs ─────────────────────────────────────────────────────
const DATA_SOURCE_TABS: Array<{ id: DataSource; label: string; icon: string; description: string; apiPath: string }> = [
  {
    id: 'perplexity',
    label: 'AI Research',
    icon: '🤖',
    description: 'Perplexity AI — live web search across all legal databases',
    apiPath: '',
  },
  {
    id: 'openai_research',
    label: 'OpenAI',
    icon: '✨',
    description: 'OpenAI GPT — deep case law analysis, statute lookup & brief generation',
    apiPath: '',
  },
  {
    id: 'claude_drafting',
    label: 'Claude',
    icon: '🧠',
    description: 'Anthropic Claude — complex drafting, demand letters & long-form briefs with deep reasoning',
    apiPath: '',
  },
  {
    id: 'gemini_docs',
    label: 'Gemini Docs',
    icon: '📄',
    description: 'Gemini multimodal — upload and analyze PDFs, contracts, and court documents',
    apiPath: '',
  },
  {
    id: 'notion_kb',
    label: 'Knowledge Base',
    icon: '📚',
    description: 'Notion — Maggi\'s internal notes, case knowledge, and practice guides',
    apiPath: '',
  },
  {
    id: 'voice_intake',
    label: 'Voice Intake',
    icon: '🎙️',
    description: 'Record client case details — transcribed and summarized into a structured intake record',
    apiPath: '',
  },
  {
    id: 'courtlistener',
    label: 'CourtListener',
    icon: '⚖️',
    description: 'Free Law Project — real federal court opinions & PACER dockets',
    apiPath: '/api/lexi/courtlistener',
  },
  {
    id: 'ecfr',
    label: 'eCFR',
    icon: '📋',
    description: 'Live Code of Federal Regulations — all CFR titles',
    apiPath: '/api/lexi/ecfr',
  },
  {
    id: 'openstates',
    label: 'OpenStates',
    icon: '🗺️',
    description: 'Real-time state bill tracking — all 50 states',
    apiPath: '/api/lexi/openstates',
  },
  {
    id: 'la_legislature',
    label: 'LA Legislature',
    icon: '🦐',
    description: 'Louisiana Legislature — live bill tracking & session data',
    apiPath: '/api/lexi/la-legislature',
  },
  {
    id: 'govinfo',
    label: 'GovInfo',
    icon: '🏛️',
    description: 'U.S. GPO — Federal Register, U.S. Code, Congressional Record',
    apiPath: '/api/lexi/govinfo',
  },
  {
    id: 'case_law_links',
    label: 'Case Law',
    icon: '🔗',
    description: 'Google Scholar, Justia, Cornell LII — free case law search',
    apiPath: '/api/lexi/case-law',
  },
];

const QUICK_SEARCHES = [
  'Summary judgment standard Louisiana',
  'Motion to dismiss 12(b)(6) Fifth Circuit',
  'Louisiana contract breach elements',
  'Personal injury damages Louisiana',
  'Employment discrimination burden shifting',
  'Negligence standard of care Louisiana',
  'FRCP Rule 26 discovery obligations',
  'Title VII hostile work environment elements',
  'Chapter 7 bankruptcy discharge requirements',
  'Non-compete enforceability by state',
  'Statute of limitations personal injury all states',
  'Community property vs equitable distribution',
];

function buildResearchPrompt(
  query: string,
  category: ResearchCategory,
  context?: string,
  selectedState?: string,
  practiceArea?: string
): string {
  const categoryInstructions: Record<ResearchCategory, string> = {
    case_law:
      'Focus on relevant federal and state court decisions. Include case names, citations, courts, years, and key holdings. Prioritize Fifth Circuit and Louisiana courts when applicable, but include other relevant jurisdictions.',
    statutes:
      'Focus on relevant federal statutes (U.S.C.), state codes, and regulations (C.F.R.). Include exact code sections and current text. Note any recent amendments.',
    precedent:
      'Identify controlling authority (binding precedent) and persuasive authority. Distinguish between circuit splits, majority/minority positions, and recent trends. Include proper Bluebook citations.',
    federal:
      'Focus on federal law: U.S. Constitution, federal statutes (U.S.C.), federal regulations (C.F.R.), FRCP, FRE, and federal case law. Include circuit court and Supreme Court decisions.',
    all: 'Provide comprehensive legal research including case law, statutes, regulations, and secondary sources. Organize by source type. Include proper Bluebook citations for all authorities.',
  };

  const stateContext = selectedState
    ? `\nPRIMARY JURISDICTION: ${selectedState} — prioritize ${selectedState} statutes, case law, and court rules. Also include relevant federal law.`
    : '';

  const practiceContext = practiceArea ? `\nPRACTICE AREA: ${practiceArea}` : '';

  return `You are Lexi, a highly experienced legal research assistant at Broussard Legal Services with comprehensive knowledge of all 50 states' laws and federal law. Conduct thorough legal research on the following query.

RESEARCH QUERY: ${query}
RESEARCH FOCUS: ${categoryInstructions[category]}${stateContext}${practiceContext}
${context ? `MATTER CONTEXT: ${context}` : ''}

Provide a structured legal research response with:

1. **SUMMARY** — 2-3 sentence overview of the legal landscape on this issue

2. **KEY AUTHORITIES** — List the most important cases, statutes, or rules with:
   - Full Bluebook citation
   - Court/jurisdiction
   - Year decided
   - Key holding or relevant provision (1-2 sentences)

3. **CONTROLLING LAW** (if applicable) — Identify the binding authority in the relevant jurisdiction(s)

4. **STATE VARIATIONS** (if multi-state) — Note key differences between states' approaches

5. **RECENT DEVELOPMENTS** — Any notable recent cases or statutory changes (last 5 years)

6. **PRACTICE NOTES** — Practical tips for applying this law

Format citations in proper Bluebook format. Be precise and cite only real, verifiable authorities.`;
}

export default function LexiLegalResearch({ context, onInsertCitation, defaultOpen = false }: LexiLegalResearchProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ResearchCategory>('all');
  const [activeDataSource, setActiveDataSource] = useState<DataSource>('perplexity');
  const [history, setHistory] = useState<SearchResult[]>([]);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const [liveDataResult, setLiveDataResult] = useState<LiveDataResult | null>(null);
  const [liveDataLoading, setLiveDataLoading] = useState(false);
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedPracticeArea, setSelectedPracticeArea] = useState<string>('');
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showPracticeDropdown, setShowPracticeDropdown] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const stateDropdownRef = useRef<HTMLDivElement>(null);

  // OpenAI research state
  const [openAIMode, setOpenAIMode] = useState<OpenAIMode>('case_law');
  const [openAIResult, setOpenAIResult] = useState<OpenAIResearchResult | null>(null);
  const [openAIHistory, setOpenAIHistory] = useState<OpenAIResearchResult[]>([]);

  // Perplexity research mode state
  const [perplexityMode, setPerplexityMode] = useState<PerplexityMode>('case_law');

  const { response, fullResponse, isLoading, error, sendMessage } = useChat(
    'PERPLEXITY',
    'perplexity/sonar-pro',
    false
  );

  const {
    response: perplexityDeepResponse,
    fullResponse: perplexityDeepFullResponse,
    isLoading: perplexityDeepLoading,
    error: perplexityDeepError,
    sendMessage: sendPerplexityDeepMessage,
  } = useChat('PERPLEXITY', 'perplexity/sonar-deep-research', false);

  const {
    response: openAIResponse,
    isLoading: openAILoading,
    error: openAIError,
    sendMessage: sendOpenAIMessage,
  } = useChat('OPEN_AI', 'gpt-5.4', true);

  // Claude drafting state
  const [claudeMode, setClaudeMode] = useState<'demand_letter' | 'brief' | 'motion' | 'memo'>('brief');
  const [claudeResult, setClaudeResult] = useState<string | null>(null);
  const {
    response: claudeResponse,
    isLoading: claudeLoading,
    error: claudeError,
    sendMessage: sendClaudeMessage,
  } = useChat('ANTHROPIC', 'claude-sonnet-4-6', true);

  // Gemini multimodal state
  const [geminiFile, setGeminiFile] = useState<File | null>(null);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [geminiResult, setGeminiResult] = useState<string | null>(null);
  const geminiFileRef = useRef<HTMLInputElement>(null);
  const {
    response: geminiResponse,
    isLoading: geminiLoading,
    error: geminiError,
    sendMessage: sendGeminiMessage,
  } = useChat('GEMINI', 'gemini/gemini-2.5-flash', true);

  // Notion KB state
  const [notionQuery, setNotionQuery] = useState('');
  const [notionResults, setNotionResults] = useState<Array<{ title: string; content: string; url?: string; category?: string }>>([]);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionError, setNotionError] = useState<string | null>(null);

  useEffect(() => {
    if (claudeError) toast.error('Claude drafting failed — ' + claudeError.message);
  }, [claudeError]);

  useEffect(() => {
    if (claudeResponse && !claudeLoading) {
      setClaudeResult(claudeResponse);
    }
  }, [claudeResponse, claudeLoading]);

  useEffect(() => {
    if (geminiError) toast.error('Gemini analysis failed — ' + geminiError.message);
  }, [geminiError]);

  useEffect(() => {
    if (geminiResponse && !geminiLoading) {
      setGeminiResult(geminiResponse);
    }
  }, [geminiResponse, geminiLoading]);

  useEffect(() => {
    if (perplexityDeepError) toast.error('Perplexity deep research failed — ' + perplexityDeepError.message);
  }, [perplexityDeepError]);

  useEffect(() => {
    if (perplexityDeepResponse && !perplexityDeepLoading && perplexityDeepFullResponse) {
      const citations: string[] = (perplexityDeepFullResponse as { citations?: string[] }).citations ?? [];
      const searchResults: Array<{ url: string; title: string; snippet?: string }> =
        (perplexityDeepFullResponse as { search_results?: Array<{ url: string; title: string; snippet?: string }> }).search_results ?? [];
      const result: SearchResult = {
        query,
        content: perplexityDeepResponse,
        citations,
        searchResults,
        timestamp: Date.now(),
      };
      setActiveResult(result);
      setHistory(prev => [result, ...prev.slice(0, 9)]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perplexityDeepResponse, perplexityDeepLoading]);

  useEffect(() => {
    if (openAIError) toast.error('OpenAI research failed — ' + openAIError.message);
  }, [openAIError]);

  useEffect(() => {
    if (response && !isLoading && fullResponse) {
      const citations: string[] = (fullResponse as { citations?: string[] }).citations ?? [];
      const searchResults: Array<{ url: string; title: string; snippet?: string }> =
        (fullResponse as { search_results?: Array<{ url: string; title: string; snippet?: string }> }).search_results ?? [];

      const result: SearchResult = {
        query: query,
        content: response,
        citations,
        searchResults,
        timestamp: Date.now(),
      };
      setActiveResult(result);
      setHistory(prev => [result, ...prev.slice(0, 9)]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target as Node)) {
        setShowStateDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStates = ALL_STATES.filter(
    s =>
      s.name.toLowerCase().includes(stateSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(stateSearch.toLowerCase())
  );

  // ── Live Data Source Search ───────────────────────────────────────────────
  const doLiveDataSearch = async (q: string, source: DataSource) => {
    const tab = DATA_SOURCE_TABS.find(t => t.id === source);
    if (!tab?.apiPath || !q.trim()) return;

    setLiveDataLoading(true);
    setLiveDataResult(null);

    try {
      const body: Record<string, any> = { query: q.trim(), limit: 10 };
      if (selectedState && (source === 'openstates')) {
        body.state = selectedState;
      }

      const res = await fetch(tab.apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(`${tab.label} search failed: ${errData?.error ?? res.status}`);
        return;
      }

      const data = await res.json();
      setLiveDataResult(data);
    } catch (err) {
      toast.error(`${tab.label} search failed`);
    } finally {
      setLiveDataLoading(false);
    }
  };

  const doSearch = (q: string, cat: ResearchCategory = category) => {
    if (!q.trim() || isLoading) return;

    if (activeDataSource === 'openai_research') {
      if (openAILoading) return;
      const stateName = selectedState ? ALL_STATES.find(s => s.code === selectedState)?.name : undefined;
      const prompt = buildOpenAIPrompt(q.trim(), openAIMode, context, stateName, selectedPracticeArea || undefined);
      sendOpenAIMessage(
        [
          {
            role: 'system',
            content: selectedState
              ? `You are Lexi, a legal research assistant with deep expertise in ${stateName} law and federal law. Always cite real, verifiable authorities in proper Bluebook format. Be thorough and precise.`
              : 'You are Lexi, a legal research assistant with comprehensive knowledge of all 50 states and federal law. Always cite real, verifiable authorities in proper Bluebook format. Be thorough and precise.',
          },
          { role: 'user', content: prompt },
        ],
        { max_completion_tokens: 2000, reasoning_effort: 'medium' }
      );
      return;
    }

    if (activeDataSource !== 'perplexity') {
      doLiveDataSearch(q, activeDataSource);
      return;
    }

    const stateName = selectedState
      ? ALL_STATES.find(s => s.code === selectedState)?.name
      : undefined;

    // Use mode-specific prompt and model for Perplexity
    const perplexityPrompt = buildPerplexityPrompt(q.trim(), perplexityMode, context, stateName, selectedPracticeArea || undefined);
    const systemContent = selectedState
      ? `You are Lexi, a legal research assistant with deep expertise in ${stateName} law and federal law. Search the web for current, real-time legal information. Always cite real, verifiable authorities in proper Bluebook format with source URLs.`
      : 'You are Lexi, a legal research assistant with comprehensive knowledge of all 50 states and federal law. Search the web for current, real-time legal information. Always cite real, verifiable authorities in proper Bluebook format with source URLs.';

    if (perplexityMode === 'brief_generation') {
      // Use deep research model for brief generation
      sendPerplexityDeepMessage(
        [
          { role: 'system', content: systemContent },
          { role: 'user', content: perplexityPrompt },
        ],
        {
          max_tokens: 3000,
          web_search_options: { search_context_size: 'high' },
        }
      );
    } else {
      sendMessage(
        [
          { role: 'system', content: systemContent },
          { role: 'user', content: perplexityPrompt },
        ],
        {
          temperature: 0.2,
          max_tokens: 2000,
          web_search_options: { search_context_size: perplexityMode === 'statute_lookup' ? 'high' : 'medium' },
        }
      );
    }
  };

  const handleSearch = () => doSearch(query);

  const handleQuickSearch = (q: string) => {
    setQuery(q);
    doSearch(q);
  };

  const handleStateQuickSearch = (stateCode: string, topic: string) => {
    setSelectedState(stateCode);
    const stateName = ALL_STATES.find(s => s.code === stateCode)?.name ?? stateCode;
    const q = `${topic} in ${stateName}`;
    setQuery(q);
    doSearch(q);
  };

  const extractCitationsFromText = (text: string): string[] => {
    const patterns = [
      /[A-Z][a-zA-Z\s&,.']+v\.\s[A-Z][a-zA-Z\s&,.']+,\s*\d+\s+[A-Z][a-zA-Z.]+\s+\d+[^,)]*(?:\([^)]+\))?/g,
      /(?:La\.|Fed\.|U\.S\.C\.|F\.R\.C\.P\.|La\.\s*R\.S\.|La\.\s*C\.C\.P\.|Fla\.\s*Stat\.|Tex\.|O\.C\.G\.A\.|N\.Y\.|Cal\.|Ill\.|N\.J\.S\.A\.|MCL|ORC|RCW|K\.S\.A\.|KRS|ORS|NMSA|NRS|RSA|SDCL|MCA|Neb\.\s*Rev\.\s*Stat\.|Wyo\.\s*Stat\.\s*Ann\.)[^\n,;]*/g,
      /\d+\s+U\.S\.C\.\s+§\s*\d+[a-z]*/g,
      /\d+\s+C\.F\.R\.\s+§\s*\d+/g,
    ];
    const found = new Set<string>();
    patterns.forEach(p => {
      const matches = text.match(p) || [];
      matches.forEach(m => found.add(m.trim()));
    });
    return Array.from(found).slice(0, 10);
  };

  const formatContent = (text: string) => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p class="mb-2">')
      .replace(/\n/g, '<br/>');
  };

  const selectedStateObj = ALL_STATES.find(s => s.code === selectedState);
  const isSearching = isLoading || perplexityDeepLoading || liveDataLoading || openAILoading || claudeLoading || geminiLoading || notionLoading;
  const activeTab = DATA_SOURCE_TABS.find(t => t.id === activeDataSource);
  const activeOpenAIMode = OPENAI_MODE_OPTIONS.find(m => m.id === openAIMode);
  const activePerplexityMode = PERPLEXITY_MODE_OPTIONS.find(m => m.id === perplexityMode);

  // ── Notion KB search ──────────────────────────────────────────────────────────
  const searchNotionKB = async (q: string) => {
    if (!q.trim()) return;
    setNotionLoading(true);
    setNotionError(null);
    setNotionResults([]);
    try {
      const res = await fetch('/api/notion/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim(), limit: 10 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Notion search failed');
      }
      const data = await res.json();
      setNotionResults(data.results ?? data.pages ?? []);
    } catch (err) {
      setNotionError(err instanceof Error ? err.message : 'Notion search failed');
    } finally {
      setNotionLoading(false);
    }
  };

  // ── Claude drafting ───────────────────────────────────────────────────────────
  const handleClaudeDraft = () => {
    if (!query.trim() || claudeLoading) return;
    setClaudeResult(null);
    const modePrompts: Record<string, string> = {
      demand_letter: `Draft a professional demand letter for the following matter. Include all required legal elements, specific demands, response deadline, and consequences of non-compliance. Use formal legal language appropriate for Louisiana practice.\n\nMATTER: ${query}`,
      brief: `Draft a comprehensive legal brief section for the following matter. Include statement of facts, legal standard, argument with citations, and conclusion. Use proper Bluebook citations and formal legal writing style.\n\nMATTER: ${query}`,
      motion: `Draft a motion for the following matter. Include caption, introduction, statement of facts, legal argument with citations, and prayer for relief. Format for Louisiana state court filing.\n\nMATTER: ${query}`,
      memo: `Draft a legal memorandum analyzing the following issue. Include question presented, brief answer, facts, discussion with analysis, and conclusion. Use proper legal citation format.\n\nISSUE: ${query}`,
    };
    sendClaudeMessage([
      {
        role: 'system',
        content: 'You are Lexi, an expert legal drafting assistant at Broussard Legal Services specializing in Louisiana law and federal practice. Draft professional, court-ready legal documents with proper citations, formal language, and complete structure. Use [PLACEHOLDER] for case-specific facts not provided.',
      },
      { role: 'user', content: modePrompts[claudeMode] },
    ], { max_tokens: 3000, reasoning_effort: 'high' });
  };

  // ── Gemini multimodal ─────────────────────────────────────────────────────────
  const handleGeminiAnalyze = async () => {
    if (!geminiFile || geminiLoading) return;
    setGeminiResult(null);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = reader.result as string;
        const prompt = geminiPrompt.trim() || 'Please analyze this document and provide a comprehensive legal summary including: key parties, important dates, obligations, rights, potential issues, and any notable clauses or provisions.';
        const content: Array<{ type: string; text?: string; file?: { file_data: string }; image_url?: { url: string } }> = [
          { type: 'text', text: prompt },
        ];
        if (geminiFile.type.startsWith('image/')) {
          content.push({ type: 'image_url', image_url: { url: dataUri } });
        } else {
          content.push({ type: 'file', file: { file_data: dataUri } });
        }
        sendGeminiMessage([
          {
            role: 'system',
            content: 'You are Lexi, an expert legal document analyst at Broussard Legal Services. Analyze uploaded legal documents, contracts, court filings, and PDFs with precision. Extract key information, identify legal issues, and provide actionable insights.',
          },
          { role: 'user', content: content as any },
        ], { max_tokens: 3000 });
      };
      reader.readAsDataURL(geminiFile);
    } catch {
      toast.error('Failed to process document');
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🔬</span>
          <div className="text-left">
            <p className="text-xs font-semibold text-foreground">Lexi Legal Research</p>
            <p className="text-[10px] text-muted-foreground">All 50 states · Federal law · Perplexity Live · OpenAI · CourtListener · eCFR · OpenStates · GovInfo</p>
          </div>
          {isSearching && (
            <span className="ml-2 flex items-center gap-1 text-[10px] text-primary font-medium">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Searching…
            </span>
          )}
        </div>
        <span className={`text-muted-foreground text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 border-t border-border">

          {/* ── Data Source Tabs ─────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] text-muted-foreground font-medium mb-2">Data Source:</p>
            <div className="flex flex-wrap gap-1.5">
              {DATA_SOURCE_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveDataSource(tab.id);
                    setActiveResult(null);
                    setLiveDataResult(null);
                    setOpenAIResult(null);
                  }}
                  title={tab.description}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${
                    activeDataSource === tab.id
                      ? tab.id === 'openai_research' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : tab.id === 'claude_drafting' ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                      : tab.id === 'gemini_docs' ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : tab.id === 'notion_kb' ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : tab.id === 'voice_intake'? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400' :'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            {activeTab && (
              <p className="text-[9px] text-muted-foreground mt-1.5 italic">{activeTab.description}</p>
            )}
          </div>

          {/* ── OpenAI Research Mode Selector ────────────────────────────── */}
          {activeDataSource === 'openai_research' && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-2">Research Mode:</p>
                <div className="grid grid-cols-3 gap-2">
                  {OPENAI_MODE_OPTIONS.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => { setOpenAIMode(mode.id); setOpenAIResult(null); }}
                      title={mode.description}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all ${
                        openAIMode === mode.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :'border-border text-muted-foreground hover:border-emerald-500/40 hover:text-foreground'
                      }`}
                    >
                      <span className="text-base">{mode.icon}</span>
                      <span className="text-[9px] font-semibold leading-tight">{mode.label}</span>
                    </button>
                  ))}
                </div>
                {activeOpenAIMode && (
                  <p className="text-[9px] text-muted-foreground mt-1.5 italic">{activeOpenAIMode.description}</p>
                )}
              </div>

              {/* Jurisdiction + Practice Area for OpenAI */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative" ref={stateDropdownRef}>
                  <button
                    onClick={() => { setShowStateDropdown(o => !o); setShowPracticeDropdown(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                      selectedState
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :'border-border text-muted-foreground hover:border-emerald-500/40 hover:text-foreground'
                    }`}
                  >
                    <span className="truncate">
                      {selectedStateObj ? `${selectedStateObj.code} — ${selectedStateObj.name}` : '🗺️ All States / Federal'}
                    </span>
                    <span className="ml-1 shrink-0">▾</span>
                  </button>
                  {showStateDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <input
                          autoFocus
                          value={stateSearch}
                          onChange={e => setStateSearch(e.target.value)}
                          placeholder="Search state…"
                          className="w-full px-2 py-1 text-xs bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <button
                          onClick={() => { setSelectedState(''); setShowStateDropdown(false); setStateSearch(''); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${!selectedState ? 'text-primary font-semibold' : 'text-foreground'}`}
                        >
                          🇺🇸 All States / Federal
                        </button>
                        {filteredStates.map(s => (
                          <button
                            key={s.code}
                            onClick={() => { setSelectedState(s.code); setShowStateDropdown(false); setStateSearch(''); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${selectedState === s.code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                          >
                            <span className="font-mono text-[10px] text-muted-foreground mr-2">{s.code}</span>
                            {s.name}
                            <span className="ml-1 text-[9px] text-muted-foreground">({s.citation})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => { setShowPracticeDropdown(o => !o); setShowStateDropdown(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                      selectedPracticeArea
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :'border-border text-muted-foreground hover:border-emerald-500/40 hover:text-foreground'
                    }`}
                  >
                    <span className="truncate">{selectedPracticeArea || '⚖️ Practice Area'}</span>
                    <span className="ml-1 shrink-0">▾</span>
                  </button>
                  {showPracticeDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                      <div className="max-h-48 overflow-y-auto">
                        <button
                          onClick={() => { setSelectedPracticeArea(''); setShowPracticeDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${!selectedPracticeArea ? 'text-primary font-semibold' : 'text-foreground'}`}
                        >
                          All Practice Areas
                        </button>
                        {PRACTICE_AREAS.map(pa => (
                          <button
                            key={pa}
                            onClick={() => { setSelectedPracticeArea(pa); setShowPracticeDropdown(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${selectedPracticeArea === pa ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                          >
                            {pa}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Active filters */}
              {(selectedState || selectedPracticeArea) && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedState && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      🗺️ {selectedStateObj?.name}
                      <button onClick={() => setSelectedState('')} className="ml-0.5 hover:opacity-60">✕</button>
                    </span>
                  )}
                  {selectedPracticeArea && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ⚖️ {selectedPracticeArea}
                      <button onClick={() => setSelectedPracticeArea('')} className="ml-0.5 hover:opacity-60">✕</button>
                    </span>
                  )}
                </div>
              )}

              {/* Search input for OpenAI */}
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch(query)}
                  placeholder={activeOpenAIMode?.placeholder ?? 'Enter your legal research query…'}
                  disabled={openAILoading}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60"
                />
                <button
                  onClick={() => doSearch(query)}
                  disabled={!query.trim() || openAILoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors shrink-0"
                >
                  {openAILoading ? '…' : 'Search'}
                </button>
              </div>

              {/* Quick prompts */}
              {!openAIResult && !openAILoading && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick prompts:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {OPENAI_QUICK_PROMPTS[openAIMode].map(q => (
                      <button
                        key={q}
                        onClick={() => { setQuery(q); doSearch(q); }}
                        className="px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-full text-[10px] text-emerald-700 dark:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* OpenAI Loading */}
              {openAILoading && (
                <div className="flex items-center gap-3 py-4 px-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {openAIMode === 'case_law' ? 'Analyzing case law with OpenAI…' :
                       openAIMode === 'statute_lookup'? 'Looking up statute with OpenAI…' : 'Generating legal brief with OpenAI…'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {openAIMode === 'brief_generation' ?'Drafting structured legal argument with citations…' :'Identifying authorities, holdings, and practical notes…'}
                    </p>
                  </div>
                </div>
              )}

              {/* OpenAI streaming result (live) */}
              {openAILoading && openAIResponse && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 max-h-64 overflow-y-auto">
                  <div
                    className="text-xs text-foreground leading-relaxed prose prose-xs max-w-none"
                    dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + formatContent(openAIResponse) + '</p>' }}
                  />
                </div>
              )}

              {/* OpenAI Result */}
              {openAIResult && !openAILoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {OPENAI_MODE_OPTIONS.find(m => m.id === openAIResult.mode)?.icon} {OPENAI_MODE_OPTIONS.find(m => m.id === openAIResult.mode)?.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground">OpenAI GPT</span>
                      </div>
                      <p className="text-xs font-semibold text-foreground mt-1">
                        Results for: <span className="text-emerald-600 dark:text-emerald-400">{openAIResult.query}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => { setOpenAIResult(null); setQuery(''); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Clear ✕
                    </button>
                  </div>

                  <div className="bg-secondary/20 border border-border rounded-xl p-3 max-h-72 overflow-y-auto">
                    <div
                      className="text-xs text-foreground leading-relaxed prose prose-xs max-w-none"
                      dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + formatContent(openAIResult.content) + '</p>' }}
                    />
                  </div>

                  {(() => {
                    const extracted = extractCitationsFromText(openAIResult.content);
                    return extracted.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-semibold text-foreground mb-1.5">Detected Citations:</p>
                        <div className="space-y-1">
                          {extracted.map((cit, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                              <span className="text-[10px] text-foreground font-mono flex-1 truncate">{cit}</span>
                              {onInsertCitation && (
                                <button
                                  onClick={() => { onInsertCitation(cit); toast.success('Citation added to TOA'); }}
                                  className="shrink-0 px-2 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-semibold hover:bg-emerald-700 transition-colors"
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Recent OpenAI history */}
                  {openAIHistory.length > 1 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Recent OpenAI searches:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {openAIHistory.slice(1, 5).map((h, i) => (
                          <button
                            key={i}
                            onClick={() => setOpenAIResult(h)}
                            className="px-2 py-0.5 bg-secondary/40 border border-border rounded-full text-[10px] text-muted-foreground hover:text-foreground hover:border-emerald-500/40 transition-colors truncate max-w-[140px]"
                            title={h.query}
                          >
                            {OPENAI_MODE_OPTIONS.find(m => m.id === h.mode)?.icon} {h.query}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Perplexity Research Mode Selector ────────────────────── */}
          {activeDataSource === 'perplexity' && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium">Research Mode:</p>
              <div className="grid grid-cols-3 gap-2">
                {PERPLEXITY_MODE_OPTIONS.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => { setPerplexityMode(mode.id); setActiveResult(null); }}
                    title={mode.description}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all ${
                      perplexityMode === mode.id
                        ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <span className="text-base">{mode.icon}</span>
                    <span className="text-[9px] font-semibold leading-tight">{mode.label}</span>
                    {mode.id === 'brief_generation' && (
                      <span className="text-[8px] px-1 py-0.5 bg-primary/10 rounded text-primary font-medium">Deep</span>
                    )}
                  </button>
                ))}
              </div>
              {activePerplexityMode && (
                <p className="text-[9px] text-muted-foreground italic">{activePerplexityMode.description}</p>
              )}
            </div>
          )}

          {/* Jurisdiction + Practice Area filters (only for Perplexity AI) */}
          {activeDataSource === 'perplexity' && (
            <div className="grid grid-cols-2 gap-2">
              {/* State selector */}
              <div className="relative" ref={stateDropdownRef}>
                <button
                  onClick={() => { setShowStateDropdown(o => !o); setShowPracticeDropdown(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                    selectedState
                      ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <span className="truncate">
                    {selectedStateObj ? `${selectedStateObj.code} — ${selectedStateObj.name}` : '🗺️ All States / Federal'}
                  </span>
                  <span className="ml-1 shrink-0">▾</span>
                </button>
                {showStateDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <input
                        autoFocus
                        value={stateSearch}
                        onChange={e => setStateSearch(e.target.value)}
                        placeholder="Search state…"
                        className="w-full px-2 py-1 text-xs bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        onClick={() => { setSelectedState(''); setShowStateDropdown(false); setStateSearch(''); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${!selectedState ? 'text-primary font-semibold' : 'text-foreground'}`}
                      >
                        🇺🇸 All States / Federal
                      </button>
                      {filteredStates.map(s => (
                        <button
                          key={s.code}
                          onClick={() => { setSelectedState(s.code); setShowStateDropdown(false); setStateSearch(''); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${selectedState === s.code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                        >
                          <span className="font-mono text-[10px] text-muted-foreground mr-2">{s.code}</span>
                          {s.name}
                          <span className="ml-1 text-[9px] text-muted-foreground">({s.citation})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Practice area selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowPracticeDropdown(o => !o); setShowStateDropdown(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                    selectedPracticeArea
                      ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <span className="truncate">{selectedPracticeArea || '⚖️ Practice Area'}</span>
                  <span className="ml-1 shrink-0">▾</span>
                </button>
                {showPracticeDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        onClick={() => { setSelectedPracticeArea(''); setShowPracticeDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${!selectedPracticeArea ? 'text-primary font-semibold' : 'text-foreground'}`}
                      >
                        All Practice Areas
                      </button>
                      {PRACTICE_AREAS.map(pa => (
                        <button
                          key={pa}
                          onClick={() => { setSelectedPracticeArea(pa); setShowPracticeDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${selectedPracticeArea === pa ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                        >
                          {pa}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* State filter for OpenStates */}
          {activeDataSource === 'openstates' && (
            <div className="relative" ref={stateDropdownRef}>
              <button
                onClick={() => setShowStateDropdown(o => !o)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                  selectedState ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <span className="truncate">
                  {selectedStateObj ? `${selectedStateObj.code} — ${selectedStateObj.name}` : '🗺️ Filter by State (optional)'}
                </span>
                <span className="ml-1 shrink-0">▾</span>
              </button>
              {showStateDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <input
                      autoFocus
                      value={stateSearch}
                      onChange={e => setStateSearch(e.target.value)}
                      placeholder="Search state…"
                      className="w-full px-2 py-1 text-xs bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedState(''); setShowStateDropdown(false); setStateSearch(''); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors text-foreground"
                    >
                      🇺🇸 All States
                    </button>
                    {filteredStates.map(s => (
                      <button
                        key={s.code}
                        onClick={() => { setSelectedState(s.code); setShowStateDropdown(false); setStateSearch(''); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 transition-colors ${selectedState === s.code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                      >
                        <span className="font-mono text-[10px] text-muted-foreground mr-2">{s.code}</span>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active filters display */}
          {(selectedState || selectedPracticeArea) && activeDataSource === 'perplexity' && (
            <div className="flex flex-wrap gap-1.5">
              {selectedState && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/30 rounded-full text-[10px] text-primary font-medium">
                  🗺️ {selectedStateObj?.name}
                  <button onClick={() => setSelectedState('')} className="ml-0.5 hover:text-primary/60">✕</button>
                </span>
              )}
              {selectedPracticeArea && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/30 rounded-full text-[10px] text-primary font-medium">
                  ⚖️ {selectedPracticeArea}
                  <button onClick={() => setSelectedPracticeArea('')} className="ml-0.5 hover:text-primary/60">✕</button>
                </span>
              )}
            </div>
          )}

          {/* Category selector (only for Perplexity AI) */}
          {activeDataSource === 'perplexity' && (
            <div className="grid grid-cols-5 gap-1">
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  title={cat.hint}
                  className={`px-1.5 py-1.5 rounded-lg border text-center transition-all ${
                    category === cat.id
                      ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <div className="text-sm">{cat.icon}</div>
                  <div className="text-[8px] font-semibold mt-0.5 leading-tight">{cat.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* ── Claude Drafting Panel ─────────────────────────────────────── */}
          {activeDataSource === 'claude_drafting' && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-2">Document Type:</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'demand_letter', label: 'Demand Letter', icon: '📨' },
                    { id: 'brief', label: 'Legal Brief', icon: '📝' },
                    { id: 'motion', label: 'Motion', icon: '⚖️' },
                    { id: 'memo', label: 'Legal Memo', icon: '📋' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => { setClaudeMode(mode.id as typeof claudeMode); setClaudeResult(null); }}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all ${
                        claudeMode === mode.id
                          ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                          : 'border-border text-muted-foreground hover:border-violet-500/40 hover:text-foreground'
                      }`}
                    >
                      <span className="text-base">{mode.icon}</span>
                      <span className="text-[9px] font-semibold leading-tight">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleClaudeDraft()}
                  placeholder={
                    claudeMode === 'demand_letter' ? 'Describe the matter for the demand letter…' :
                    claudeMode === 'brief' ? 'Describe the legal issue or motion for the brief…' :
                    claudeMode === 'motion'? 'Describe the motion and grounds…' : 'Describe the legal issue for analysis…'
                  }
                  disabled={claudeLoading}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60"
                />
                <button
                  onClick={handleClaudeDraft}
                  disabled={!query.trim() || claudeLoading}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-violet-700 transition-colors shrink-0"
                >
                  {claudeLoading ? '…' : 'Draft'}
                </button>
              </div>

              {claudeLoading && (
                <div className="flex items-center gap-3 py-3 px-3 bg-violet-500/5 border border-violet-500/20 rounded-xl">
                  <div className="w-4 h-4 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin shrink-0" />
                  <p className="text-xs text-foreground">Claude is drafting with deep reasoning…</p>
                </div>
              )}

              {(claudeLoading && claudeResponse) && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 max-h-64 overflow-y-auto">
                  <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{claudeResponse}</div>
                </div>
              )}

              {claudeResult && !claudeLoading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-violet-500/10 border border-violet-500/30 rounded-full text-[9px] font-semibold text-violet-600 dark:text-violet-400">
                      🧠 Claude · Deep Reasoning
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(claudeResult); toast.success('Copied to clipboard'); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Copy ⎘
                    </button>
                  </div>
                  <div className="bg-secondary/20 border border-border rounded-xl p-3 max-h-72 overflow-y-auto">
                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{claudeResult}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Gemini Multimodal Panel ───────────────────────────────────── */}
          {activeDataSource === 'gemini_docs' && (
            <div className="space-y-3">
              <div
                onClick={() => geminiFileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  geminiFile ? 'border-blue-400 bg-blue-50/50' : 'border-border hover:border-blue-400/50 hover:bg-blue-50/20'
                }`}
              >
                <input
                  ref={geminiFileRef}
                  type="file"
                  accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { setGeminiFile(file); setGeminiResult(null); }
                  }}
                />
                {geminiFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">📄</span>
                    <div className="text-left">
                      <p className="text-xs font-medium text-foreground">{geminiFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(geminiFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setGeminiFile(null); setGeminiResult(null); if (geminiFileRef.current) geminiFileRef.current.value = ''; }}
                      className="ml-2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-2xl block mb-1">📤</span>
                    <p className="text-xs font-medium text-foreground">Upload PDF, contract, or court document</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">PDF, TXT, JPG, PNG, WebP supported</p>
                  </>
                )}
              </div>

              <input
                value={geminiPrompt}
                onChange={e => setGeminiPrompt(e.target.value)}
                placeholder="What would you like Gemini to analyze? (optional — defaults to full legal summary)"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />

              <button
                onClick={handleGeminiAnalyze}
                disabled={!geminiFile || geminiLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {geminiLoading ? (
                  <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing…</>
                ) : (
                  <><span>📄</span> Analyze Document</>
                )}
              </button>

              {geminiLoading && geminiResponse && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 max-h-64 overflow-y-auto">
                  <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{geminiResponse}</div>
                </div>
              )}

              {geminiResult && !geminiLoading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                      📄 Gemini · Document Analysis
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(geminiResult); toast.success('Copied to clipboard'); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Copy ⎘
                    </button>
                  </div>
                  <div className="bg-secondary/20 border border-border rounded-xl p-3 max-h-72 overflow-y-auto">
                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{geminiResult}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notion Knowledge Base Panel ───────────────────────────────── */}
          {activeDataSource === 'notion_kb' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={notionQuery}
                  onChange={e => setNotionQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchNotionKB(notionQuery)}
                  placeholder="Search Maggi's notes, case knowledge, practice guides…"
                  disabled={notionLoading}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60"
                />
                <button
                  onClick={() => searchNotionKB(notionQuery)}
                  disabled={!notionQuery.trim() || notionLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-amber-700 transition-colors shrink-0"
                >
                  {notionLoading ? '…' : 'Search'}
                </button>
              </div>

              {notionLoading && (
                <div className="flex items-center gap-2 py-3 px-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin shrink-0" />
                  <p className="text-xs text-foreground">Searching Notion knowledge base…</p>
                </div>
              )}

              {notionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-700">{notionError}</p>
                  <p className="text-[10px] text-red-500 mt-0.5">Check that NOTION_API_KEY is configured in your environment</p>
                </div>
              )}

              {notionResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground font-medium">{notionResults.length} result{notionResults.length !== 1 ? 's' : ''} from Notion</p>
                  {notionResults.map((result, i) => (
                    <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-xs font-semibold text-foreground">{result.title}</p>
                        {result.category && (
                          <span className="px-1.5 py-0.5 bg-amber-500/10 rounded text-[9px] text-amber-700 dark:text-amber-400 shrink-0">{result.category}</span>
                        )}
                      </div>
                      {result.content && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{result.content}</p>
                      )}
                      {result.url && (
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 hover:underline mt-1.5 block">
                          Open in Notion →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!notionLoading && !notionError && notionResults.length === 0 && notionQuery && (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-xs">No results found in Notion knowledge base</p>
                  <p className="text-[10px] mt-0.5">Try different keywords or check your Notion API key</p>
                </div>
              )}

              {!notionQuery && !notionLoading && (
                <div className="text-center py-4">
                  <span className="text-2xl block mb-2">📚</span>
                  <p className="text-xs text-muted-foreground">Search Maggi's internal notes, case strategies, and practice guides stored in Notion</p>
                </div>
              )}
            </div>
          )}

          {/* ── Voice Intake Panel ────────────────────────────────────────── */}
          {activeDataSource === 'voice_intake' && (
            <LexiVoiceIntake />
          )}

          {/* Search input (only for non-special tabs) */}
          {activeDataSource !== 'claude_drafting' && activeDataSource !== 'gemini_docs' && activeDataSource !== 'notion_kb' && activeDataSource !== 'voice_intake' && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={
                  activeDataSource === 'courtlistener' ? 'Search federal court opinions…' :
                  activeDataSource === 'ecfr' ? 'Search CFR regulations (e.g. OSHA 29 CFR 1910)…' :
                  activeDataSource === 'openstates' ? 'Search state bills (e.g. minimum wage Louisiana)…' :
                  activeDataSource === 'la_legislature' ? 'Search Louisiana bills (e.g. HB 123 or keyword)…' :
                  activeDataSource === 'govinfo' ? 'Search Federal Register, U.S. Code, CFR…' :
                  activeDataSource === 'case_law_links' ? 'Search Google Scholar, Justia, Cornell LII…' :
                  activeDataSource === 'perplexity' ? (activePerplexityMode?.placeholder ?? 'Search case law, statutes, regulations…') :
                  selectedState ? `Search ${selectedStateObj?.name} law…` :
                  'Search case law, statutes, regulations…'
                }
                disabled={isSearching}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              <button
                onClick={handleSearch}
                disabled={!query.trim() || isSearching}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
              >
                {isSearching ? '…' : 'Search'}
              </button>
            </div>
          )}

          {/* Quick searches (Perplexity only) */}
          {activeDataSource === 'perplexity' && !activeResult && !isLoading && !perplexityDeepLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {PERPLEXITY_QUICK_PROMPTS[perplexityMode].map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuickSearch(q)}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {selectedState && (
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">
                    Quick research for {selectedStateObj?.name}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'statute of limitations personal injury',
                      'contract breach elements',
                      'landlord tenant rights',
                      'employment discrimination',
                      'divorce property division',
                      'workers compensation',
                      'criminal expungement',
                      'small claims court limit',
                    ].map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleStateQuickSearch(selectedState, topic)}
                        className="px-2.5 py-1 bg-primary/5 border border-primary/20 rounded-full text-[10px] text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {category === 'federal' && (
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">Federal law quick searches:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'FRCP Rule 12(b)(6) standard',
                      'Title VII discrimination elements',
                      'ADA reasonable accommodation',
                      'FMLA eligibility requirements',
                      'FLSA overtime exemptions',
                      'Chapter 7 bankruptcy discharge',
                      'HIPAA PHI requirements',
                      'Section 1983 qualified immunity',
                      'Chevron/Loper Bright deference',
                      'TCPA consent requirements',
                    ].map(topic => (
                      <button
                        key={topic}
                        onClick={() => handleQuickSearch(topic)}
                        className="px-2.5 py-1 bg-blue-500/5 border border-blue-500/20 rounded-full text-[10px] text-blue-600 dark:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/10 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick searches for live data sources */}
          {activeDataSource === 'courtlistener' && !liveDataResult && !liveDataLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick case law searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'negligence Louisiana Fifth Circuit',
                  'employment discrimination Title VII',
                  'summary judgment standard',
                  'qualified immunity Section 1983',
                  'breach of contract damages',
                  'personal injury causation',
                ].map(q => (
                  <button key={q} onClick={() => { setQuery(q); doLiveDataSearch(q, 'courtlistener'); }}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDataSource === 'ecfr' && !liveDataResult && !liveDataLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick CFR searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'OSHA workplace safety',
                  'HIPAA privacy rule',
                  'FLSA overtime exemptions',
                  'EPA hazardous waste',
                  'FTC unfair practices',
                  'IRS income tax regulations',
                ].map(q => (
                  <button key={q} onClick={() => { setQuery(q); doLiveDataSearch(q, 'ecfr'); }}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDataSource === 'openstates' && !liveDataResult && !liveDataLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick state bill searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'minimum wage',
                  'landlord tenant',
                  'employment discrimination',
                  'criminal justice reform',
                  'healthcare access',
                  'education funding',
                ].map(q => (
                  <button key={q} onClick={() => { setQuery(q); doLiveDataSearch(q, 'openstates'); }}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDataSource === 'la_legislature' && !liveDataResult && !liveDataLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick Louisiana bill searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'civil code amendment',
                  'workers compensation',
                  'landlord tenant',
                  'criminal sentencing',
                  'family law',
                  'tax exemption',
                ].map(q => (
                  <button key={q} onClick={() => { setQuery(q); doLiveDataSearch(q, 'la_legislature'); }}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDataSource === 'govinfo' && !liveDataResult && !liveDataLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick GovInfo searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Federal Register employment',
                  'U.S. Code Title 42 civil rights',
                  'Congressional Record judiciary',
                  'Public Law 117',
                  'Statutes at Large 2024',
                ].map(q => (
                  <button key={q} onClick={() => { setQuery(q); doLiveDataSearch(q, 'govinfo'); }}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDataSource === 'case_law_links' && !liveDataResult && !liveDataLoading && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Quick case law searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'negligence Louisiana',
                  'breach of contract',
                  'employment discrimination',
                  'personal injury damages',
                  'Fourth Amendment search seizure',
                ].map(q => (
                  <button key={q} onClick={() => { setQuery(q); doLiveDataSearch(q, 'case_law_links'); }}
                    className="px-2.5 py-1 bg-secondary/50 border border-border rounded-full text-[10px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isSearching && (
            <div className="flex items-center gap-3 py-4 px-3 bg-primary/5 rounded-xl">
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {activeDataSource === 'perplexity' && perplexityMode === 'case_law' ? 'Searching live case law databases…' :
                   activeDataSource === 'perplexity' && perplexityMode === 'statute_lookup' ? 'Looking up current statute text…' :
                   activeDataSource === 'perplexity' && perplexityMode === 'brief_generation' ? 'Running deep research for brief generation…' :
                   activeDataSource === 'courtlistener' ? 'Querying CourtListener case law…' :
                   activeDataSource === 'ecfr' ? 'Searching eCFR regulations…' :
                   activeDataSource === 'openstates' ? 'Fetching state bill data…' :
                   activeDataSource === 'la_legislature' ? 'Querying Louisiana Legislature…' :
                   activeDataSource === 'govinfo' ? 'Searching GovInfo (U.S. GPO)…' :
                   'Searching case law databases…'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {activeDataSource === 'perplexity' && perplexityMode === 'brief_generation' ?'Using Perplexity deep research — comprehensive web search across legal databases'
                    : activeDataSource === 'perplexity'
                    ? selectedState
                      ? `Querying ${selectedStateObj?.name} statutes, case law, and court rules via live web`
                      : 'Querying all 50 states, federal law, and live legal databases'
                    : activeTab?.description}
                </p>
              </div>
            </div>
          )}

          {/* ── Live Data Results (non-Perplexity) ─────────────────────── */}
          {liveDataResult && !liveDataLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {liveDataResult.source}: <span className="text-primary">{liveDataResult.query}</span>
                  </p>
                  {liveDataResult.count !== undefined && (
                    <p className="text-[10px] text-muted-foreground">{liveDataResult.count} results found</p>
                  )}
                </div>
                <button
                  onClick={() => { setLiveDataResult(null); setQuery(''); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Clear ✕
                </button>
              </div>

              {/* CourtListener results */}
              {activeDataSource === 'courtlistener' && liveDataResult.results && (
                <div className="space-y-2">
                  {liveDataResult.results.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No cases found. Try different search terms.</p>
                  ) : liveDataResult.results.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-secondary/20 border border-border rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{r.caseName}</p>
                          {r.citation && <p className="text-[10px] text-primary font-mono mt-0.5">{r.citation}</p>}
                          <div className="flex items-center gap-2 mt-0.5">
                            {r.court && <span className="text-[9px] text-muted-foreground">{r.court}</span>}
                            {r.dateFiled && <span className="text-[9px] text-muted-foreground">· {r.dateFiled}</span>}
                            {r.status && <span className="text-[9px] text-muted-foreground">· {r.status}</span>}
                          </div>
                          {r.snippet && <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">{r.snippet}</p>}
                        </div>
                        {r.absoluteUrl && (
                          <a href={r.absoluteUrl} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[9px] font-semibold hover:bg-primary/20 transition-colors">
                            View →
                          </a>
                        )}
                      </div>
                      {r.citation && onInsertCitation && (
                        <button
                          onClick={() => { onInsertCitation(r.citation); toast.success('Citation added'); }}
                          className="mt-2 px-2 py-0.5 bg-primary text-primary-foreground rounded text-[9px] font-semibold hover:bg-primary/90 transition-colors"
                        >
                          + Add Citation
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* eCFR results */}
              {activeDataSource === 'ecfr' && liveDataResult.results && (
                <div className="space-y-2">
                  {liveDataResult.results.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No regulations found. Try different search terms.</p>
                  ) : liveDataResult.results.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-secondary/20 border border-border rounded-xl">
                      <p className="text-xs font-semibold text-foreground">{r.subject || r.title}</p>
                      {r.citation && <p className="text-[10px] text-primary font-mono mt-0.5">{r.citation}</p>}
                      {r.snippet && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] text-primary hover:underline">
                            View on eCFR →
                          </a>
                        )}
                        {r.citation && onInsertCitation && (
                          <button
                            onClick={() => { onInsertCitation(r.citation); toast.success('Citation added'); }}
                            className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-[9px] font-semibold hover:bg-primary/90 transition-colors"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* OpenStates / LA Legislature bill results */}
              {(activeDataSource === 'openstates' || activeDataSource === 'la_legislature') && (
                <div className="space-y-2">
                  {(liveDataResult.bills ?? liveDataResult.results ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No bills found. Try different search terms.</p>
                  ) : (liveDataResult.bills ?? liveDataResult.results ?? []).map((b: any, i: number) => (
                    <div key={i} className="p-3 bg-secondary/20 border border-border rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {(b.identifier || b.billNumber) && (
                            <span className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[9px] font-mono font-semibold mb-1">
                              {b.identifier || `${b.billType ?? ''}${b.billNumber}`}
                            </span>
                          )}
                          <p className="text-xs font-semibold text-foreground line-clamp-2">{b.title}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {(b.state || b.session) && (
                              <span className="text-[9px] text-muted-foreground">{b.state || b.session}</span>
                            )}
                            {b.status && (
                              <span className="text-[9px] text-muted-foreground">· {b.status.slice(0, 60)}</span>
                            )}
                            {b.author && (
                              <span className="text-[9px] text-muted-foreground">· by {b.author}</span>
                            )}
                          </div>
                        </div>
                        {b.url && (
                          <a href={b.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[9px] font-semibold hover:bg-primary/20 transition-colors">
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* GovInfo results */}
              {activeDataSource === 'govinfo' && liveDataResult.results && (
                <div className="space-y-2">
                  {liveDataResult.results.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No documents found. Try different search terms.</p>
                  ) : liveDataResult.results.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-secondary/20 border border-border rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground line-clamp-2">{r.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {r.collection && <span className="text-[9px] px-1.5 py-0.5 bg-secondary/60 rounded text-muted-foreground">{r.collection}</span>}
                            {r.dateIssued && <span className="text-[9px] text-muted-foreground">{r.dateIssued}</span>}
                          </div>
                          {r.citation && <p className="text-[10px] text-primary font-mono mt-0.5">{r.citation}</p>}
                        </div>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[9px] font-semibold hover:bg-primary/20 transition-colors">
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Case Law Links (Google Scholar / Justia / Cornell LII) */}
              {activeDataSource === 'case_law_links' && (
                <div className="space-y-3">
                  {liveDataResult.note && (
                    <p className="text-[10px] text-muted-foreground italic">{liveDataResult.note}</p>
                  )}

                  {/* CourtListener API results */}
                  {liveDataResult.courtListenerResults && liveDataResult.courtListenerResults.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-foreground mb-1.5">📋 CourtListener Results:</p>
                      <div className="space-y-1.5">
                        {liveDataResult.courtListenerResults.slice(0, 3).map((r: any, i: number) => (
                          <div key={i} className="p-2 bg-secondary/20 border border-border rounded-lg">
                            <p className="text-[10px] font-semibold text-foreground">{r.caseName}</p>
                            {r.citation && <p className="text-[9px] text-primary font-mono">{r.citation}</p>}
                            {r.absoluteUrl && (
                              <a href={r.absoluteUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[9px] text-primary hover:underline">View opinion →</a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search links */}
                  {liveDataResult.searchLinks && liveDataResult.searchLinks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-foreground mb-1.5">🔗 Search Directly:</p>
                      <div className="space-y-1.5">
                        {liveDataResult.searchLinks.map((link: any, i: number) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2.5 bg-background border border-border rounded-xl hover:border-primary/40 transition-colors group"
                          >
                            <div>
                              <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{link.source}</p>
                              {link.description && <p className="text-[9px] text-muted-foreground mt-0.5">{link.description}</p>}
                            </div>
                            <span className="text-primary text-xs">→</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Perplexity AI Results ─────────────────────────────────── */}
          {activeResult && !isLoading && !perplexityDeepLoading && activeDataSource === 'perplexity' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-primary/10 border border-primary/30 rounded-full text-[9px] font-semibold text-primary">
                      {activePerplexityMode?.icon} {activePerplexityMode?.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {perplexityMode === 'brief_generation' ? 'Perplexity Deep Research' : 'Perplexity AI · Live Web'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">Results for: <span className="text-primary">{activeResult.query}</span></p>
                  {activeResult.searchResults.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">{activeResult.searchResults.length} live sources found</p>
                  )}
                </div>
                <button
                  onClick={() => { setActiveResult(null); setQuery(''); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Clear ✕
                </button>
              </div>

              <div className="bg-secondary/20 border border-border rounded-xl p-3 max-h-64 overflow-y-auto">
                <div
                  className="text-xs text-foreground leading-relaxed prose prose-xs max-w-none"
                  dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + formatContent(activeResult.content) + '</p>' }}
                />
              </div>

              {(() => {
                const extracted = extractCitationsFromText(activeResult.content);
                return extracted.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold text-foreground mb-1.5">Detected Citations:</p>
                    <div className="space-y-1">
                      {extracted.map((cit, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                          <span className="text-[10px] text-foreground font-mono flex-1 truncate">{cit}</span>
                          {onInsertCitation && (
                            <button
                              onClick={() => { onInsertCitation(cit); toast.success('Citation added to TOA'); }}
                              className="shrink-0 px-2 py-0.5 bg-primary text-primary-foreground rounded text-[9px] font-semibold hover:bg-primary/90 transition-colors"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {activeResult.searchResults.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-foreground mb-1.5">Sources:</p>
                  <div className="space-y-1">
                    {activeResult.searchResults.slice(0, 5).map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 bg-background border border-border rounded-lg hover:border-primary/40 transition-colors group"
                      >
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">[{i + 1}]</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium text-primary group-hover:underline truncate">{src.title || src.url}</p>
                          {src.snippet && <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{src.snippet}</p>}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search history */}
          {history.length > 1 && activeDataSource === 'perplexity' && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Recent searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {history.slice(1, 6).map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveResult(h)}
                    className="px-2 py-0.5 bg-secondary/40 border border-border rounded-full text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors truncate max-w-[140px]"
                    title={h.query}
                  >
                    {h.query}
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
