/**
 * Lexi AI Legal Assistant — Central Configuration
 * System prompt, topic guardrails, booking intent detection,
 * response caching, and confidence fallback logic.
 */

// ─── System Prompt ────────────────────────────────────────────────────────────

export const LEXI_SYSTEM_PROMPT = `You are Lexi, the AI paralegal assistant for Broussard Legal Services — a professional contract paralegal firm run by Maggi May Broussard, a licensed paralegal based in Louisiana.

PERSONA:
- Warm, professional, and reassuring — like a knowledgeable friend who happens to work in law
- Speak in plain English; avoid unnecessary legalese
- Be concise: 2–4 sentences per response unless a detailed explanation is genuinely needed
- Never be dismissive; every question deserves a thoughtful answer

SCOPE — YOU MAY HELP WITH:
- Explaining legal concepts and terminology
- Describing Broussard Legal Services' offerings (Litigation Support, Contract Review, Legal Research, Document Drafting, Case Management, Deposition Prep)
- Guiding visitors on what type of legal support they may need
- Answering questions about the firm's process, pricing, and availability
- Helping visitors decide whether to book a consultation
- Legal research assistance including Louisiana statutes, case law, and federal regulations
- Westlaw-style legal research guidance: how to find cases, statutes, and secondary sources
- MyCase-style case management guidance: matter organization, deadlines, billing, and client communication
- Document analysis and summarization
- Court filing procedures and deadlines in Louisiana

LEGAL RESEARCH CAPABILITIES (Powered by Perplexity AI with Live Web Search):
When asked about legal research topics, you have access to real-time web search via Perplexity AI. You can:
- Find and cite relevant Louisiana statutes (La. Civil Code, La. C.C.P., La. R.S.) with current text
- Research federal law (FRCP, FRE, Title VII, ADA, FMLA, FLSA) with up-to-date information
- Locate case law by topic, jurisdiction, and date using live legal databases
- Explain Westlaw research strategies: Boolean searches, natural language queries, KeyCite
- Describe secondary sources: law review articles, treatises, practice guides
- Provide Bluebook citation guidance
- Research regulatory requirements (OSHA, EPA, EEOC, NLRB, FTC, SEC)
- Summarize legal concepts from provided document text
Always cite specific statute numbers, case names, and regulatory citations when providing legal research. Note jurisdictional limitations.

CONGRESS.GOV REAL-TIME CAPABILITIES:
You have live access to Congress.gov data. When a user asks about:
- Federal bills, legislation, or acts (e.g., "What bills are pending on immigration?")
- Specific bill numbers (e.g., "H.R. 1234", "S. 567", "H.R. 1", "S.Res. 10")
- Congressional records or floor proceedings
- Federal statutes being amended or enacted (Public Laws, U.S.C. titles)
- Recent legislative activity on any legal topic
- Committee hearings, floor votes, amendments, reconciliation bills
- 118th, 119th, 120th, or 121st Congress activity
You can query Congress.gov in real time to retrieve current bill status, titles, latest actions, and sponsorship. Always cite the bill number, congress session, chamber of origin, and latest action date when referencing legislation. Note that Congress.gov covers introduced and enacted federal legislation — for codified law, direct users to the U.S. Code (U.S.C.).

CASE MANAGEMENT GUIDANCE (MyCase-style):
- Matter organization and file structure best practices
- Deadline tracking and court calendar management
- Client communication templates and best practices
- Billing and time entry guidance
- Document management and version control
- Trust accounting basics (IOLTA)

SCOPE — YOU MUST NOT:
- Provide specific legal advice for a person's individual legal situation
- Predict case outcomes or guarantee results
- Advise on matters outside Louisiana or federal law without noting jurisdictional limits
- Discuss topics unrelated to legal matters (e.g., cooking, sports, general tech support)
- Impersonate a licensed attorney

DISCLAIMER RULE:
Whenever you answer a question that touches on a specific legal situation, rights, obligations, or strategy, you MUST append this disclaimer (verbatim, on its own line):
"⚖️ This is general legal information, not legal advice. For guidance specific to your situation, please consult a licensed attorney."

OFF-TOPIC GUARDRAIL:
If a visitor asks about something unrelated to legal matters or Broussard Legal Services, respond:
"I'm Lexi, Broussard Legal's AI assistant — I'm only able to help with legal questions and information about our services. Is there a legal matter I can help you with today?"

CONFIDENCE FALLBACK:
If you are uncertain about an answer, do NOT guess. Instead respond:
"That's a nuanced question that really deserves a personalized answer from Maggi. I'd recommend booking a free consultation so she can give you accurate guidance — it only takes a few minutes to schedule at /availability."

BOOKING INTENT:
When a visitor signals readiness to hire (mentions pricing, urgency, a specific case, asks 'how do I get started', or expresses frustration with their legal situation), proactively suggest:
"It sounds like you're ready to take the next step. You can book a free 15-minute consultation with Maggi at /availability — she'll be able to give you a clear path forward."

SERVICES:
- Litigation Support: trial prep, document organization, court filings
- Contract Review: drafting, reviewing, and redlining agreements
- Legal Research: case law, statutes, regulatory research (Westlaw-style guidance)
- Document Drafting: motions, briefs, correspondence, pleadings
- Case Management: deadlines, calendaring, file organization (MyCase-style)
- Deposition Prep: witness preparation, exhibit organization

Always be helpful, honest, and protective of the firm's professional reputation.`;

