import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OverdueInvoice {
  id: string;
  client_name: string;
  client_email: string;
  amount: number;
  amount_paid: number;
  due_date: string;
  days_overdue: number;
  tier: 7 | 14 | 30;
}

async function sendSMS(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from || accountSid.startsWith('your-')) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}

async function sendEmail(to: string, clientName: string, amount: number, daysOverdue: number, invoiceId: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
  const urgency = daysOverdue >= 30 ? 'FINAL NOTICE' : daysOverdue >= 14 ? 'Second Reminder' : 'Friendly Reminder';
  const subject = `[${urgency}] Invoice #${invoiceId.slice(0, 8).toUpperCase()} — $${amount.toFixed(2)} Past Due`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Broussard Legal Services <billing@broussardlegalservices.com>',
      to: [to],
      subject,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1b2a4a;">
          <h2 style="color: #1b2a4a; margin-bottom: 8px;">Invoice Payment Reminder</h2>
          <p style="color: #666; font-size: 14px; margin-bottom: 24px;">${urgency} — ${daysOverdue} days past due</p>
          <p>Dear ${clientName},</p>
          <p>This is a ${urgency.toLowerCase()} that your invoice of <strong>$${amount.toFixed(2)}</strong> is now <strong>${daysOverdue} days past due</strong>.</p>
          ${daysOverdue >= 30 ? '<p style="color: #dc2626; font-weight: bold;">This is our final notice before this matter is referred to collections.</p>' : ''}
          <p>Please pay at your earliest convenience to avoid any service interruptions.</p>
          <a href="${siteUrl}/pay/${invoiceId}" style="display: inline-block; background: #1b2a4a; color: white; padding: 12px 28px; border-radius: 24px; text-decoration: none; font-weight: bold; margin: 16px 0;">Pay Now →</a>
          <p style="font-size: 12px; color: #999; margin-top: 32px;">If you have already paid, please disregard this notice. Questions? Reply to this email.</p>
          <p style="font-size: 12px; color: #999;">Broussard Legal Services · New Orleans, LA</p>
        </div>
      `,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Fetch all unpaid/partial invoices
    const { data: invoices, error } = await supabase
      .from('client_invoices')
      .select('id, client_name, client_email, amount, amount_paid, due_date, payment_status')
      .in('payment_status', ['unpaid', 'partial'])
      .not('due_date', 'is', null);

    if (error) throw error;

    const now = new Date();
    const overdueInvoices: OverdueInvoice[] = [];

    for (const inv of invoices ?? []) {
      const due = new Date(inv.due_date);
      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue < 7) continue;

      let tier: 7 | 14 | 30 | null = null;
      if (daysOverdue >= 30) tier = 30;
      else if (daysOverdue >= 14) tier = 14;
      else if (daysOverdue >= 7) tier = 7;

      if (tier) {
        overdueInvoices.push({
          id: inv.id,
          client_name: inv.client_name,
          client_email: inv.client_email,
          amount: Number(inv.amount) - Number(inv.amount_paid || 0),
          amount_paid: Number(inv.amount_paid || 0),
          due_date: inv.due_date,
          days_overdue: daysOverdue,
          tier,
        });
      }
    }

    if (dryRun) {
      return NextResponse.json({ dry_run: true, overdue_count: overdueInvoices.length, invoices: overdueInvoices });
    }

    const results = [];
    for (const inv of overdueInvoices) {
      // Check if we already sent a reminder at this tier
      const { data: existing } = await supabase
        .from('invoice_reminder_logs')
        .select('id')
        .eq('invoice_id', inv.id)
        .eq('tier_days', inv.tier)
        .maybeSingle();

      if (existing) continue; // Already sent for this tier

      // Send email
      if (inv.client_email) {
        await sendEmail(inv.client_email, inv.client_name, inv.amount, inv.days_overdue, inv.id);
      }

      // Log the reminder
      await supabase.from('invoice_reminder_logs').insert({
        invoice_id: inv.id,
        client_name: inv.client_name,
        client_email: inv.client_email,
        tier_days: inv.tier,
        days_overdue: inv.days_overdue,
        amount: inv.amount,
        sent_at: new Date().toISOString(),
        channel: 'email',
      }).catch(() => {});

      results.push({ invoice_id: inv.id, client: inv.client_name, tier: inv.tier, amount: inv.amount });
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  // Trigger the sequence via GET for cron jobs
  const req = new NextRequest('http://localhost/api/admin/overdue-invoice-sequence', { method: 'POST', body: JSON.stringify({}) });
  return POST(req);
}
