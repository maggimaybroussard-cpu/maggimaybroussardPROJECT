import { NextRequest, NextResponse } from 'next/server';
import { sendAppointmentReminderSMS, sendAppointmentConfirmationSMS } from '@/lib/twilio/smsClient';

/**
 * POST /api/sms/booking-reminder
 * Sends a booking confirmation or reminder SMS for consultations
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type = 'confirmation',
      to,
      clientName,
      appointmentType = 'Paralegal Consultation',
      appointmentDate,
      appointmentTime,
      timezone = 'America/Chicago',
      reminderType,
    } = body as {
      type?: 'confirmation' | 'reminder_24hr' | 'reminder_1hr';
      to: string;
      clientName: string;
      appointmentType?: string;
      appointmentDate: string;
      appointmentTime: string;
      timezone?: string;
      reminderType?: '24hr' | '1hr';
    };

    if (!to || !clientName || !appointmentDate || !appointmentTime) {
      return NextResponse.json({ error: 'Missing required fields: to, clientName, appointmentDate, appointmentTime' }, { status: 400 });
    }

    let result;

    if (type === 'confirmation') {
      result = await sendAppointmentConfirmationSMS({
        to,
        clientName,
        appointmentType,
        appointmentDate,
        appointmentTime,
        timezone,
      });
    } else {
      result = await sendAppointmentReminderSMS({
        to,
        clientName,
        eventName: appointmentType,
        eventDate: appointmentDate,
        eventTime: appointmentTime,
        reminderType: reminderType ?? (type === 'reminder_1hr' ? '1hr' : '24hr'),
      });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/booking-reminder] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
