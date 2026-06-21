import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  sendAppointmentConfirmationSMS,
  sendAppointmentRescheduleSMS,
  sendAppointmentCancellationSMS,
  sendLexiAppointmentReminderSMS,
} from '@/lib/twilio/smsClient';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/googleCalendar';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET;

async function sendGA4Event(
  eventName: string,
  params: Record<string, unknown>,
  clientId = 'server-side'
) {
  if (!GA_MEASUREMENT_ID) return;
  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}${GA_API_SECRET ? `&api_secret=${GA_API_SECRET}` : ''}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: eventName, params }],
      }),
    });
  } catch {
    // non-blocking
  }
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  initial_consultation: 'Initial Consultation',
  follow_up: 'Follow-Up Meeting',
  document_review: 'Document Review',
  deposition_prep: 'Deposition Prep',
  strategy_session: 'Strategy Session',
  signing: 'Contract Signing',
};

function formatDateForEmail(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTimeForEmail(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ── GET — list appointments ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(req.url);
    const clientName = searchParams.get('clientName');

    let query = supabase
      .from('lexi_appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (clientName) {
      query = query.ilike('client_name', `%${clientName}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ appointments: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

// ── POST — book / reschedule / cancel / send_reminder ─────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { action } = body;

    // ── BOOK ──────────────────────────────────────────────────────────────
    if (action === 'book') {
      const {
        clientName,
        clientEmail,
        clientPhone,
        appointmentType,
        appointmentDate,
        appointmentTime,
        timezone,
        notes,
        caseRef,
      } = body;

      if (!clientName || !clientEmail || !appointmentDate || !appointmentTime) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const { data: appt, error: insertErr } = await supabase
        .from('lexi_appointments')
        .insert({
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone || null,
          appointment_type: appointmentType || 'initial_consultation',
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          timezone: timezone || 'America/Chicago',
          notes: notes || null,
          case_ref: caseRef || null,
          status: 'confirmed',
          reminder_sent: false,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Send confirmation email via Resend if available
      await sendAppointmentEmail({
        type: 'confirmation',
        clientName,
        clientEmail,
        appointmentDate,
        appointmentTime,
        timezone: timezone || 'America/Chicago',
        appointmentType: appointmentType || 'initial_consultation',
        notes,
      });

      // Send confirmation SMS via Twilio if phone provided
      if (clientPhone) {
        const typeLabel = APPOINTMENT_TYPE_LABELS[appointmentType || 'initial_consultation'] || appointmentType;
        await sendAppointmentConfirmationSMS({
          to: clientPhone,
          clientName,
          appointmentType: typeLabel,
          appointmentDate: formatDateForEmail(appointmentDate),
          appointmentTime: formatTimeForEmail(appointmentTime),
          timezone: timezone || 'America/Chicago',
        });
      }

      // Try to sync to Google Calendar (best-effort)
      try {
        await syncToGoogleCalendar({
          supabase,
          appointmentId: appt.id,
          clientName,
          clientEmail,
          appointmentDate,
          appointmentTime,
          timezone: timezone || 'America/Chicago',
          appointmentType: appointmentType || 'initial_consultation',
          notes,
        });
      } catch {
        // non-fatal — Google Calendar may not be connected
      }

      // ── GA4: appointment booked (inquiry → appointment conversion) ────────────
      void sendGA4Event(
        'inquiry_converted_to_appointment',
        {
          event_category: 'conversion',
          event_label: 'Inquiry → Lexi Appointment',
          appointment_id: appt?.id || '',
          appointment_type: appointmentType || 'initial_consultation',
          service_type: appointmentType || 'initial_consultation',
          lead_source: 'contact_form',
        },
        clientEmail || 'server-side'
      );

      return NextResponse.json({ appointment: appt, message: 'Appointment booked successfully' });
    }

    // ── RESCHEDULE ────────────────────────────────────────────────────────
    if (action === 'reschedule') {
      const { appointmentId, appointmentDate, appointmentTime, notes } = body;

      if (!appointmentId || !appointmentDate || !appointmentTime) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Fetch existing appointment
      const { data: existing, error: fetchErr } = await supabase
        .from('lexi_appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (fetchErr || !existing) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      }

      const { data: updated, error: updateErr } = await supabase
        .from('lexi_appointments')
        .update({
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          notes: notes || existing.notes,
          status: 'rescheduled',
          reminder_sent: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Update Google Calendar event if one exists
      try {
        if (existing.google_event_id) {
          await updateCalendarEvent(existing.google_event_id, {
            clientName: existing.client_name,
            clientEmail: existing.client_email,
            appointmentType: existing.appointment_type,
            appointmentDate,
            appointmentTime,
            timezone: existing.timezone,
            notes: notes || existing.notes,
          });
        } else {
          // No existing event — create a new one
          const gcalResult = await createCalendarEvent({
            clientName: existing.client_name,
            clientEmail: existing.client_email,
            appointmentType: existing.appointment_type,
            appointmentDate,
            appointmentTime,
            timezone: existing.timezone,
            notes: notes || existing.notes,
          });
          if (gcalResult?.googleEventId) {
            await supabase
              .from('lexi_appointments')
              .update({ google_event_id: gcalResult.googleEventId })
              .eq('id', appointmentId);
          }
        }
      } catch {
        // non-fatal
      }

      // Send reschedule notification email
      await sendAppointmentEmail({
        type: 'reschedule',
        clientName: existing.client_name,
        clientEmail: existing.client_email,
        appointmentDate,
        appointmentTime,
        timezone: existing.timezone,
        appointmentType: existing.appointment_type,
        notes,
      });

      // Send reschedule SMS if phone on record
      if (existing.client_phone) {
        const typeLabel = APPOINTMENT_TYPE_LABELS[existing.appointment_type] || existing.appointment_type;
        await sendAppointmentRescheduleSMS({
          to: existing.client_phone,
          clientName: existing.client_name,
          appointmentType: typeLabel,
          appointmentDate: formatDateForEmail(appointmentDate),
          appointmentTime: formatTimeForEmail(appointmentTime),
          timezone: existing.timezone,
        });
      }

      return NextResponse.json({ appointment: updated, message: 'Appointment rescheduled' });
    }

    // ── CANCEL ────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      const { appointmentId } = body;

      const { data: existing } = await supabase
        .from('lexi_appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      const { error: updateErr } = await supabase
        .from('lexi_appointments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', appointmentId);

      if (updateErr) throw updateErr;

      // Delete Google Calendar event if one exists
      if (existing?.google_event_id) {
        try {
          await deleteCalendarEvent(existing.google_event_id);
        } catch {
          // non-fatal
        }
      }

      if (existing) {
        await sendAppointmentEmail({
          type: 'cancellation',
          clientName: existing.client_name,
          clientEmail: existing.client_email,
          appointmentDate: existing.appointment_date,
          appointmentTime: existing.appointment_time,
          timezone: existing.timezone,
          appointmentType: existing.appointment_type,
        });

        // Send cancellation SMS if phone on record
        if (existing.client_phone) {
          const typeLabel = APPOINTMENT_TYPE_LABELS[existing.appointment_type] || existing.appointment_type;
          await sendAppointmentCancellationSMS({
            to: existing.client_phone,
            clientName: existing.client_name,
            appointmentType: typeLabel,
            appointmentDate: formatDateForEmail(existing.appointment_date),
            appointmentTime: formatTimeForEmail(existing.appointment_time),
          });
        }
      }

      return NextResponse.json({ message: 'Appointment cancelled' });
    }

    // ── SEND REMINDER ─────────────────────────────────────────────────────
    if (action === 'send_reminder') {
      const { appointmentId } = body;

      const { data: appt, error: fetchErr } = await supabase
        .from('lexi_appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (fetchErr || !appt) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
      }

      await sendAppointmentEmail({
        type: 'reminder',
        clientName: appt.client_name,
        clientEmail: appt.client_email,
        appointmentDate: appt.appointment_date,
        appointmentTime: appt.appointment_time,
        timezone: appt.timezone,
        appointmentType: appt.appointment_type,
        notes: appt.notes,
      });

      // Send reminder SMS if phone on record
      if (appt.client_phone) {
        const typeLabel = APPOINTMENT_TYPE_LABELS[appt.appointment_type] || appt.appointment_type;
        await sendLexiAppointmentReminderSMS({
          to: appt.client_phone,
          clientName: appt.client_name,
          appointmentType: typeLabel,
          appointmentDate: formatDateForEmail(appt.appointment_date),
          appointmentTime: formatTimeForEmail(appt.appointment_time),
          timezone: appt.timezone,
        });
      }

      await supabase
        .from('lexi_appointments')
        .update({ reminder_sent: true, updated_at: new Date().toISOString() })
        .eq('id', appointmentId);

      return NextResponse.json({ message: 'Reminder sent' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 }
    );
  }
}

async function sendAppointmentEmail(params: {
  type: 'confirmation' | 'reschedule' | 'cancellation' | 'reminder';
  clientName: string;
  clientEmail: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
  appointmentType: string;
  notes?: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || resendKey === 'your-resend-api-key-here') return;

  const typeLabel = APPOINTMENT_TYPE_LABELS[params.appointmentType] || params.appointmentType;
  const dateFormatted = formatDateForEmail(params.appointmentDate);
  const timeFormatted = formatTimeForEmail(params.appointmentTime);
  const tzShort = params.timezone === 'America/Chicago' ? 'CT' :
    params.timezone === 'America/New_York' ? 'ET' :
    params.timezone === 'America/Denver' ? 'MT' : 'PT';

  const subjects: Record<string, string> = {
    confirmation: `Appointment Confirmed — ${typeLabel} on ${dateFormatted}`,
    reschedule: `Appointment Rescheduled — ${typeLabel} now on ${dateFormatted}`,
    cancellation: `Appointment Cancelled — ${typeLabel} on ${dateFormatted}`,
    reminder: `Reminder: ${typeLabel} Tomorrow at ${timeFormatted} ${tzShort}`,
  };

  const intros: Record<string, string> = {
    confirmation: `Your appointment has been confirmed.`,
    reschedule: `Your appointment has been rescheduled to a new date and time.`,
    cancellation: `Your appointment has been cancelled. Please contact us to reschedule.`,
    reminder: `This is a friendly reminder about your upcoming appointment.`,
  };

  const htmlBody = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1a2744; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <p style="color: #fff; font-size: 18px; font-weight: bold; margin: 0;">Broussard Legal Services</p>
        <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 4px 0 0;">Lexi · Legal Secretary</p>
      </div>
      <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px; margin: 0 0 16px;">Dear ${params.clientName},</p>
        <p style="font-size: 14px; color: #374151; margin: 0 0 24px;">${intros[params.type]}</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="font-size: 13px; font-weight: bold; color: #1a2744; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Appointment Details</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; width: 120px;">Type</td><td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #111827;">${typeLabel}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Date</td><td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #111827;">${dateFormatted}</td></tr>
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Time</td><td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #111827;">${timeFormatted} ${tzShort}</td></tr>
            ${params.notes ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; vertical-align: top;">Notes</td><td style="padding: 4px 0; font-size: 13px; color: #374151;">${params.notes}</td></tr>` : ''}
          </table>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">If you have any questions, please don't hesitate to contact our office.</p>
        <p style="font-size: 13px; color: #374151; margin: 0;">Warm regards,<br/><strong>Lexi</strong><br/><span style="color: #6b7280;">Legal Secretary · Broussard Legal Services</span></p>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Lexi at Broussard Legal <lexi@broussardlegalservices.com>',
        to: [params.clientEmail],
        subject: subjects[params.type],
        html: htmlBody,
      }),
    });
  } catch {
    // email is best-effort
  }
}