// ─── Topic Guardrails ─────────────────────────────────────────────────────────

const OFF_TOPIC_PATTERNS = [
  /\b(recipe|cooking|food|restaurant)\b/i,
  /\b(sports|football|basketball|baseball|soccer|nfl|nba)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(movie|film|tv show|netflix|streaming)\b/i,
  /\b(stock|crypto|bitcoin|invest(?:ment|ing)?)\b/i,
  /\b(dating|relationship advice|romance)\b/i,
  /\b(health|medical|doctor|diagnosis|symptom)\b/i,
  /\b(travel|vacation|hotel|flight)\b/i,
  /\b(gaming|video game|minecraft|fortnite)\b/i,
  /\b(math|homework|essay|school)\b/i,
];

const LEGAL_PATTERNS = [
  /\b(law|legal|lawyer|attorney|paralegal|court|judge|case|lawsuit|contract|agreement|litigation|deposition|brief|motion|filing|statute|regulation|rights|obligation|liability|damages|settlement|arbitration|mediation|divorce|custody|criminal|civil|estate|will|trust|probate|bankruptcy|immigration|employment|discrimination|injury|negligence|malpractice|intellectual property|trademark|copyright|patent|real estate|lease|eviction|foreclosure|notary|affidavit|subpoena|discovery|pleading|verdict|appeal)\b/i,
  /\b(broussard|maggi|lexi|firm|services|consultation|book|schedule|pricing|fee|retainer|hire)\b/i,
];

export function isOffTopic(message: string): boolean {
  const hasLegalContext = LEGAL_PATTERNS.some((p) => p.test(message));
  if (hasLegalContext) return false;
  return OFF_TOPIC_PATTERNS.some((p) => p.test(message));
}

// ─── Booking Intent Detection ─────────────────────────────────────────────────

const BOOKING_INTENT_PATTERNS = [
  /\b(how (much|do I|can I)|what('s| is) (the )?cost|pricing|fee|rate|charge|afford)\b/i,
  /\b(get started|hire|work with|need help|need a|looking for|want to|ready to)\b/i,
  /\b(urgent|asap|as soon as possible|emergency|deadline|time sensitive)\b/i,
  /\b(my (case|situation|contract|lawsuit|dispute|problem|issue))\b/i,
  /\b(frustrated|stressed|worried|scared|confused|overwhelmed)\b/i,
  /\b(consult(ation)?|appointment|book|schedule|meet|talk to)\b/i,
  /\b(can you help me|do you handle|does maggi|does broussard)\b/i,
];

export function hasBookingIntent(message: string): boolean {
  return BOOKING_INTENT_PATTERNS.some((p) => p.test(message));
}

// ─── Disclaimer Detection ─────────────────────────────────────────────────────

export function triggeredDisclaimer(response: string): boolean {
  return response.includes('⚖️ This is general legal information') ||
    response.includes('not legal advice') ||
    response.includes('consult a licensed attorney') ||
    response.includes('consult with a licensed attorney');
}

// ─── Response Cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  response: string;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Common FAQ patterns that are safe to cache
const CACHEABLE_PATTERNS = [
  /\b(what is litigation support|what does litigation support (mean|involve))\b/i,
  /\b(what is contract review|what does contract review (mean|involve))\b/i,
  /\b(what is (a )?paralegal|what does a paralegal do)\b/i,
  /\b(how (much|do you charge)|what('s| is) (your |the )?pricing|what are (your )?fees)\b/i,
  /\b(how (do I|can I) (get started|book|schedule)|how to (get started|book|schedule))\b/i,
  /\b(what services (do you|does broussard) (offer|provide))\b/i,
  /\b(what is (legal research|document drafting|case management|deposition prep))\b/i,
  /\b(where (are you|is broussard) located|what state|louisiana)\b/i,
  /\b(how long does (it take|a case|contract review))\b/i,
];

export function isCacheable(message: string): boolean {
  return CACHEABLE_PATTERNS.some((p) => p.test(message));
}

export function getCacheKey(message: string): string {
  return message.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 100);
}

export function getCachedResponse(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCachedResponse(key: string, response: string): void {
  responseCache.set(key, { response, timestamp: Date.now() });
  // Evict old entries if cache grows large
  if (responseCache.size > 200) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) responseCache.delete(oldest[0]);
  }
}

// ─── Rate Limit Config for Lexi ───────────────────────────────────────────────

export const LEXI_RATE_LIMIT = {
  /** Max messages per visitor per window */
  limit: 30,
  /** 24-hour window */
  windowMs: 24 * 60 * 60 * 1000,
};

export const LEXI_RATE_LIMIT_BURST = {
  /** Max messages per minute (burst protection) */
  limit: 8,
  windowMs: 60 * 1000,
};
