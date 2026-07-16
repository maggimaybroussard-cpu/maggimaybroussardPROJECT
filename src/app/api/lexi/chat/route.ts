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
 */

import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
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
  // Statute/regulation research
  /\b(louisiana (revised statutes?|civil code|code of civil procedure|r\.s\.|ccp)|la\.\s*(r\.s\.|civ\.|c\.c\.|c\.c\.p\.)|louisiana law on|louisiana statute|state law on|federal law on)\b/i,
  // Legal standards and tests
  /\b(legal standard|burden of proof|elements of|prima facie|cause of action|statute of limitations|prescriptive period|peremptive period)\b/i,
  // Research methodology
  /\b(how (do I |to )?(research|find|look up|cite)|westlaw|lexisnexis|fastcase|casetext|google scholar|legal database|secondary source|law review|treatise|restatement)\b/i,
  // Specific legal topics requiring research
  /\b(what (does the law say|is the law|are the rules|are the requirements) (about|on|for|regarding)|is it legal|is that legal|legally (required|permitted|prohibited|allowed))\b/i,
  // Regulatory research
  /\b(osha|epa|eeoc|nlrb|ftc|sec regulation|federal regulation|state regulation|administrative (law|code|rule)|agency rule)\b/i,
];

function hasLegalResearchIntent(message: string): boolean {
  // Don't route to Perplexity if it's already a Congress/legislation query (handled separately)
  if (hasCongressIntent(message)) return false;
  return LEGAL_RESEARCH_PATTERNS.some((p) => p.test(message));
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

// ── Perplexity legal research call ───────────────────────────────────────────
async function fetchPerplexityLegalResearch(
  userMessage: string,
  conversationMessages: { role: string; content: string }[]
): Promise<string> {
  try {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) return '';

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    const legalResearchSystemPrompt = `You are a legal research assistant specializing in Louisiana law and federal law. 
Provide accurate, well-sourced legal research responses. Focus on:
- Relevant statutes, case law, and regulations
- Louisiana Revised Statutes, Civil Code, and Code of Civil Procedure
- Federal statutes, regulations, and case law
- Cite specific sources (statute numbers, case names, regulatory citations)
- Note jurisdictional limitations
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

  const systemPromptWithKB = [
    LEXI_SYSTEM_PROMPT,
    notionKBContext || '',
    congressContext
      ? `\nREAL-TIME CONGRESS.GOV DATA FOR THIS QUERY:\n${congressContext}\nUse the above live data to inform your response. Cite bill numbers and latest actions accurately.`
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
      const response = await completion({
        model: 'gpt-4o-mini',
        messages: apiMessages,
        stream: true,
        api_key: apiKey,
        max_completion_tokens: 450,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));
            let fullContent = '';

            for await (const chunk of response as unknown as AsyncIterable<unknown>) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`));
              if (typeof (chunk as any)?.content === 'string') {
                fullContent += (chunk as any).content;
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

            // Cache if applicable
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
    const response = await completion({
      model: 'gpt-4o-mini',
      messages: apiMessages,
      stream: false,
      api_key: apiKey,
      max_completion_tokens: 450,
    });

    let content: string =
      (response as any)?.content ??
      (response as any)?.choices?.[0]?.message?.content ??
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
