import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/google-calendar/sync-event
 * Syncs a case_schedule_events row to Google Calendar.
 * Uses the stored admin OAuth refresh token to create/update/delete events.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, action = 'create' } = body as {
      eventId?: string;
      action?: 'create' | 'delete' | 'bulk';
    };

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Load Google OAuth token ──────────────────────────────────────────────
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .limit(1)
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json(
        { error: 'Google Calendar not connected. Connect via Admin → Integrations.' },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Google OAuth credentials not configured.' }, { status: 500 });
    }

    // ── Refresh access token ─────────────────────────────────────────────────
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRow.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: 'Failed to refresh Google access token. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    const accessToken: string = tokenData.access_token;
    const calendarId: string = tokenRow.calendar_id ?? 'primary';

    // ── Helper: create one Google Calendar event ─────────────────────────────
    async function syncOne(event: {
      id: string;
      title: string;
      description: string | null;
      event_date: string;
      end_date: string | null;
      location: string | null;
      event_type: string;
      case_name: string | null;
      google_calendar_event_id?: string | null;
    }): Promise<{ success: boolean; googleEventId?: string; error?: string }> {
      const colorMap: Record<string, string> = {
        court_date: '9',   // blueberry
        deadline: '11',    // tomato
        meeting: '1',      // lavender
        milestone: '5',    // banana
      };

      const startDt = new Date(event.event_date);
      const endDt = event.end_date
        ? new Date(event.end_date)
        : new Date(startDt.getTime() + 60 * 60 * 1000); // default +1 hour

      const eventBody = {
        summary: `[${event.event_type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}] ${event.title}`,
        description: [
          event.case_name ? `Case: ${event.case_name}` : null,
          event.description,
          '\n— Synced from Broussard Legal Services scheduling',
        ]
          .filter(Boolean)
          .join('\n'),
        start: { dateTime: startDt.toISOString(), timeZone: 'America/Chicago' },
        end: { dateTime: endDt.toISOString(), timeZone: 'America/Chicago' },
        colorId: colorMap[event.event_type] ?? '2',
        location: event.location ?? undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 1440 },
            { method: 'popup', minutes: 60 },
          ],
        },
      };

      // If already synced, update; otherwise create
      let gcalRes: Response;
      let method = 'POST';
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

      if (event.google_calendar_event_id) {
        method = 'PUT';
        url = `${url}/${encodeURIComponent(event.google_calendar_event_id)}`;
      }

      gcalRes = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });

      const gcalData = await gcalRes.json();

      if (!gcalRes.ok) {
        return { success: false, error: gcalData?.error?.message ?? 'Google Calendar API error' };
      }

      // Persist google_calendar_event_id back to the schedule event
      if (gcalData.id) {
        await supabase
          .from('case_schedule_events')
          .update({ google_calendar_event_id: gcalData.id })
          .eq('id', event.id);
      }

      return { success: true, googleEventId: gcalData.id };
    }

    // ── BULK: sync all upcoming events ───────────────────────────────────────
    if (action === 'bulk') {
      const { data: events, error: evErr } = await supabase
        .from('case_schedule_events')
        .select('*')
        .in('status', ['upcoming'])
        .order('event_date', { ascending: true });

      if (evErr) {
        return NextResponse.json({ error: evErr.message }, { status: 500 });
      }

      const results = await Promise.allSettled(
        (events ?? []).map((ev) => syncOne(ev))
      );

      const synced = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean }>).value.success).length;
      const failed = results.length - synced;

      return NextResponse.json({ success: true, synced, failed, total: results.length });
    }

    // ── SINGLE: sync one event ───────────────────────────────────────────────
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const { data: event, error: evErr } = await supabase
      .from('case_schedule_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (evErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === 'delete' && event.google_calendar_event_id) {
      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.google_calendar_event_id)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (delRes.status === 204 || delRes.status === 404) {
        await supabase
          .from('case_schedule_events')
          .update({ google_calendar_event_id: null })
          .eq('id', eventId);
        return NextResponse.json({ success: true, deleted: true });
      }

      return NextResponse.json({ error: 'Failed to delete from Google Calendar' }, { status: 500 });
    }

    const result = await syncOne(event);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, googleEventId: result.googleEventId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
