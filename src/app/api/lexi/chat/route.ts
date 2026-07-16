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
        // Include last 6 messages from prior session for context (cost-efficient)
        priorHistory = (data.messages as { role: string; content: string }[]).slice(-6);
      }
    } catch {
      // Non-blocking — memory failure should not break the chat
    }
  }

  // ── Build Final Message Array ─────────────────────────────────────────────
  // System prompt → prior session memory → current conversation
  const notionKBContext = await getNotionKnowledgeBaseContext().catch(() => '');
  const systemPromptWithKB = notionKBContext
    ? `${LEXI_SYSTEM_PROMPT}${notionKBContext}`
    : LEXI_SYSTEM_PROMPT;

  const apiMessages = [
    { role: 'system', content: systemPromptWithKB },
    ...priorHistory,
    ...messages,
  ];

  // ── Booking Intent Injection ──────────────────────────────────────────────
  const bookingIntent = userText ? hasBookingIntent(userText) : false;

  // ── Call AI ───────────────────────────────────────────────────────────────
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
              // Accumulate for post-stream processing
              if (typeof (chunk as any)?.content === 'string') {
                fullContent += (chunk as any).content;
              }
            }

            // Post-stream: append booking nudge if intent detected
            if (bookingIntent && fullContent && !fullContent.includes('/availability')) {
              const nudge = BOOKING_NUDGE;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'chunk', chunk: { content: nudge } })}\n\n`)
              );
              fullContent += nudge;
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();

            // Async: save session + audit log (fire-and-forget)
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

    // Append booking nudge if intent detected and not already mentioned
    if (bookingIntent && content && !content.includes('/availability')) {
      content += BOOKING_NUDGE;
    }

    // Cache FAQ responses
    if (cacheKey && content) {
      setCachedResponse(cacheKey, content);
    }

    // Save session + audit log
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

    // Save/update visitor session for memory
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

    // Audit log — always log, flag if disclaimer triggered
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    await supabase.from('lexi_audit_log').insert({
      visitor_id: visitorId ?? null,
      ip_address: ip,
      user_message: lastUserMsg?.content ?? '',
      assistant_response: response.slice(0, 2000), // cap for storage
      disclaimer_triggered: disclaimerTriggered,
      message_count: messages.filter((m) => m.role === 'user').length,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking
    console.warn('[Lexi] Session/audit save failed (non-critical):', err);
  }
}
