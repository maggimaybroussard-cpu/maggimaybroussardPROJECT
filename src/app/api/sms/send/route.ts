import { NextRequest, NextResponse } from 'next/server';
import {
  sendSMS,
  sendMFACode,
  sendPaymentReminderSMS,
  sendAppointmentReminderSMS,
  sendAppointmentConfirmationSMS,
  sendLeadResponseSMS,
  sendAbandonedBookingSMS,
} from '@/lib/twilio/smsClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, to, ...params } = body;

    // booking_confirmation uses a different shape — handle it before the type check
    if (!type && params.reminderType === 'booking_confirmation') {
      const { name, bookingDate, bookingTime, meetingLink } = params;
      if (!to || !name || !bookingDate || !bookingTime) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const firstName = name.split(' ')[0];
      const [y, m, d] = bookingDate.split('-').map(Number);
      const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const [h, min] = bookingTime.split(':').map(Number);
      const t = new Date();
      t.setHours(h, min, 0, 0);
      const formattedTime = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' CST';
      const meetUrl = meetingLink || 'https://broussardlegalservices.com/book-consultation';

      const message =
        `Maggi May Broussard Legal Services\n\n` +
        `Hi ${firstName}! ✅ Your consultation is CONFIRMED.\n\n` +
        `📅 ${formattedDate}\n⏰ ${formattedTime}\n🔗 Google Meet: ${meetUrl}\n\n` +
        `You'll receive a reminder 24 hours before your session.\n\n` +
        `Questions? Visit broussardlegalservices.com\n\nReply STOP to opt out.`;

      let result = await sendSMS(to, message);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, messageSid: result.messageSid });
    }

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing required fields: type, to' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'mfa': {
        const { code } = params;
        if (!code) return NextResponse.json({ error: 'Missing code for MFA SMS' }, { status: 400 });
        result = await sendMFACode(to, code);
        break;
      }

      case 'payment_reminder': {
        const { clientName, invoiceNumber, amount, dueDate, paymentLink, isOverdue } = params;
        if (!clientName || !invoiceNumber || !amount || !dueDate) {
          return NextResponse.json({ error: 'Missing payment reminder fields' }, { status: 400 });
        }
        result = await sendPaymentReminderSMS({ to, clientName, invoiceNumber, amount, dueDate, paymentLink, isOverdue });
        break;
      }

      case 'appointment_reminder': {
        const { clientName, eventName, eventDate, eventTime, reminderType } = params;
        if (!clientName || !eventDate || !eventTime || !reminderType) {
          return NextResponse.json({ error: 'Missing appointment reminder fields' }, { status: 400 });
        }
        result = await sendAppointmentReminderSMS({ to, clientName, eventName, eventDate, eventTime, reminderType });
        break;
      }

      case 'booking_confirmation': {
        const { clientName, appointmentType, appointmentDate, appointmentTime, timezone } = params;
        if (!clientName || !appointmentDate || !appointmentTime) {
          return NextResponse.json({ error: 'Missing booking confirmation fields' }, { status: 400 });
        }
        result = await sendAppointmentConfirmationSMS({
          to,
          clientName,
          appointmentType: appointmentType ?? 'Paralegal Consultation',
          appointmentDate,
          appointmentTime,
          timezone: timezone ?? 'America/Chicago',
        });
        break;
      }

      case 'lead_response': {
        const { clientName, service } = params;
        if (!clientName) return NextResponse.json({ error: 'Missing clientName for lead response SMS' }, { status: 400 });
        result = await sendLeadResponseSMS({ to, clientName, service: service ?? 'legal services' });
        break;
      }

      case 'abandoned_booking': {
        const { clientName, service } = params;
        if (!clientName) return NextResponse.json({ error: 'Missing clientName for abandoned booking SMS' }, { status: 400 });
        result = await sendAbandonedBookingSMS({ to, clientName, service });
        break;
      }

      case 'consultation_followup': {
        const { clientName, bookingDate, service } = params;
        if (!clientName || !bookingDate) {
          return NextResponse.json({ error: 'Missing fields for consultation follow-up SMS' }, { status: 400 });
        }
        const firstName = clientName.split(' ')[0];
        const [y, m, d] = bookingDate.split('-').map(Number);
        const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        });
        const message =
          `Maggi May Broussard Legal Services\n\n` +
          `Hi ${firstName}, it's been 48 hours since your ${service ?? 'consultation'} on ${formattedDate}.\n\n` +
          `We'd love your feedback and want to make sure you have your next steps.\n\n` +
          `Access your portal: https://broussardlegalservices.com/portal/dashboard\n\n` +
          `Reply STOP to opt out.`;
        result = await sendSMS(to, message);
        break;
      }

      case 'custom': {
        const { message } = params;
        if (!message) return NextResponse.json({ error: 'Missing message for custom SMS' }, { status: 400 });
        result = await sendSMS(to, message);
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown SMS type: ${type}` }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/send] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
