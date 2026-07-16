import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/google-calendar/status
 * Returns whether Google Calendar is connected and which account.
 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('account_email, calendar_id, updated_at')
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      accountEmail: data.account_email,
      calendarId: data.calendar_id,
      connectedAt: data.updated_at,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

/**
 * DELETE /api/google-calendar/status
 * Disconnects Google Calendar by removing stored tokens.
 */
export async function DELETE() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('google_calendar_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
