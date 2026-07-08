import { NextRequest, NextResponse } from 'next/server';
import { sendMFACode, sendPaymentReminderSMS, sendAppointmentReminderSMS, sendSMS, sendWhatsApp, sendConsultationReminderWhatsApp, sendPaymentReminderWhatsApp, sendClientNotificationWhatsApp } from '@/lib/twilio/smsClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, to, channel = 'sms', ...params } = body;

    // booking_confirmation uses a different shape — handle it before the type check
    if (!type && params.reminderType === 'booking_confirmation') {
      // Called from BookingReminderSection — send a direct SMS reminder
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
        `Hi ${firstName}! Your consultation reminder is set.\n\n` +
        `📅 ${formattedDate}\n⏰ ${formattedTime}\n🔗 Google Meet: ${meetUrl}\n\n` +
        `You'll receive another reminder 24 hours before your session.\n\nReply STOP to opt out.`;

      let result = await sendSMS(to, message);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, messageSid: result.messageSid });
    }

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing required fields: type, to' }, { status: 400 });
    }

    // Route to WhatsApp channel when channel='whatsapp'
    if (channel === 'whatsapp') {
      let result;
      switch (type) {
        case 'payment_reminder': {
          const { clientName, invoiceNumber, amount, dueDate, paymentLink, isOverdue } = params;
          if (!clientName || !invoiceNumber || !amount || !dueDate) {
            return NextResponse.json({ error: 'Missing payment reminder fields' }, { status: 400 });
          }
          result = await sendPaymentReminderWhatsApp({ to, clientName, invoiceNumber, amount, dueDate, paymentLink, isOverdue });
          break;
        }
        case 'appointment_reminder': {
          const { clientName, eventName, eventDate, eventTime, reminderType } = params;
          if (!clientName || !eventDate || !eventTime || !reminderType) {
            return NextResponse.json({ error: 'Missing appointment reminder fields' }, { status: 400 });
          }
          result = await sendConsultationReminderWhatsApp({ to, clientName, appointmentType: eventName, appointmentDate: eventDate, appointmentTime: eventTime, reminderType });
          break;
        }
        case 'client_notification': {
          const { clientName, subject, message, actionLink, actionLabel } = params;
          if (!clientName || !subject || !message) {
            return NextResponse.json({ error: 'Missing client notification fields' }, { status: 400 });
          }
          result = await sendClientNotificationWhatsApp({ to, clientName, subject, message, actionLink, actionLabel });
          break;
        }
        case 'custom': {
          const { message } = params;
          if (!message) return NextResponse.json({ error: 'Missing message for custom WhatsApp' }, { status: 400 });
          result = await sendWhatsApp(to, message);
          break;
        }
        default:
          return NextResponse.json({ error: `Unknown type for WhatsApp channel: ${type}` }, { status: 400 });
      }
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, messageSid: result.messageSid, channel: 'whatsapp' });
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
