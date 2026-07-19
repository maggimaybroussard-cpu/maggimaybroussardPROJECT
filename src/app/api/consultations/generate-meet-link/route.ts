import { NextRequest, NextResponse } from 'next/server';

// Generate a Google Meet link via Google Calendar API
// Falls back to a Calendly link if Google credentials are not configured
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, startTime, endTime, attendeeEmail, attendeeName, bookingId } = body;

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // If Google credentials are not configured, return a Calendly fallback
    if (!clientId || clientId.startsWith('your-')) {
      const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/broussardlegal';
      return NextResponse.json({
        success: true,
        meet_link: calendlyUrl,
        source: 'calendly_fallback',
        message: 'Google Meet not configured — using Calendly link',
      });
    }

    // Try to get stored Google OAuth tokens from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, refresh_token, expires_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tokenRow?.access_token) {
      const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/broussardlegal';
      return NextResponse.json({
        success: true,
        meet_link: calendlyUrl,
        source: 'calendly_fallback',
        message: 'Google Calendar not authorized — using Calendly link',
      });
    }

    // Create Google Calendar event with Meet link
    const eventBody = {
      summary: title || 'Consultation — Broussard Legal Services',
      description: `Consultation booking${bookingId ? ` (Booking ID: ${bookingId})` : ''}`,
      start: { dateTime: startTime, timeZone: 'America/Chicago' },
      end: { dateTime: endTime, timeZone: 'America/Chicago' },
      attendees: attendeeEmail ? [{ email: attendeeEmail, displayName: attendeeName || '' }] : [],
      conferenceData: {
        createRequest: {
          requestId: `bls-${bookingId || Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!calRes.ok) {
      const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/broussardlegal';
      return NextResponse.json({
        success: true,
        meet_link: calendlyUrl,
        source: 'calendly_fallback',
        message: 'Google Calendar event creation failed — using Calendly link',
      });
    }

    const calData = await calRes.json();
    const meetLink = calData.conferenceData?.entryPoints?.find(
      (ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video'
    )?.uri || calData.hangoutLink;

    return NextResponse.json({
      success: true,
      meet_link: meetLink || `https://meet.google.com/bls-${Date.now()}`,
      event_id: calData.id,
      source: 'google_meet',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
