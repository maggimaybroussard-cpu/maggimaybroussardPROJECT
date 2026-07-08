import { NextRequest, NextResponse } from 'next/server';
import {
  sendWhatsApp,
  sendConsultationReminderWhatsApp,
  sendCaseUpdateWhatsApp,
  sendPaymentReminderWhatsApp,
  sendClientNotificationWhatsApp,
} from '@/lib/twilio/smsClient';

/**
 * POST /api/whatsapp/send
 *
 * Unified WhatsApp Business messaging endpoint via Twilio.
 * Supports: consultation_reminder, case_update, payment_reminder, client_notification, custom
 *
 * Body:
 *   type       - Message type (see switch below)
 *   to         - E.164 phone number (e.g. +15041234567)
 *   ...params  - Type-specific fields
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, to, ...params } = body;

    if (!to) {
      return NextResponse.json({ error: 'Missing required field: to' }, { status: 400 });
    }

    // Validate E.164 format
    if (!/^\+[1-9]\d{7,14}$/.test(to)) {
      return NextResponse.json(
        { error: 'Phone number must be in E.164 format (e.g. +15041234567)' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json({ error: 'Missing required field: type' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'consultation_reminder': {
        const { clientName, appointmentType, appointmentDate, appointmentTime, meetingLink, reminderType } = params;
        if (!clientName || !appointmentDate || !appointmentTime || !reminderType) {
          return NextResponse.json(
            { error: 'Missing fields: clientName, appointmentDate, appointmentTime, reminderType' },
            { status: 400 }
          );
        }
        result = await sendConsultationReminderWhatsApp({
          to,
          clientName,
          appointmentType,
          appointmentDate,
          appointmentTime,
          meetingLink,
          reminderType,
        });
        break;
      }

      case 'case_update': {
        const { clientName, caseName, updateMessage, portalLink } = params;
        if (!clientName || !caseName || !updateMessage) {
          return NextResponse.json(
            { error: 'Missing fields: clientName, caseName, updateMessage' },
            { status: 400 }
          );
        }
        result = await sendCaseUpdateWhatsApp({ to, clientName, caseName, updateMessage, portalLink });
        break;
      }

      case 'payment_reminder': {
        const { clientName, invoiceNumber, amount, dueDate, paymentLink, isOverdue } = params;
        if (!clientName || !invoiceNumber || !amount || !dueDate) {
          return NextResponse.json(
            { error: 'Missing fields: clientName, invoiceNumber, amount, dueDate' },
            { status: 400 }
          );
        }
        result = await sendPaymentReminderWhatsApp({
          to,
          clientName,
          invoiceNumber,
          amount,
          dueDate,
          paymentLink,
          isOverdue,
        });
        break;
      }

      case 'client_notification': {
        const { clientName, subject, message, actionLink, actionLabel } = params;
        if (!clientName || !subject || !message) {
          return NextResponse.json(
            { error: 'Missing fields: clientName, subject, message' },
            { status: 400 }
          );
        }
        result = await sendClientNotificationWhatsApp({
          to,
          clientName,
          subject,
          message,
          actionLink,
          actionLabel,
        });
        break;
      }

      case 'custom': {
        const { message } = params;
        if (!message) {
          return NextResponse.json({ error: 'Missing field: message' }, { status: 400 });
        }
        result = await sendWhatsApp(to, message);
        break;
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown WhatsApp message type: "${type}". Valid types: consultation_reminder, case_update, payment_reminder, client_notification, custom`,
          },
          { status: 400 }
        );
    }

    if (!result.success) {
      console.error(`[/api/whatsapp/send] Failed (type=${type}):`, result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid, channel: 'whatsapp' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/whatsapp/send] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
