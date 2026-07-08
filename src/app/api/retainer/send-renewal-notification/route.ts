import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/twilio/smsClient';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      subscriptionId,
      customerName,
      customerEmail,
      customerPhone,
      planName,
      amount,
      interval,
      currentPeriodEnd,
      stripeSubscriptionId,
      channels = ['email'],
      daysBeforeExpiry,
    } = body;

    if (!subscriptionId || !customerEmail || !customerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();
    const renewalLink = `${SITE_URL}/retainer-renewal/${subscriptionId}`;
    const expiryDate = currentPeriodEnd
      ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'soon';
    const amountFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount || 0);
    const firstName = customerName.split(' ')[0];

    const results: { channel: string; status: string; error?: string }[] = [];

    // ── Email ──────────────────────────────────────────────────────────────────
    if (channels.includes('email')) {
      try {
        const urgencyColor = daysBeforeExpiry <= 7 ? '#dc2626' : daysBeforeExpiry <= 14 ? '#ea580c' : '#6366f1';
        const urgencyLabel = daysBeforeExpiry <= 0 ? 'EXPIRED' : daysBeforeExpiry <= 7 ? `${daysBeforeExpiry} DAYS LEFT` : `${daysBeforeExpiry} DAYS UNTIL RENEWAL`;

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f7f4;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e0d8;">
    <div style="background:${urgencyColor};padding:24px 32px;">
      <p style="color:white;font-size:11px;font-weight:700;letter-spacing:2px;margin:0 0 4px 0;text-transform:uppercase;">Broussard Legal Services</p>
      <h1 style="color:white;font-size:22px;margin:0;font-weight:400;">Retainer Renewal Notice</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0 0;">${urgencyLabel}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px 0;">Dear ${firstName},</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
        Your <strong style="color:#374151;">${planName}</strong> retainer agreement is coming up for renewal. 
        Please review the details below and confirm your renewal preference before the expiry date.
      </p>
      <div style="background:#f8f7f4;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;">Plan</td><td style="padding:6px 0;color:#374151;font-size:13px;font-weight:600;text-align:right;">${planName}</td></tr>
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;">Renewal Amount</td><td style="padding:6px 0;color:#374151;font-size:13px;font-weight:600;text-align:right;">${amountFmt} / ${interval}</td></tr>
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;">Expiry Date</td><td style="padding:6px 0;color:${urgencyColor};font-size:13px;font-weight:700;text-align:right;">${expiryDate}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${renewalLink}" style="display:inline-block;background:${urgencyColor};color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">
          Review &amp; Confirm Renewal →
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
        You can also enable auto-rebill to have your payment method automatically charged on the renewal date — no action needed each cycle.
        If you have questions, reply to this email or call our office.
      </p>
    </div>
    <div style="background:#f8f7f4;padding:16px 32px;border-top:1px solid #e5e0d8;">
      <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">Broussard Legal Services · broussardlegalservices.com</p>
    </div>
  </div>
</body>
</html>`;

        const { error: emailError } = await resend.emails.send({
          from: 'Broussard Legal Services <noreply@broussardlegalservices.com>',
          to: customerEmail,
          subject: `[Action Required] Your ${planName} Retainer Renews in ${daysBeforeExpiry} Day${daysBeforeExpiry !== 1 ? 's' : ''}`,
          html,
        });

        if (emailError) throw new Error(emailError.message);

        results.push({ channel: 'email', status: 'sent' });

        // Log to DB
        await supabase.from('retainer_renewal_logs').insert({
          subscription_id: subscriptionId,
          customer_name: customerName,
          customer_email: customerEmail,
          notification_type: 'renewal_reminder',
          channel: 'email',
          sent_at: new Date().toISOString(),
          status: 'sent',
          days_before_expiry: daysBeforeExpiry,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Email failed';
        results.push({ channel: 'email', status: 'failed', error: msg });
      }
    }

    // ── SMS ────────────────────────────────────────────────────────────────────
    if (channels.includes('sms') && customerPhone) {
      try {
        const smsBody = daysBeforeExpiry <= 7
          ? `Broussard Legal Services\n\nUrgent: Hi ${firstName}, your ${planName} retainer expires in ${daysBeforeExpiry} day${daysBeforeExpiry !== 1 ? 's' : ''} (${expiryDate}). Confirm renewal now: ${renewalLink}\n\nReply STOP to opt out.`
          : `Broussard Legal Services\n\nHi ${firstName}, your ${planName} retainer (${amountFmt}/${interval}) renews on ${expiryDate}. Please confirm your renewal: ${renewalLink}\n\nReply STOP to opt out.`;

        const smsResult = await sendSMS(customerPhone, smsBody);
        if (!smsResult.success) throw new Error(smsResult.error || 'SMS failed');

        results.push({ channel: 'sms', status: 'sent' });

        await supabase.from('retainer_renewal_logs').insert({
          subscription_id: subscriptionId,
          customer_name: customerName,
          customer_email: customerEmail,
          notification_type: 'renewal_reminder',
          channel: 'sms',
          sent_at: new Date().toISOString(),
          status: 'sent',
          days_before_expiry: daysBeforeExpiry,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'SMS failed';
        results.push({ channel: 'sms', status: 'failed', error: msg });
      }
    } else if (channels.includes('sms') && !customerPhone) {
      results.push({ channel: 'sms', status: 'skipped', error: 'No phone number on file' });
    }

    // Update subscription renewal_email_sent_at
    const emailResult = results.find(r => r.channel === 'email');
    if (emailResult?.status === 'sent') {
      await supabase
        .from('retainer_subscriptions')
        .update({
          renewal_email_sent_at: new Date().toISOString(),
          renewal_email_status: `manual_${daysBeforeExpiry}d_sent`,
        })
        .eq('id', subscriptionId);
    }

    const allFailed = results.every(r => r.status === 'failed');
    return NextResponse.json({
      success: !allFailed,
      results,
      message: `Renewal notification sent via ${results.filter(r => r.status === 'sent').map(r => r.channel).join(' + ') || 'no channels'}`,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
