import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/assistant/conversation
 *
 * Internal endpoint to upsert a legal assistant conversation into Supabase.
 * Protected by x-internal-secret header (must match LEGAL_ASSISTANT_KEY).
 * Also callable directly from server-side code via pushConversationToBroussard().
 */
export async function POST(req: NextRequest) {
  // Validate x-internal-secret header
  const secret = req.headers.get('x-internal-secret');
  const expectedSecret = process.env.LEGAL_ASSISTANT_KEY;

  if (!expectedSecret) {
    console.error('LEGAL_ASSISTANT_KEY env variable is not set');
    return NextResponse.json(
      { ok: false, error: 'Server misconfiguration' },
      { status: 500 }
    );
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: {
    id?: string | number;
    userId?: string | number;
    title?: string;
    summary?: string;
    messages?: { role: string; content: string }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { id, userId, title, summary, messages } = body;

  if (!id || !title || !Array.isArray(messages)) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields: id, title, messages' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const conversationId = String(id);

  // Check if new
  const { data: existing } = await supabase
    .from('assistant_conversations')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  const isNew = !existing;

  const { error } = await supabase
    .from('assistant_conversations')
    .upsert(
      {
        conversation_id: conversationId,
        user_id: userId ? String(userId) : null,
        title: String(title),
        summary: summary ?? null,
        messages: messages,
        message_count: messages.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id' }
    );

  if (error) {
    console.error('Supabase upsert error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to save conversation' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    conversationId,
    created: isNew,
    messageCount: messages.length,
  });
}
