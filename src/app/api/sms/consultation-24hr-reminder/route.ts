import { NextRequest, NextResponse } from 'next/server';
import { sendAppointmentReminderSMS, sendConsultationReminderWhatsApp } from '@/lib/twilio/smsClient';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/sms/consultation-24hr-reminder
 *
 * Sends a Twilio SMS 24 hours before a scheduled consultation to reduce no-shows.
 * Can be called:
 *   1. Directly from admin when scheduling a consultation
 *   2. By a cron job that queries consultation_bookings for appointments ~24hrs away
 *
 * Body:
 *   bookingId       - UUID of the consultation_bookings row (optional, for logging)
 *   clientPhone     - E.164 phone number (e.g. +15041234567)
 *   clientName      - Full name of the client
 *   appointmentDate - "YYYY-MM-DD" *   appointmentTime -"HH:MM" (24-hr, CST)
 *   appointmentType - e.g. "Paralegal Consultation" (optional)
 *   meetingLink     - Google Meet or Calendly URL (optional)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      bookingId,
      clientPhone,
      clientName,
      appointmentDate,
      appointmentTime,
      appointmentType = 'Paralegal Consultation',
      meetingLink,
      channel = 'sms',
    } = body as {
      bookingId?: string;
      clientPhone: string;
      clientName: string;
      appointmentDate: string;
      appointmentTime: string;
      appointmentType?: string;
      meetingLink?: string;
      channel?: 'sms' | 'whatsapp';
    };

    if (!clientPhone || !clientName || !appointmentDate || !appointmentTime) {
      return NextResponse.json(
        { error: 'Missing required fields: clientPhone, clientName, appointmentDate, appointmentTime' },
        { status: 400 }
      );
    }

    // Format date for display
    const [y, m, d] = appointmentDate.split('-').map(Number);
    const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Format time for display
    const [h, min] = appointmentTime.split(':').map(Number);
    const timeDate = new Date();
    timeDate.setHours(h, min, 0, 0);
    const formattedTime =
      timeDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }) + ' CST';

    const meetUrl = meetingLink || `https://broussardlegalservices.com/book-consultation`;

    // Send via selected channel
    const result = channel === 'whatsapp'
      ? await sendConsultationReminderWhatsApp({
          to: clientPhone,
          clientName,
          appointmentType,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          meetingLink: meetUrl,
          reminderType: '24hr',
        })
      : await sendAppointmentReminderSMS({
          to: clientPhone,
          clientName,
          eventName: appointmentType,
          eventDate: formattedDate,
          eventTime: formattedTime,
          reminderType: '24hr',
        });

    if (!result.success) {
      console.error('[consultation-24hr-reminder] Message failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Optionally log to Supabase if bookingId provided
    if (bookingId) {
      try {
        const supabase = await createClient();
        await supabase
          .from('consultation_reminder_logs')
          .upsert(
            {
              booking_id: bookingId,
              reminder_type: '24hr',
              recipient_phone: clientPhone,
              recipient_name: clientName,
              booking_date: appointmentDate,
              booking_time: appointmentTime,
              sms_sent: true,
              sms_sid: result.messageSid ?? null,
              sent_at: new Date().toISOString(),
              send_status: 'sent',
            },
            { onConflict: 'booking_id,reminder_type' }
          );

        await supabase
          .from('consultation_bookings')
          .update({
            reminder_24hr_sent: true,
            reminder_24hr_sent_at: new Date().toISOString(),
          })
          .eq('id', bookingId);
      } catch (logErr) {
        console.warn('[consultation-24hr-reminder] Supabase log error:', logErr);
      }
    }

    return NextResponse.json({
      success: true,
      messageSid: result.messageSid,
      sentTo: clientPhone,
      channel,
      scheduledFor: `${formattedDate} at ${formattedTime}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/consultation-24hr-reminder] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/sms/consultation-24hr-reminder
 *
 * Cron-compatible endpoint: queries consultation_bookings for appointments
 * that are ~24 hours away and haven't had a reminder sent yet, then fires SMS.
 *
 * Trigger via Vercel Cron or Supabase pg_cron every hour.
 */
export async function GET(req: NextRequest) {
  // Simple bearer token check for cron security
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Find consultations scheduled 23–25 hours from now that haven't been reminded
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const { data: bookings, error } = await supabase
      .from('consultation_bookings')
      .select('id, client_name, client_phone, client_email, booking_date, booking_time, meeting_link, appointment_type')
      .eq('status', 'confirmed')
      .eq('reminder_24hr_sent', false)
      .gte('booking_date', windowStart.toISOString().split('T')[0])
      .lte('booking_date', windowEnd.toISOString().split('T')[0]);

    if (error) throw new Error(error.message);
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No reminders due' });
    }

    const results = [];
    for (const booking of bookings) {
      if (!booking.client_phone) continue;

      const [y, m, d] = booking.booking_date.split('-').map(Number);
      const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const [h, min] = booking.booking_time.split(':').map(Number);
      const timeDate = new Date();
      timeDate.setHours(h, min, 0, 0);
      const formattedTime = timeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CST';

      const smsResult = await sendAppointmentReminderSMS({
        to: booking.client_phone,
        clientName: booking.client_name,
        eventName: booking.appointment_type || 'Paralegal Consultation',
        eventDate: formattedDate,
        eventTime: formattedTime,
        reminderType: '24hr',
      });

      if (smsResult.success) {
        await supabase
          .from('consultation_bookings')
          .update({ reminder_24hr_sent: true, reminder_24hr_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        await supabase.from('consultation_reminder_logs').insert({
          booking_id: booking.id,
          reminder_type: '24hr',
          recipient_phone: booking.client_phone,
          recipient_name: booking.client_name,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          sms_sent: true,
          sms_sid: smsResult.messageSid ?? null,
          sent_at: new Date().toISOString(),
          send_status: 'sent',
        });
      }

      results.push({ bookingId: booking.id, success: smsResult.success, error: smsResult.error });
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/consultation-24hr-reminder GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
