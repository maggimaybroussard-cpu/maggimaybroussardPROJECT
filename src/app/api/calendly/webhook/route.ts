import { NextRequest, NextResponse } from 'next/server';

// Send admin notification email via Resend when a booking is made
async function sendAdminBookingNotification({
  clientName,
  clientEmail,
  eventName,
  startTime,
  timezone,
  meetingLocation,
}: {
  clientName: string;
  clientEmail: string;
  eventName: string;
  startTime: string | null;
  timezone: string;
  meetingLocation: string;
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') return;

  const formattedTime = startTime
    ? new Date(startTime).toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'Time not specified';

  const meetingHtml = meetingLocation
    ? `<p style="margin:0 0 8px;"><strong>Meeting Link:</strong> ${
        meetingLocation.includes('http')
          ? `<a href="${meetingLocation.split(' — ')[1] || meetingLocation}" style="color:#355E3B;">${meetingLocation}</a>`
          : meetingLocation
      }</p>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
      <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
        <div style="background:linear-gradient(135deg,#2d5a35,#355E3B);border-radius:6px;padding:20px 24px;margin-bottom:24px;">
          <h2 style="color:#fff;margin:0;font-size:20px;">📅 New Consultation Booked</h2>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">A prospect just scheduled a consultation via Calendly</p>
        </div>
        <p style="margin:0 0 8px;"><strong>Client Name:</strong> ${clientName}</p>
        <p style="margin:0 0 8px;"><strong>Client Email:</strong> <a href="mailto:${clientEmail}" style="color:#355E3B;">${clientEmail}</a></p>
        <p style="margin:0 0 8px;"><strong>Event:</strong> ${eventName}</p>
        <p style="margin:0 0 8px;"><strong>Scheduled Time:</strong> ${formattedTime}</p>
        ${meetingHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#6b7280;font-size:13px;margin:0;">
          View all bookings in your 
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com'}/admin" style="color:#355E3B;">Admin Dashboard</a>
        </p>
      </div>
    </div>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Broussard Legal Services <onboarding@resend.dev>',
      to: ['broussardlegalservices@gmail.com'],
      subject: `📅 New Consultation: ${clientName} — ${formattedTime}`,
      html,
    }),
  });
}

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
      const timezone: string = invitee?.timezone ?? 'America/Chicago';

      // Fire-and-forget: send admin notification via Resend
      sendAdminBookingNotification({
        clientName: invitee.name,
        clientEmail: invitee.email,
        eventName,
        startTime,
        timezone,
        meetingLocation,
      }).catch((err) => console.error('Admin booking notification error:', err));

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
          timezone,
          meetingLocation,
        }),
      }).catch((err) => console.error('Booking confirmation email error:', err));

      // Fire-and-forget: schedule the 3-step Calendly confirmation email sequence
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
          timezone,
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
          timezone,
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
