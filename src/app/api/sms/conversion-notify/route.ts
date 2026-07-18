import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/twilio/smsClient';

/**
 * POST /api/sms/conversion-notify
 *
 * Sends an admin SMS notification via Twilio when a key conversion event occurs.
 * Supported event types:
 *   - form_submission   : Contact/intake form submitted
 *   - checkout_flow_start : User selected a payment option and started checkout
 *   - payment_complete  : Stripe payment confirmed
 *   - portal_login      : Client logged into the portal
 *
 * Body:
 *   {
 *     event: 'form_submission' | 'checkout_flow_start' | 'payment_complete' | 'portal_login',
 *     clientName?: string,
 *     email?: string,
 *     serviceType?: string,
 *     paymentType?: string,
 *     amount?: number,
 *     transactionId?: string,
 *     method?: string,
 *   }
 */

const ADMIN_PHONE = process.env.TWILIO_ADMIN_NOTIFY_PHONE ?? process.env.TWILIO_PHONE_NUMBER ?? '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, clientName, email, serviceType, paymentType, amount, transactionId, method } = body;

    if (!event) {
      return NextResponse.json({ error: 'Missing required field: event' }, { status: 400 });
    }

    if (!ADMIN_PHONE) {
      console.warn('[conversion-notify] No admin phone configured. Set TWILIO_ADMIN_NOTIFY_PHONE.');
      return NextResponse.json({ success: false, reason: 'No admin phone configured' });
    }

    let message = '';
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

    switch (event) {
      case 'form_submission': {
        const name = clientName ?? 'Unknown';
        const service = serviceType ?? 'General Inquiry';
        const contact = email ? ` (${email})` : '';
        message =
          `🔔 NEW LEAD — Broussard Legal\n\n` +
          `📋 Form Submission\n` +
          `👤 ${name}${contact}\n` +
          `⚖️ Service: ${service}\n\n` +
          `View submissions: ${site}/admin`;
        break;
      }

      case 'checkout_flow_start': {
        const name = clientName ?? 'Prospect';
        const type = paymentType ?? 'unknown';
        const val = amount != null ? `$${amount.toLocaleString()}` : '';
        message =
          `💳 CHECKOUT STARTED — Broussard Legal\n\n` +
          `👤 ${name}\n` +
          `💰 ${type === 'consultation_deposit' ? 'Consultation Deposit' : type === 'retainer' ? 'Retainer Agreement' : 'Hourly Rate'} ${val}\n\n` +
          `Monitor: ${site}/admin`;
        break;
      }

      case 'payment_complete': {
        const name = clientName ?? 'Client';
        const type = paymentType ?? 'payment';
        const val = amount != null ? `$${amount.toLocaleString()}` : '';
        const txn = transactionId ? `\nTxn: ${transactionId}` : '';
        message =
          `✅ PAYMENT RECEIVED — Broussard Legal\n\n` +
          `👤 ${name}\n` +
          `💰 ${type === 'consultation_deposit' ? 'Consultation Deposit' : type === 'retainer' ? 'Retainer Agreement' : 'Hourly Rate'} ${val}${txn}\n\n` +
          `View payments: ${site}/admin`;
        break;
      }

      case 'portal_login': {
        const name = clientName ?? 'Client';
        const loginMethod = method ?? 'email';
        message =
          `🔐 PORTAL LOGIN — Broussard Legal\n\n` +
          `👤 ${name} signed in via ${loginMethod}\n\n` +
          `View portal activity: ${site}/admin`;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown event type: ${event}` }, { status: 400 });
    }

    const result = await sendSMS(ADMIN_PHONE, message);

    if (!result.success) {
      console.error('[conversion-notify] SMS failed:', result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageSid: result.messageSid });
  } catch (err) {
    let message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/sms/conversion-notify] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
