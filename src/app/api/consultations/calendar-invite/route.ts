import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatICSDate(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return `${String(y)}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}00`;
}

function addMinutes(dateStr: string, timeStr: string, minutes: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const dt = new Date(y, m - 1, d, h, min + minutes, 0);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`;
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// GET /api/consultations/calendar-invite?bookingId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const { data: booking, error } = await supabaseAdmin
      .from('consultation_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const timeStr = (booking.booking_time as string).substring(0, 5);
    const startDt = formatICSDate(booking.booking_date, timeStr);
    const endDt = addMinutes(booking.booking_date, timeStr, booking.duration_minutes || 30);
    const meetingLink = booking.meeting_location || '';
    const uid = `consultation-${bookingId}@broussardlegalservices.com`;
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Broussard Legal Services//Consultation//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=America/Chicago:${startDt}`,
      `DTEND;TZID=America/Chicago:${endDt}`,
      `SUMMARY:${escapeICS(`Consultation — Broussard Legal Services`)}`,
      `DESCRIPTION:${escapeICS(`Your ${booking.duration_minutes || 30}-minute consultation with Maggi May Broussard.\n\nJoin via Google Meet: ${meetingLink}\n\nPlease have ready:\n- Summary of your matter\n- Relevant documents\n- Your top questions\n\nBroussard Legal Services | broussardlegalservices.com`)}`,
      meetingLink ? `LOCATION:${escapeICS(meetingLink)}` : '',
      `ORGANIZER;CN=Broussard Legal Services:mailto:broussardlegalservices@gmail.com`,
      `ATTENDEE;CN=${escapeICS(booking.client_name || 'Client')};RSVP=TRUE:mailto:${booking.client_email}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:EMAIL',
      `DESCRIPTION:${escapeICS('Reminder: Consultation tomorrow with Broussard Legal Services')}`,
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS('Consultation starting in 30 minutes')}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="consultation-${bookingId}.ics"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate calendar invite' },
      { status: 500 }
    );
  }
}
