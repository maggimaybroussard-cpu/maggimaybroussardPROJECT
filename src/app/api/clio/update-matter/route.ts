import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getValidToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: token } = await supabase
    .from('clio_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!token) throw new Error('No Clio token found. Please connect Clio first.');

  if (new Date(token.expires_at) < new Date()) {
    const clientId = process.env.CLIO_CLIENT_ID;
    const clientSecret = process.env.CLIO_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Clio credentials not configured.');

    const refreshRes = await fetch('https://app.clio.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }),
    });

    if (!refreshRes.ok) throw new Error('Failed to refresh Clio token. Please reconnect.');

    const refreshed = await refreshRes.json();
    const expiresAt = new Date(Date.now() + (refreshed.expires_in ?? 2592000) * 1000).toISOString();

    await supabase.from('clio_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('clio_tokens').insert({
      access_token: refreshed.access_token,
      refresh_token: token.refresh_token,
      token_type: 'bearer',
      expires_at: expiresAt,
      clio_user_id: token.clio_user_id,
      clio_user_name: token.clio_user_name,
      clio_account_id: token.clio_account_id,
    });

    return refreshed.access_token as string;
  }

  return token.access_token as string;
}

// Maps outcome type → Clio matter status
const OUTCOME_TO_CLIO_STATUS: Record<string, string> = {
  resolved: 'Closed',
  escalated: 'Open',
  ongoing: 'Open',
  pending: 'Pending',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clio_matter_clio_id, outcome_type, notes_html, client_name, consultation_date } = body;

    if (!clio_matter_clio_id) {
      return NextResponse.json({ error: 'clio_matter_clio_id is required' }, { status: 400 });
    }
    if (!outcome_type) {
      return NextResponse.json({ error: 'outcome_type is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const accessToken = await getValidToken(supabase);

    const clioStatus = OUTCOME_TO_CLIO_STATUS[outcome_type.toLowerCase()] ?? 'Open';

    // 1. Update matter status in Clio
    const matterRes = await fetch(
      `https://app.clio.com/api/v4/matters/${clio_matter_clio_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          data: { status: clioStatus },
        }),
      }
    );

    if (!matterRes.ok) {
      const txt = await matterRes.text();
      throw new Error(`Clio matter update failed (${matterRes.status}): ${txt}`);
    }

    // 2. Add a note to the matter in Clio
    const noteDate = consultation_date ?? new Date().toISOString().split('T')[0];
    const plainNotes = notes_html
      ? notes_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    const noteBody = [
      `Consultation Outcome: ${outcome_type.charAt(0).toUpperCase() + outcome_type.slice(1)}`,
      client_name ? `Client: ${client_name}` : '',
      `Date: ${noteDate}`,
      plainNotes ? `\nNotes:\n${plainNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const noteRes = await fetch('https://app.clio.com/api/v4/notes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        data: {
          subject: `Consultation Outcome — ${outcome_type.charAt(0).toUpperCase() + outcome_type.slice(1)}`,
          detail: noteBody,
          matter: { id: clio_matter_clio_id },
          date: noteDate,
        },
      }),
    });

    let noteId: number | null = null;
    if (noteRes.ok) {
      const noteData = await noteRes.json();
      noteId = noteData?.data?.id ?? null;
    }

    // 3. Also update local clio_matters table status
    await supabase
      .from('clio_matters')
      .update({ status: clioStatus, updated_at: new Date().toISOString() })
      .eq('clio_id', clio_matter_clio_id);

    return NextResponse.json({
      success: true,
      clio_status: clioStatus,
      note_id: noteId,
    });
  } catch (err) {
    console.error('[clio/update-matter]', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
