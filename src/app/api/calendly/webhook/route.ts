import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body?.event;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase env vars');
      return NextResponse.json({ received: true });
    }

    // ── NEW BOOKING ──────────────────────────────────────────────────────────
    if (eventType === 'invitee.created') {
      const payload = body?.payload;
      const invitee = payload?.invitee;
      const scheduledEvent = payload?.scheduled_event;

      if (!invitee?.email || !invitee?.name) {
        return NextResponse.json({ received: true });
      }

      // Extract Calendly event UUID from the scheduled_event URI
      // e.g. "https://api.calendly.com/scheduled_events/XXXXXXXX"
      const calendlyEventUri: string = scheduledEvent?.uri ?? '';
      const calendlyEventUuid = calendlyEventUri.split('/').pop() ?? null;

      // Extract invitee UUID from invitee URI
      const inviteeUri: string = invitee?.uri ?? '';
      const inviteeUuid = inviteeUri.split('/').pop() ?? null;

      // Determine meeting location label
      const locationObj = scheduledEvent?.location;
      let meetingLocation = '';
      if (locationObj?.type === 'google_conference' || locationObj?.join_url) {
        meetingLocation = locationObj?.join_url
          ? `Google Meet — ${locationObj.join_url}`
          : 'Google Meet (link in calendar invite)';
      } else if (locationObj?.type === 'zoom_conference') {
        meetingLocation = locationObj?.join_url
          ? `Zoom — ${locationObj.join_url}`
          : 'Zoom (link in calendar invite)';
      } else if (locationObj?.location) {
        meetingLocation = locationObj.location;
      }

      const eventName: string = scheduledEvent?.name ?? '30-Minute Consultation';
      const startTime: string | null = scheduledEvent?.start_time ?? null;
      const endTime: string | null = scheduledEvent?.end_time ?? null;

      // Fire-and-forget: send booking confirmation email to the client
      fetch(`${supabaseUrl}/functions/v1/send-booking-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          clientEmail: invitee.email,
          clientName: invitee.name,
          eventName,
          startTime,
          timezone: invitee?.timezone ?? 'America/Chicago',
          meetingLocation,
        }),
      }).catch((err) => console.error('Booking confirmation email error:', err));

      // Fire-and-forget: schedule the 3-step Calendly confirmation email sequence
      // Step 1 (immediate): Booking confirmation details
      // Step 2 (Day 1):     Consultation prep instructions
      // Step 3 (Day 3):     Client portal access info
      fetch(`${supabaseUrl}/functions/v1/schedule-calendly-confirmation-sequence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          recipientEmail: invitee.email,
          recipientName: invitee.name,
          eventName,
          startTime,
          timezone: invitee?.timezone ?? 'America/Chicago',
          meetingLocation,
        }),
      }).catch((err) => console.error('Calendly confirmation sequence error:', err));

      // Fire-and-forget: update inquiry booking_stage, populate Calendly fields,
      // write timeline entry, and schedule post-booking sequences
      fetch(`${supabaseUrl}/functions/v1/handle-calendly-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: invitee.email,
          name: invitee.name,
          eventName,
          startTime,
          endTime,
          meetingLocation,
          calendlyEventUuid,
          inviteeUuid,
          timezone: invitee?.timezone ?? 'America/Chicago',
        }),
      }).catch(() => {
        // Non-blocking — ignore gracefully
      });

      return NextResponse.json({ received: true });
    }

    // ── CANCELLATION ─────────────────────────────────────────────────────────
    if (eventType === 'invitee.canceled') {
      const payload = body?.payload;
      const invitee = payload?.invitee;
      const scheduledEvent = payload?.scheduled_event;

      if (!invitee?.email) {
        return NextResponse.json({ received: true });
      }

      const calendlyEventUri: string = scheduledEvent?.uri ?? '';
      const calendlyEventUuid = calendlyEventUri.split('/').pop() ?? null;
      const cancelReason: string = payload?.cancellation?.reason ?? '';

      // Fire-and-forget: handle cancellation in the portal
      fetch(`${supabaseUrl}/functions/v1/handle-calendly-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: invitee.email,
          name: invitee.name ?? '',
          action: 'canceled',
          calendlyEventUuid,
          cancelReason,
        }),
      }).catch(() => {});

      return NextResponse.json({ received: true });
    }

    // All other events — acknowledge silently
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Calendly webhook error:', err);
    // Always return 200 so Calendly doesn't retry
    return NextResponse.json({ received: true });
  }
}

// Calendly sends GET to verify the endpoint during setup
export async function GET() {
  return NextResponse.json({ ok: true });
}
