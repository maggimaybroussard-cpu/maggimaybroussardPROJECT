import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pushConversationToBroussard } from '@/lib/broussard';

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSessionKey(clientName: string, caseRef?: string) {
  const base = slugify(clientName);
  const ref = caseRef ? `-${slugify(caseRef)}` : '';
  return `${base}${ref}`;
}

// GET /api/lexi/session?clientName=...&caseRef=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get('clientName')?.trim();
    const caseRef = searchParams.get('caseRef')?.trim() || undefined;

    if (!clientName) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }

    const sessionKey = buildSessionKey(clientName, caseRef);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lexi_case_sessions')
      .select('*')
      .eq('session_key', sessionKey)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      throw error;
    }

    return NextResponse.json({ session: data || null });
  } catch (err) {
    console.error('Lexi session GET error:', err);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}

// POST /api/lexi/session — upsert session data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientName,
      caseRef,
      conversationHistory,
      caseSummary,
      totalHoursLogged,
      draftEmailContext,
      alertHistory,
      metadata,
      userId,
    } = body;

    if (!clientName) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }

    const sessionKey = buildSessionKey(clientName, caseRef);
    const supabase = await createClient();

    const upsertData: Record<string, unknown> = {
      session_key: sessionKey,
      client_name: clientName,
      case_ref: caseRef || null,
      last_activity_at: new Date().toISOString(),
    };

    if (conversationHistory !== undefined) upsertData.conversation_history = conversationHistory;
    if (caseSummary !== undefined) upsertData.case_summary = caseSummary;
    if (totalHoursLogged !== undefined) upsertData.total_hours_logged = totalHoursLogged;
    if (draftEmailContext !== undefined) upsertData.draft_email_context = draftEmailContext;
    if (alertHistory !== undefined) upsertData.alert_history = alertHistory;
    if (metadata !== undefined) upsertData.metadata = metadata;

    const { data, error } = await supabase
      .from('lexi_case_sessions')
      .upsert(upsertData, { onConflict: 'session_key' })
      .select()
      .single();

    if (error) throw error;

    // Sync conversation to Broussard after saving to Supabase
    if (data && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      await pushConversationToBroussard({
        id: data.id,
        userId: userId,
        title: (caseSummary?.trim() || `${clientName}${caseRef ? ` — ${caseRef}` : ''}`),
        messages: conversationHistory.map((m: { role?: string; from?: string; content?: string; text?: string }) => ({
          role: m.role ?? (m.from === 'bot' ? 'assistant' : 'user'),
          content: m.content ?? m.text ?? '',
        })),
      });
    }

    return NextResponse.json({ session: data });
  } catch (err) {
    console.error('Lexi session POST error:', err);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

// GET /api/lexi/session/list — list recent sessions
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lexi_case_sessions')
      .select('id, session_key, client_name, case_ref, case_summary, total_hours_logged, last_activity_at, alert_history')
      .order('last_activity_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ sessions: data || [] });
  } catch (err) {
    console.error('Lexi session list error:', err);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
