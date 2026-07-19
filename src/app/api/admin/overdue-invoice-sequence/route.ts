/**
 * Overdue Invoice Sequence Trigger
 * Escalating Twilio SMS + Resend emails at 7, 14, and 30 days past due
 * Called by cron or admin trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
};

async function sendTwilioSMS(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
        body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Broussard Legal Services <billing@broussardlegalservices.com>',
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildEmailHtml(clientName: string, amountDue: number, daysOverdue: number, tier: number, paymentUrl: string): string {
  const urgency = tier === 3 ? 'FINAL NOTICE' : tier === 2 ? 'Second Notice' : 'Payment Reminder';
  const urgencyColor = tier === 3 ? '#DC2626' : tier === 2 ? '#D97706' : '#355E3B';
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountDue);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${brand.bg};font-family:Georgia,serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="background:white;border-radius:16px;border:1px solid ${brand.border};overflow:hidden">
      <div style="background:${brand.primary};padding:32px;text-align:center">
        <p style="color:#C8965A;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">Broussard Legal Services</p>
        <h1 style="color:white;font-size:22px;margin:0">${urgency}</h1>
      </div>
      <div style="padding:32px">
        <p style="color:${brand.foreground};font-size:16px;margin:0 0 16px">Dear ${clientName},</p>
        <p style="color:${brand.muted};font-size:15px;line-height:1.6;margin:0 0 24px">
          ${tier === 1
            ? 'This is a friendly reminder that your invoice is now 7 days past due.'
            : tier === 2
            ? 'Your invoice is now 14 days past due. Please arrange payment at your earliest convenience to avoid further action.' :'Your invoice is now 30 days past due. This is a final notice. Please contact us immediately to resolve this balance.'}
        </p>
        <div style="background:${brand.bg};border-radius:12px;padding:20px;margin:0 0 24px;border:1px solid ${brand.border}">
          <p style="margin:0 0 8px;color:${brand.muted};font-size:13px">Amount Due</p>
          <p style="margin:0;font-size:28px;font-weight:bold;color:${urgencyColor}">${amount}</p>
          <p style="margin:4px 0 0;color:${brand.muted};font-size:13px">${daysOverdue} days past due</p>
        </div>
        <a href="${paymentUrl}" style="display:block;background:${urgencyColor};color:white;text-align:center;padding:16px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:bold;margin:0 0 24px">
          Pay Now →
        </a>
        <p style="color:${brand.muted};font-size:13px;line-height:1.6">
          Questions? Reply to this email or call us at (504) 458-2831.
        </p>
      </div>
      <div style="background:${brand.bg};padding:20px;text-align:center;border-top:1px solid ${brand.border}">
        <p style="color:${brand.muted};font-size:12px;margin:0">Broussard Legal Services · 900 Camp Street Suite 3rd Fl. PMB 70111 · New Orleans, LA 70130</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  // Verify admin auth
  const authHeader = req.headers.get('authorization');
  const adminKey = process.env.LEGAL_ASSISTANT_KEY || '';
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { invoiceId, dryRun = false } = body as { invoiceId?: string; dryRun?: boolean };

    // Fetch overdue invoices
    let query = supabaseAdmin
      .from('client_invoices')
      .select('id, inquiry_id, client_name, client_email, client_phone, amount_due, due_date, status')
      .in('status', ['sent', 'overdue', 'unpaid'])
      .not('due_date', 'is', null);

    if (invoiceId) query = query.eq('id', invoiceId);

    const { data: invoices, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const now = new Date();
    const results: { invoiceId: string; tier: number; smsSent: boolean; emailSent: boolean; skipped: boolean }[] = [];

    for (const invoice of invoices ?? []) {
      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue < 7) continue; // Not yet overdue enough

      // Determine tier
      const tier = daysOverdue >= 30 ? 3 : daysOverdue >= 14 ? 2 : 1;

      // Check existing sequence record
      const { data: existing } = await supabaseAdmin
        .from('overdue_invoice_sequences')
        .select('*')
        .eq('invoice_id', invoice.id)
        .maybeSingle();

      // Skip if already sent for this tier
      const alreadySentSMS = tier === 1 ? existing?.sms_sent_7d : tier === 2 ? existing?.sms_sent_14d : existing?.sms_sent_30d;
      const alreadySentEmail = tier === 1 ? existing?.email_sent_7d : tier === 2 ? existing?.email_sent_14d : existing?.email_sent_30d;

      if (alreadySentSMS && alreadySentEmail) {
        results.push({ invoiceId: invoice.id, tier, smsSent: false, emailSent: false, skipped: true });
        continue;
      }

      if (dryRun) {
        results.push({ invoiceId: invoice.id, tier, smsSent: false, emailSent: false, skipped: false });
        continue;
      }

      const paymentUrl = `${SITE_URL}/pay/${invoice.id}`;
      const clientName = invoice.client_name ?? 'Valued Client';
      const amountDue = invoice.amount_due ?? 0;
      const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountDue);

      // Send SMS
      let smsSent = false;
      if (!alreadySentSMS && invoice.client_phone) {
        const smsBody = tier === 3
          ? `FINAL NOTICE — Broussard Legal Services: Your invoice of ${amount} is 30 days past due. Pay now: ${paymentUrl} or call (504) 458-2831.`
          : tier === 2
          ? `Broussard Legal Services: Your invoice of ${amount} is 14 days past due. Please pay at: ${paymentUrl}`
          : `Broussard Legal Services: Friendly reminder — your invoice of ${amount} was due ${daysOverdue} days ago. Pay here: ${paymentUrl}`;
        smsSent = await sendTwilioSMS(invoice.client_phone, smsBody);
      }

      // Send email
      let emailSent = false;
      if (!alreadySentEmail && invoice.client_email) {
        const subject = tier === 3
          ? `FINAL NOTICE: Invoice ${daysOverdue} Days Past Due — Broussard Legal Services`
          : tier === 2
          ? `Second Notice: Invoice ${daysOverdue} Days Past Due — Broussard Legal Services`
          : `Payment Reminder: Invoice Due ${daysOverdue} Days Ago — Broussard Legal Services`;
        const html = buildEmailHtml(clientName, amountDue, daysOverdue, tier, paymentUrl);
        emailSent = await sendResendEmail(invoice.client_email, subject, html);
      }

      // Upsert sequence record
      const updateFields: Record<string, unknown> = {
        invoice_id: invoice.id,
        inquiry_id: invoice.inquiry_id ?? null,
        client_name: clientName,
        client_email: invoice.client_email ?? null,
        client_phone: invoice.client_phone ?? null,
        amount_due: amountDue,
        due_date: invoice.due_date,
        days_overdue: daysOverdue,
        tier,
        last_action_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      if (tier === 1) { updateFields.sms_sent_7d = smsSent || (existing?.sms_sent_7d ?? false); updateFields.email_sent_7d = emailSent || (existing?.email_sent_7d ?? false); }
      if (tier === 2) { updateFields.sms_sent_14d = smsSent || (existing?.sms_sent_14d ?? false); updateFields.email_sent_14d = emailSent || (existing?.email_sent_14d ?? false); }
      if (tier === 3) { updateFields.sms_sent_30d = smsSent || (existing?.sms_sent_30d ?? false); updateFields.email_sent_30d = emailSent || (existing?.email_sent_30d ?? false); }

      if (existing) {
        await supabaseAdmin.from('overdue_invoice_sequences').update(updateFields).eq('id', existing.id);
      } else {
        await supabaseAdmin.from('overdue_invoice_sequences').insert(updateFields);
      }

      results.push({ invoiceId: invoice.id, tier, smsSent, emailSent, skipped: false });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      dryRun,
    });
  } catch (err) {
    console.error('[overdue-sequence]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: check status
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('overdue_invoice_sequences')
    .select('*')
    .eq('resolved', false)
    .order('days_overdue', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sequences: data ?? [] });
}