async function syncToGoogleCalendar(params: {
  supabase: ReturnType<typeof createClient>;
  appointmentId: string;
  clientName: string;
  clientEmail: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
  appointmentType: string;
  notes?: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || clientId === 'your-google-client-id-here') return;

  const { data: tokenRow } = await params.supabase
    .from('google_calendar_tokens')
    .select('*')
    .limit(1)
    .single();

  if (!tokenRow?.refresh_token) return;

  // Refresh access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret!,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return;

  const typeLabel = APPOINTMENT_TYPE_LABELS[params.appointmentType] || params.appointmentType;
  const startDateTime = `${params.appointmentDate}T${params.appointmentTime}:00`;
  const endDate = new Date(`${params.appointmentDate}T${params.appointmentTime}:00`);
  endDate.setMinutes(endDate.getMinutes() + 60);
  const endDateTime = endDate.toISOString().slice(0, 19);

  const eventRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: `${typeLabel} — ${params.clientName}`,
      description: params.notes || `Appointment with ${params.clientName}`,
      start: { dateTime: startDateTime, timeZone: params.timezone },
      end: { dateTime: endDateTime, timeZone: params.timezone },
      attendees: [{ email: params.clientEmail, displayName: params.clientName }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    }),
  });

  if (eventRes.ok) {
    const eventData = await eventRes.json();
    await params.supabase
      .from('lexi_appointments')
      .update({ google_event_id: eventData.id })
      .eq('id', params.appointmentId);
  }
}
