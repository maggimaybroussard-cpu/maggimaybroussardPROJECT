/**
 * Lexi Chat API Route
 * Handles all Lexi floating chat requests with:
 * - Rate limiting per visitor IP (daily + burst)
 * - Response caching for common FAQ questions
 * - Topic guardrails (off-topic redirect)
 * - Booking intent detection
 * - Conversation memory from Supabase history
 * - Confidence fallback to consultation booking
 * - Disclaimer detection + audit logging
 * - Congress.gov real-time data for legislation/bill queries
 * - Perplexity routing for legal research questions
 * - CourtListener for real federal case opinions
 * - eCFR for live Code of Federal Regulations
 * - OpenStates for real-time state bill tracking
 * - Louisiana Legislature API for live LA bill data
 * - GovInfo for Federal Register, U.S. Code, CFR
 * - Google Scholar / Justia / Cornell LII case law links
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  LEXI_SYSTEM_PROMPT,
  LEXI_RATE_LIMIT,
  LEXI_RATE_LIMIT_BURST,
  isOffTopic,
  hasBookingIntent,
  triggeredDisclaimer,
  isCacheable,
  getCacheKey,
  getCachedResponse,
  setCachedResponse,
} from '@/lib/lexi/lexiConfig';
import { getNotionKnowledgeBaseContext } from '@/lib/lexi/notionKnowledgeBase';

// ── Congress.gov intent detection ─────────────────────────────────────────────
// Comprehensive patterns for legislation, bills, federal statutes, and congressional activity
const CONGRESS_PATTERNS = [
  // Bill/Act references with numbers (e.g. H.R. 1234, S. 567, H.R.1, S.Res.10)
  /\b(h\.?r\.?\s*\d+|s\.?\s*\d+|s\.?\s*res\.?\s*\d+|h\.?\s*res\.?\s*\d+|h\.?\s*con\.?\s*res\.?\s*\d+|s\.?\s*con\.?\s*res\.?\s*\d+|hjres\s*\d+|sjres\s*\d+)\b/i,
  // Named acts and legislation
  /\b(act of \d{4}|public law|p\.l\.\s*\d|pl\s*\d+[-–]\d+|usc|u\.s\.c\.|cfr|c\.f\.r\.)\b/i,
  // Congressional body/process terms
  /\b(congress(ional)?|senate|house of representatives|floor vote|committee hearing|markup|cloture|filibuster|reconciliation bill|omnibus|continuing resolution|appropriations bill|authorization bill)\b/i,
  // Legislative status/action terms
  /\b(bill(s)?|legislation|statute(s)?|enacted|signed into law|pending legislation|introduced in (congress|senate|house)|passed by (congress|senate|house)|vetoed|pocket veto|override|enrolled bill|engrossed bill)\b/i,
  // Federal law research terms
  /\b(federal (law|statute|regulation|code|register)|title \d+ (u\.s\.c\.|usc)|code of federal regulations|federal register|congressional record|bound congressional record)\b/i,
  // Congress sessions
  /\b(\d{3}(st|nd|rd|th) congress|118th|119th|120th|121st)\b/i,
  // Specific legislative queries
  /\b(what (bills?|legislation|acts?|statutes?)|any (bills?|legislation|acts?)|recent (bills?|legislation)|new (legislation|law|statute)|latest (legislation|law)|is there a (bill|law|statute)|has (congress|senate|house) (passed|introduced|voted))\b/i,
  // Amendment and codification
  /\b(amendment to (the )?(constitution|act|law|statute|code)|amend(ing|ed|ment)|codified at|codified in)\b/i,
  // Congress.gov direct reference
  /\b(congress\.gov)\b/i,
];

function hasCongressIntent(message: string): boolean {
  return CONGRESS_PATTERNS.some((p) => p.test(message));
}

// ── Legal Research intent detection ──────────────────────────────────────────
// Patterns indicating the user wants substantive legal research (case law, statutes, regulations)
const LEGAL_RESEARCH_PATTERNS = [
  // Explicit research requests
  /\b(legal research|research (the |this )?(law|case|statute|regulation|issue)|find (case law|cases|statutes|regulations|precedent)|look up (the law|cases|statutes))\b/i,
  // Case law queries
  /\b(case law|case precedent|landmark case|leading case|controlling authority|persuasive authority|on point cases?|similar cases?|relevant cases?)\b/i,
  // Statute/regulation research — all 50 states
  /\b(louisiana|texas|california|florida|new york|illinois|ohio|georgia|michigan|pennsylvania|north carolina|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|west virginia|idaho|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming) (law|statute|code|regulation|rule|court|case)\b/i,
  /\b(la\.\s*(r\.s\.|civ\.|c\.c\.|c\.c\.p\.)|tex\.\s*(civ\.|bus\.|fam\.|prop\.|lab\.)|fla\.\s*stat\.|o\.c\.g\.a\.|n\.y\.\s*(cplr|penal|labor)|cal\.\s*(civ\.|ccp|lab\.)|ill\.\s*comp\.\s*stat\.|ohio\s*rev\.\s*code|rcw|k\.s\.a\.|krs|ors|n\.j\.s\.a\.|mcl|minn\.\s*stat\.|mo\.\s*rev\.\s*stat\.)\b/i,
  // Legal standards and tests
  /\b(legal standard|burden of proof|elements of|prima facie|cause of action|statute of limitations|prescriptive period|peremptive period|discovery rule|tolling)\b/i,
  // Research methodology
  /\b(how (do I |to )?(research|find|look up|cite)|westlaw|lexisnexis|fastcase|casetext|google scholar|legal database|secondary source|law review|treatise|restatement)\b/i,
  // Specific legal topics requiring research
  /\b(what (does the law say|is the law|are the rules|are the requirements) (about|on|for|regarding)|is it legal|is that legal|legally (required|permitted|prohibited|allowed))\b/i,
  // Regulatory and federal research
  /\b(osha|epa|eeoc|nlrb|ftc|sec regulation|federal regulation|state regulation|administrative (law|code|rule)|agency rule|cfr|c\.f\.r\.|u\.s\.c\.|usc)\b/i,
  // Federal law topics
  /\b(frcp|fre|frap|title vii|adea|ada|fmla|flsa|nlra|warn act|ftca|section 1983|hipaa|false claims act|cercla|clean air act|clean water act|bankruptcy code|immigration and nationality act|lanham act|copyright act|patent act)\b/i,
  // Specialized practice areas
  /\b(non-compete|non-disclosure|nda|trade secret|landlord.?tenant|workers.?comp|personal injury|medical malpractice|products liability|wrongful death|dram shop|premises liability|slip and fall|employment discrimination|hostile work environment|wrongful termination|wage (theft|claim)|overtime|class action|mass tort)\b/i,
  // Multi-state comparison queries
  /\b(which states?|how (do|does) (states?|[a-z]+ and [a-z]+) (handle|treat|approach|define|calculate)|compare (states?|jurisdictions?)|state (comparison|differences?|variations?)|across (states?|jurisdictions?))\b/i,
];

function hasLegalResearchIntent(message: string): boolean {
  // Don't route to Perplexity if it's already a Congress/legislation query (handled separately)
  if (hasCongressIntent(message)) return false;
  return LEGAL_RESEARCH_PATTERNS.some((p) => p.test(message));
}

// ── CourtListener intent detection ───────────────────────────────────────────
const COURTLISTENER_PATTERNS = [
  /\b(court opinion|case opinion|federal (court|case|opinion)|circuit court|district court|supreme court (case|opinion|ruling|decision))\b/i,
  /\b(pacer|recap|free law|courtlistener|case law search|find (a |the )?case|case citation|cite (a |the )?case)\b/i,
  /\b(\d+\s+F\.\d+d?\s+\d+|\d+\s+U\.S\.\s+\d+|\d+\s+S\.Ct\.\s+\d+|\d+\s+L\.Ed\.\d+d?\s+\d+)\b/i,
  /\b(fifth circuit|ninth circuit|second circuit|eleventh circuit|en banc|cert denied|certiorari|affirmed|reversed|remanded)\b/i,
  /\b(landmark (case|ruling|decision)|leading (case|authority)|controlling (case|precedent)|on point case)\b/i,
];

function hasCourtListenerIntent(message: string): boolean {
  if (hasCongressIntent(message)) return false;
  return COURTLISTENER_PATTERNS.some((p) => p.test(message));
}

// ── eCFR intent detection ─────────────────────────────────────────────────────
const ECFR_PATTERNS = [
  /\b(code of federal regulations|c\.f\.r\.|cfr|federal regulation(s)?|title \d+ cfr|ecfr|e-cfr)\b/i,
  /\b(\d+\s+c\.f\.r\.\s+§?\s*\d+|title \d+,?\s+part \d+|cfr part \d+|cfr section \d+)\b/i,
  /\b(federal rule(s)? of|osha regulation|epa regulation|fda regulation|ftc regulation|sec regulation|irs regulation|hhs regulation|dol regulation)\b/i,
  /\b(administrative (rule|regulation|code)|agency rule|rulemaking|final rule|proposed rule|federal register notice)\b/i,
];

function hasECFRIntent(message: string): boolean {
  return ECFR_PATTERNS.some((p) => p.test(message));
}

// ── OpenStates / State Bills intent detection ─────────────────────────────────
const OPENSTATES_PATTERNS = [
  /\b(state (bill|legislation|legislature|law|statute)|state (house|senate) bill|state (assembly|general assembly))\b/i,
  /\b(pending (state|louisiana|texas|california|florida) (bill|legislation)|new (state|louisiana|texas) law|state legislature)\b/i,
  /\b(openstates|state bill tracking|legislative session|state session|current (session|legislature))\b/i,
  /\b((louisiana|texas|california|florida|new york|illinois|ohio|georgia) (legislature|legislative|bill|session|statute|law) (2024|2025|2026|current|pending|new|recent))\b/i,
];

function hasOpenStatesIntent(message: string): boolean {
  if (hasCongressIntent(message)) return false;
  return OPENSTATES_PATTERNS.some((p) => p.test(message));
}

// ── Louisiana Legislature intent detection ────────────────────────────────────
const LA_LEGISLATURE_PATTERNS = [
  /\b(louisiana (bill|legislation|legislature|law|statute|act|session|house|senate))\b/i,
  /\b(la\.\s*(bill|act|session|legislature|house|senate)|louisiana revised statute|la\.\s*r\.s\.)\b/i,
  /\b(louisiana (2024|2025|2026) (session|legislature|bill|law)|current louisiana (session|legislature))\b/i,
  /\b(louisiana (house|senate) bill \d+|hb \d+ louisiana|sb \d+ louisiana)\b/i,
];

function hasLALegislatureIntent(message: string): boolean {
  return LA_LEGISLATURE_PATTERNS.some((p) => p.test(message));
}

// ── GovInfo intent detection ──────────────────────────────────────────────────
const GOVINFO_PATTERNS = [
  /\b(federal register|govinfo|gpo|government publishing office|statutes at large|public law \d+)\b/i,
  /\b(u\.s\.\s*code|united states code|usc title \d+|title \d+ u\.s\.c\.)\b/i,
  /\b(congressional record|house report|senate report|conference report|committee report)\b/i,
];

function hasGovInfoIntent(message: string): boolean {
  if (hasCongressIntent(message)) return false;
  return GOVINFO_PATTERNS.some((p) => p.test(message));
}

async function fetchCongressContext(query: string): Promise<string> {
  try {
    const apiKey = process.env.CONGRESS_API_KEY;
    if (!apiKey) return '';

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/lexi/congress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5, sort: 'updateDate+desc' }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    if (!data?.bills?.length) return '';

    const billSummaries = data.bills
      .map((b: any) => {
        const latestAction = b.latestAction
          ? ` | Latest action (${b.latestAction.actionDate ?? ''}): ${b.latestAction.text ?? ''}`
          : '';
        return `• ${b.type ?? ''} ${b.number ?? ''} (${b.congress}th Congress, ${b.originChamber ?? ''}): ${b.title ?? ''}${latestAction}`;
      })
      .join('\n');

    return `\n\n---\n**Live Congress.gov Data** (retrieved in real time):\n${billSummaries}\n---\n`;
  } catch {
    return '';
  }
}

// ── CourtListener case law fetch ──────────────────────────────────────────────
async function fetchCourtListenerContext(query: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/lexi/courtlistener`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    if (!data?.results?.length) return '';

    const caseSummaries = data.results
      .map((c: any) => {
        const citation = c.citation ? `, ${c.citation}` : '';
        const court = c.court ? ` (${c.court})` : '';
        const date = c.dateFiled ? ` [${c.dateFiled}]` : '';
        const snippet = c.snippet ? `\n  "${c.snippet.slice(0, 200)}…"` : '';
        return `• ${c.caseName}${citation}${court}${date}${snippet}`;
      })
      .join('\n');

    return `\n\n---\n**Live CourtListener Case Law** (${data.count ?? data.results.length} results):\n${caseSummaries}\n---\n`;
  } catch {
    return '';
  }
}

// ── eCFR federal regulations fetch ───────────────────────────────────────────
async function fetchECFRContext(query: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/lexi/ecfr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    if (!data?.results?.length) return '';

    const regSummaries = data.results
      .map((r: any) => {
        const citation = r.citation ? ` [${r.citation}]` : '';
        const subject = r.subject ? ` — ${r.subject}` : '';
        const snippet = r.snippet ? `\n  ${r.snippet.slice(0, 200)}` : '';
        return `• ${r.title || 'CFR'}${citation}${subject}${snippet}`;
      })
      .join('\n');

    return `\n\n---\n**Live eCFR Regulations** (Code of Federal Regulations):\n${regSummaries}\n---\n`;
  } catch {
    return '';
  }
}

// ── OpenStates state bills fetch ──────────────────────────────────────────────
async function fetchOpenStatesContext(query: string, state?: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/lexi/openstates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, state, limit: 5 }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    if (!data?.bills?.length) return '';

    const billSummaries = data.bills
      .map((b: any) => {
        const id = b.identifier ? `${b.identifier} ` : '';
        const stateName = b.state ? ` (${b.state})` : '';
        const status = b.status ? ` | Status: ${b.status}` : '';
        const date = b.statusDate ? ` [${b.statusDate}]` : '';
        return `• ${id}${b.title}${stateName}${status}${date}`;
      })
      .join('\n');

    return `\n\n---\n**Live OpenStates Bill Data** (${state ? state + ' Legislature' : 'All States'}):\n${billSummaries}\n---\n`;
  } catch {
    return '';
  }
}

// ── Louisiana Legislature fetch ───────────────────────────────────────────────
async function fetchLALegislatureContext(query: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/lexi/la-legislature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    const bills = data?.bills ?? [];
    if (!bills.length) return '';

    const billSummaries = bills
      .map((b: any) => {
        const num = b.billNumber ? `${b.billType ?? ''}${b.billNumber} ` : '';
        const author = b.author ? ` by ${b.author}` : '';
        const status = b.status ? ` | ${b.status}` : '';
        return `• ${num}${b.title}${author}${status}`;
      })
      .join('\n');

    return `\n\n---\n**Live Louisiana Legislature Data**:\n${billSummaries}\n---\n`;
  } catch {
    return '';
  }
}

// ── GovInfo fetch ─────────────────────────────────────────────────────────────
async function fetchGovInfoContext(query: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/lexi/govinfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5 }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    if (!data?.results?.length) return '';

    const docSummaries = data.results
      .map((r: any) => {
        const collection = r.collection ? ` [${r.collection}]` : '';
        const date = r.dateIssued ? ` (${r.dateIssued})` : '';
        const citation = r.citation ? ` — ${r.citation}` : '';
        return `• ${r.title}${collection}${date}${citation}`;
      })
      .join('\n');

    return `\n\n---\n**Live GovInfo (U.S. GPO) Data**:\n${docSummaries}\n---\n`;
  } catch {
    return '';
  }
}

// ── Perplexity legal research call ───────────────────────────────────────────
async function fetchPerplexityLegalResearch(
  userMessage: string,
  conversationMessages: { role: string; content: string }[]
): Promise<string> {
  try {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) return '';

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    const legalResearchSystemPrompt = `You are a legal research assistant with comprehensive knowledge of all 50 U.S. states' laws and federal law. 
Provide accurate, well-sourced legal research responses. Focus on:
- Relevant statutes, case law, and regulations for the jurisdiction(s) mentioned
- All 50 states' codes, rules of civil procedure, and court systems
- Federal statutes (U.S.C.), federal regulations (C.F.R.), FRCP, FRE, and federal case law
- Specialized federal law: Title VII, ADA, FMLA, FLSA, HIPAA, Bankruptcy Code, Immigration law, IP law, Securities law, Environmental law, Tax law, Administrative law
- Cite specific statute numbers, case names, and regulatory citations
- Note jurisdictional limitations and key state-to-state variations
- For multi-state questions, compare approaches across relevant jurisdictions
- Always append: "⚖️ This is general legal information, not legal advice. For guidance specific to your situation, please consult a licensed attorney."`;

    const messages = [
      { role: 'system', content: legalResearchSystemPrompt },
      ...conversationMessages.slice(-4), // last 4 messages for context
      { role: 'user', content: userMessage },
    ];

    const res = await fetch(`${baseUrl}/api/ai/chat-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'PERPLEXITY',
        model: 'perplexity/sonar-pro',
        messages,
        stream: false,
        parameters: {
          max_tokens: 800,
          temperature: 0.3,
          web_search_options: {
            search_context_size: 'high',
          },
        },
      }),
    });

    if (!res.ok) return '';

    const data = await res.json();
    let content =
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      '';

    return content;
  } catch {
    return '';
  }
}

const OFF_TOPIC_REPLY =
  "I'm Lexi, Broussard Legal's AI assistant — I'm only able to help with legal questions and information about our services. Is there a legal matter I can help you with today?";

const BOOKING_NUDGE =
  "\n\nIt sounds like you're ready to take the next step. You can book a free 15-minute consultation with Maggi at [/availability](/availability) — she'll be able to give you a clear path forward.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // ── Rate Limiting (burst: 8/min, daily: 30/day) ──────────────────────────
  const burstResult = checkRateLimit(`lexi_burst_${ip}`, LEXI_RATE_LIMIT_BURST);
  if (!burstResult.allowed) {
    return NextResponse.json(
      {
        error: 'Too many messages. Please wait a moment before sending another.',
        retryAfter: Math.ceil((burstResult.resetAt - Date.now()) / 1000),
      },
      { status: 429 }
    );
  }

  const dailyResult = checkRateLimit(`lexi_daily_${ip}`, LEXI_RATE_LIMIT);
  if (!dailyResult.allowed) {
    return NextResponse.json(
      {
        error:
          "You've reached the daily message limit. Please book a consultation with Maggi for personalized assistance.",
        retryAfter: Math.ceil((dailyResult.resetAt - Date.now()) / 1000),
        bookingUrl: '/availability',
      },
      { status: 429 }
    );
  }

  // ── Parse Request ─────────────────────────────────────────────────────────
  let body: {
    messages?: { role: string; content: string }[];
    visitorId?: string;
    stream?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages = [], visitorId, stream = false } = body;

  if (!messages.length) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  // Latest user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUserMsg?.content?.trim() ?? '';

  // ── Off-Topic Guardrail ───────────────────────────────────────────────────
  if (userText && isOffTopic(userText)) {
    return NextResponse.json({ content: OFF_TOPIC_REPLY, cached: false, offTopic: true });
  }

  // ── Response Cache (FAQ questions only) ──────────────────────────────────
  const cacheable = userText && isCacheable(userText);
  const cacheKey = cacheable ? getCacheKey(userText) : null;

  if (cacheKey) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return NextResponse.json({ content: cached, cached: true });
    }
  }

  // ── Conversation Memory (load prior history for returning visitors) ───────
  let priorHistory: { role: string; content: string }[] = [];
  if (visitorId) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data } = await supabase
        .from('lexi_visitor_sessions')
        .select('messages')
        .eq('visitor_id', visitorId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.messages && Array.isArray(data.messages)) {
        priorHistory = (data.messages as { role: string; content: string }[]).slice(-6);
      }
    } catch {
      // Non-blocking
    }
  }

  // ── Detect routing intent ─────────────────────────────────────────────────
  const isCongressQuery = userText ? hasCongressIntent(userText) : false;
  const isLegalResearchQuery = userText ? hasLegalResearchIntent(userText) : false;
  const isCourtListenerQuery = userText ? hasCourtListenerIntent(userText) : false;
  const isECFRQuery = userText ? hasECFRIntent(userText) : false;
  const isOpenStatesQuery = userText ? hasOpenStatesIntent(userText) : false;
  const isLALegislatureQuery = userText ? hasLALegislatureIntent(userText) : false;
  const isGovInfoQuery = userText ? hasGovInfoIntent(userText) : false;

  // ── Route: Legal Research → Perplexity ───────────────────────────────────
  if (isLegalResearchQuery) {
    try {
      const perplexityResponse = await fetchPerplexityLegalResearch(
        userText,
        [...priorHistory, ...messages.slice(0, -1)] // conversation context without the last user msg
      );

      if (perplexityResponse) {
        const bookingIntent = hasBookingIntent(userText);
        let content = perplexityResponse;
        if (bookingIntent && !content.includes('/availability')) {
          content += BOOKING_NUDGE;
        }

        void saveSessionAndAudit({ visitorId, messages, response: content, ip });
        return NextResponse.json({ content, cached: false, source: 'perplexity' });
      }
      // Fall through to OpenAI if Perplexity fails
    } catch {
      // Fall through to OpenAI
    }
  }

  // ── Build Final Message Array ─────────────────────────────────────────────
  const notionKBContext = await getNotionKnowledgeBaseContext().catch(() => '');

  // ── Congress.gov real-time enrichment ─────────────────────────────────────
  const congressContext = isCongressQuery
    ? await fetchCongressContext(userText).catch(() => '')
    : '';

  // ── CourtListener real-time case law enrichment ───────────────────────────
  const courtListenerContext = isCourtListenerQuery
    ? await fetchCourtListenerContext(userText).catch(() => '')
    : '';

  // ── eCFR federal regulations enrichment ──────────────────────────────────
  const ecfrContext = isECFRQuery
    ? await fetchECFRContext(userText).catch(() => '')
    : '';

  // ── OpenStates state bills enrichment ─────────────────────────────────────
  // Detect state from message for targeted lookup
  const stateMatch = userText.match(/\b(louisiana|texas|california|florida|new york|illinois|ohio|georgia|michigan|pennsylvania|north carolina|new jersey|virginia|washington|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south carolina|alabama|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new mexico|nebraska|west virginia|idaho|hawaii|new hampshire|maine|montana|rhode island|delaware|south dakota|north dakota|alaska|vermont|wyoming)\b/i);
  const stateAbbrevMap: Record<string, string> = {
    louisiana: 'LA', texas: 'TX', california: 'CA', florida: 'FL', 'new york': 'NY',
    illinois: 'IL', ohio: 'OH', georgia: 'GA', michigan: 'MI', pennsylvania: 'PA',
    'north carolina': 'NC', 'new jersey': 'NJ', virginia: 'VA', washington: 'WA',
    arizona: 'AZ', massachusetts: 'MA', tennessee: 'TN', indiana: 'IN', missouri: 'MO',
    maryland: 'MD', wisconsin: 'WI', colorado: 'CO', minnesota: 'MN', 'south carolina': 'SC',
    alabama: 'AL', kentucky: 'KY', oregon: 'OR', oklahoma: 'OK', connecticut: 'CT',
    utah: 'UT', iowa: 'IA', nevada: 'NV', arkansas: 'AR', mississippi: 'MS',
    kansas: 'KS', 'new mexico': 'NM', nebraska: 'NE', 'west virginia': 'WV',
    idaho: 'ID', hawaii: 'HI', 'new hampshire': 'NH', maine: 'ME', montana: 'MT',
    'rhode island': 'RI', delaware: 'DE', 'south dakota': 'SD', 'north dakota': 'ND',
    alaska: 'AK', vermont: 'VT', wyoming: 'WY',
  };
  const detectedStateAbbrev = stateMatch ? stateAbbrevMap[stateMatch[1].toLowerCase()] : undefined;

  const openStatesContext = isOpenStatesQuery
    ? await fetchOpenStatesContext(userText, detectedStateAbbrev).catch(() => '')
    : '';

  // ── Louisiana Legislature enrichment ─────────────────────────────────────
  const laLegislatureContext = isLALegislatureQuery
    ? await fetchLALegislatureContext(userText).catch(() => '')
    : '';

  // ── GovInfo enrichment ────────────────────────────────────────────────────
  const govInfoContext = isGovInfoQuery
    ? await fetchGovInfoContext(userText).catch(() => '')
    : '';

  const systemPromptWithKB = [
    LEXI_SYSTEM_PROMPT,
    notionKBContext || '',
    congressContext
      ? `\nREAL-TIME CONGRESS.GOV DATA FOR THIS QUERY:\n${congressContext}\nUse the above live data to inform your response. Cite bill numbers and latest actions accurately.`
      : '',
    courtListenerContext
      ? `\nREAL-TIME COURTLISTENER CASE LAW DATA:\n${courtListenerContext}\nUse these real federal court opinions to support your response. Cite case names and citations accurately.`
      : '',
    ecfrContext
      ? `\nREAL-TIME eCFR FEDERAL REGULATIONS DATA:\n${ecfrContext}\nUse these live CFR regulations to inform your response. Cite CFR titles and sections accurately.`
      : '',
    openStatesContext
      ? `\nREAL-TIME OPENSTATES BILL DATA:\n${openStatesContext}\nUse this live state legislative data to inform your response. Cite bill identifiers and status accurately.`
      : '',
    laLegislatureContext
      ? `\nREAL-TIME LOUISIANA LEGISLATURE DATA:\n${laLegislatureContext}\nUse this live Louisiana legislative data to inform your response. Cite bill numbers and authors accurately.`
      : '',
    govInfoContext
      ? `\nREAL-TIME GOVINFO (U.S. GPO) DATA:\n${govInfoContext}\nUse this official government publication data to inform your response.`
      : '',
  ].filter(Boolean).join('');

  const apiMessages = [
    { role: 'system', content: systemPromptWithKB },
    ...priorHistory,
    ...messages,
  ];

  // ── Booking Intent Injection ──────────────────────────────────────────────
  const bookingIntent = userText ? hasBookingIntent(userText) : false;

  // ── Call AI (OpenAI) ──────────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
  }

  try {
    if (stream) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      const aiRes = await fetch(`${baseUrl}/api/ai/chat-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'OPEN_AI',
          model: 'gpt-4o-mini',
          messages: apiMessages,
          stream: true,
          parameters: { max_tokens: 450 },
        }),
      });

      if (!aiRes.ok || !aiRes.body) {
        return NextResponse.json(
          { error: 'Lexi is temporarily unavailable. Please try again shortly.' },
          { status: 500 }
        );
      }

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));
            let fullContent = '';

            const reader = aiRes.body!.getReader();
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              const lines = text.split('\n');
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(raw);
                  const delta = parsed?.choices?.[0]?.delta?.content ?? '';
                  if (delta) {
                    fullContent += delta;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk: { content: delta } })}\n\n`)
                    );
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }

            if (bookingIntent && fullContent && !fullContent.includes('/availability')) {
              const nudge = BOOKING_NUDGE;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk: { content: nudge } })}\n\n`)
              );
              fullContent += nudge;
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();

            void saveSessionAndAudit({
              visitorId,
              messages,
              response: fullContent,
              ip,
            });

            if (cacheKey && fullContent) {
              setCachedResponse(cacheKey, fullContent);
            }
          } catch (err) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', error: 'Stream error' })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Non-streaming
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const aiRes = await fetch(`${baseUrl}/api/ai/chat-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'OPEN_AI',
        model: 'gpt-4o-mini',
        messages: apiMessages,
        stream: false,
        parameters: { max_tokens: 450 },
      }),
    });

    if (!aiRes.ok) {
      return NextResponse.json(
        { error: 'Lexi is temporarily unavailable. Please try again shortly.' },
        { status: 500 }
      );
    }

    const aiData = await aiRes.json();
    let content: string =
      aiData?.choices?.[0]?.message?.content ??
      aiData?.content ??
      '';

    if (bookingIntent && content && !content.includes('/availability')) {
      content += BOOKING_NUDGE;
    }

    if (cacheKey && content) {
      setCachedResponse(cacheKey, content);
    }

    void saveSessionAndAudit({ visitorId, messages, response: content, ip });

    return NextResponse.json({ content, cached: false });
  } catch (err) {
    console.error('[Lexi Chat] AI error:', err);
    return NextResponse.json(
      { error: 'Lexi is temporarily unavailable. Please try again shortly.' },
      { status: 500 }
    );
  }
}

// ─── Session Save + Audit Log ─────────────────────────────────────────────────

async function saveSessionAndAudit(params: {
  visitorId?: string;
  messages: { role: string; content: string }[];
  response: string;
  ip: string;
}) {
  const { visitorId, messages, response, ip } = params;
  const disclaimerTriggered = triggeredDisclaimer(response);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (visitorId) {
      const fullHistory = [
        ...messages,
        { role: 'assistant', content: response },
      ];

      await supabase.from('lexi_visitor_sessions').upsert(
        {
          visitor_id: visitorId,
          messages: fullHistory,
          message_count: fullHistory.length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'visitor_id' }
      );
    }

    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    await supabase.from('lexi_audit_log').insert({
      visitor_id: visitorId ?? null,
      ip_address: ip,
      user_message: lastUserMsg?.content ?? '',
      assistant_response: response.slice(0, 2000),
      disclaimer_triggered: disclaimerTriggered,
      message_count: messages.filter((m) => m.role === 'user').length,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Lexi] Session/audit save failed (non-critical):', err);
  }
}
