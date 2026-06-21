import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/googleCalendar';

function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}

// POST — create a new consultation booking and send confirmation email
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();
    const {
      clientName,
      clientEmail,
      bookingType,
      bookingDate,
      bookingTime,
      timezone,
      notes,
      userId,
      inquiryId,
    } = body;

    if (!clientName || !clientEmail || !bookingDate || !bookingTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert booking
    const { data: booking, error: insertError } = await supabase
      .from('consultation_bookings')
      .insert({
        user_id: userId ?? null,
        inquiry_id: inquiryId ?? null,
        client_name: clientName,
        client_email: clientEmail,
        booking_type: bookingType ?? 'initial_consultation',
        booking_date: bookingDate,
        booking_time: bookingTime,
        timezone: timezone ?? 'America/Chicago',
        status: 'confirmed',
        notes: notes ?? null,
        meeting_location: 'Google Meet',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Build ISO start time for email
    const startTime = new Date(`${bookingDate}T${bookingTime}`).toISOString();

    // Sync to Google Calendar (best-effort)
    let googleEventId: string | null = null;
    let googleEventLink: string | null = null;
    try {
      const gcalResult = await createCalendarEvent({
        clientName,
        clientEmail,
        appointmentType: bookingType ?? 'initial_consultation',
        appointmentDate: bookingDate,
        appointmentTime: bookingTime,
        timezone: timezone ?? 'America/Chicago',
        notes: notes ?? null,
        meetingLocation: 'Google Meet',
      });
      if (gcalResult) {
        googleEventId = gcalResult.googleEventId;
        googleEventLink = gcalResult.htmlLink;
        // Persist Google event ID on the booking
        await supabase
          .from('consultation_bookings')
          .update({ google_event_id: googleEventId })
          .eq('id', booking.id);
      }
    } catch {
      // non-fatal — booking still created even if calendar sync fails
    }

    // Send confirmation email via Supabase edge function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-booking-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          clientEmail,
          clientName,
          eventName: bookingType === 'case_checkin' ? 'Case Check-In' : 'Initial Consultation',
          startTime,
          timezone: timezone ?? 'America/Chicago',
          meetingLocation: 'Google Meet',
        }),
      });

      // Mark confirmation sent
      await supabase
        .from('consultation_bookings')
        .update({ confirmation_sent: true })
        .eq('id', booking.id);
    } catch {
      // Non-blocking — booking still created even if email fails
    }

    return NextResponse.json({
      booking,
      success: true,
      googleEventId,
      googleEventLink,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create booking' },
      { status: 500 }
    );
  }
}

// GET — fetch bookings for a user or all (admin)
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let query = supabase
      .from('consultation_bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (status && status !== 'all') query = query.eq('status', status);
    if (dateFrom) query = query.gte('booking_date', dateFrom);
    if (dateTo) query = query.lte('booking_date', dateTo);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ bookings: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

// PATCH — update booking status (reschedule or cancel)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();
    const { id, status, cancellationReason, bookingDate, bookingTime, timezone, notes } = body;

    if (!id) return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });

    // Fetch existing booking to get Google event ID and client info
    const { data: existing } = await supabase
      .from('consultation_bookings')
      .select('*')
      .eq('id', id)
      .single();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      if (cancellationReason) updates.cancellation_reason = cancellationReason;
    }
    if (bookingDate) updates.booking_date = bookingDate;
    if (bookingTime) updates.booking_time = bookingTime;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('consultation_bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Sync Google Calendar changes (best-effort)
    if (existing) {
      try {
        if (status === 'cancelled' && existing.google_event_id) {
          await deleteCalendarEvent(existing.google_event_id);
          await supabase
            .from('consultation_bookings')
            .update({ google_event_id: null })
            .eq('id', id);
        } else if (bookingDate && bookingTime && existing.google_event_id) {
          // Reschedule — update existing event
          const { updateCalendarEvent } = await import('@/lib/googleCalendar');
          await updateCalendarEvent(existing.google_event_id, {
            clientName: existing.client_name,
            clientEmail: existing.client_email,
            appointmentType: existing.booking_type,
            appointmentDate: bookingDate,
            appointmentTime: bookingTime,
            timezone: timezone ?? existing.timezone ?? 'America/Chicago',
            notes: notes ?? existing.notes,
            meetingLocation: existing.meeting_location,
          });
        } else if (bookingDate && bookingTime && !existing.google_event_id) {
          // Reschedule but no existing event — create one
          const { createCalendarEvent: createEvent } = await import('@/lib/googleCalendar');
          const gcalResult = await createEvent({
            clientName: existing.client_name,
            clientEmail: existing.client_email,
            appointmentType: existing.booking_type,
            appointmentDate: bookingDate,
            appointmentTime: bookingTime,
            timezone: timezone ?? existing.timezone ?? 'America/Chicago',
            notes: notes ?? existing.notes,
            meetingLocation: existing.meeting_location,
          });
          if (gcalResult?.googleEventId) {
            await supabase
              .from('consultation_bookings')
              .update({ google_event_id: gcalResult.googleEventId })
              .eq('id', id);
          }
        }
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ booking: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update booking' },
      { status: 500 }
    );
  }
}
