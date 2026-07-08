import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

// POST /api/retainer/renewal-check-30day
// Scans all active subscriptions and sends 30-day renewal notifications
// Call daily via cron

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dryRun === true;
    } catch { /* no body */ }

    const { data: subscriptions, error } = await supabase
      .from('retainer_subscriptions')
      .select('id, customer_name, customer_email, plan_name, amount, currency, billing_interval, current_period_end, stripe_subscription_id, stripe_customer_id, renewal_email_sent_at, status, cancel_at_period_end, auto_renew_enabled')
      .eq('status', 'active')
      .eq('cancel_at_period_end', false)
      .not('current_period_end', 'is', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subscriptions?.length) return NextResponse.json({ success: true, checked: 0, sent: 0, message: 'No active subscriptions.' });

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const NOTIFY_DAYS = [30, 14, 7, 3, 1];
    const results: Array<{ id: string; name: string; days: number; action: string; sent: boolean }> = [];

    for (const sub of subscriptions) {
      const periodEnd = new Date(sub.current_period_end); periodEnd.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (!NOTIFY_DAYS.includes(daysUntil)) continue;

      // Deduplicate: skip if already sent today
      const lastSent = sub.renewal_email_sent_at ? new Date(sub.renewal_email_sent_at) : null;
      if (lastSent) {
        const lastDay = new Date(lastSent); lastDay.setHours(0, 0, 0, 0);
        if (lastDay.getTime() === now.getTime()) {
          results.push({ id: sub.id, name: sub.customer_name, days: daysUntil, action: 'skipped_already_sent', sent: false });
          continue;
        }
      }

      if (dryRun) {
        results.push({ id: sub.id, name: sub.customer_name, days: daysUntil, action: `dry_run_${daysUntil}d`, sent: false });
        continue;
      }

      const renewalLink = `${SITE_URL}/retainer-renewal/${sub.id}`;
      const expiryDate = new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const amountFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(sub.amount || 0);
      const firstName = sub.customer_name.split(' ')[0];
      const urgencyColor = daysUntil <= 7 ? '#dc2626' : daysUntil <= 14 ? '#ea580c' : '#6366f1';

      let emailSent = false;

      // Send email
      try {
        const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8f7f4;font-family:Georgia,serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e0d8;">
  <div style="background:${urgencyColor};padding:24px 32px;">
    <p style="color:white;font-size:11px;font-weight:700;letter-spacing:2px;margin:0 0 4px 0;text-transform:uppercase;">Broussard Legal Services</p>
    <h1 style="color:white;font-size:22px;margin:0;font-weight:400;">Retainer Renewal — ${daysUntil} Day${daysUntil !== 1 ? 's' : ''} Notice</h1>
  </div>
  <div style="padding:32px;">
    <p style="color:#374151;font-size:15px;margin:0 0 16px 0;">Dear ${firstName},</p>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px 0;">Your <strong style="color:#374151;">${sub.plan_name}</strong> retainer (${amountFmt}/${sub.billing_interval}) expires on <strong style="color:${urgencyColor};">${expiryDate}</strong>. Please confirm your renewal preference.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${renewalLink}" style="display:inline-block;background:${urgencyColor};color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Confirm Renewal →</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;">You can also enable auto-rebill on the renewal page to avoid future manual confirmations.</p>
  </div>
  <div style="background:#f8f7f4;padding:16px 32px;border-top:1px solid #e5e0d8;">
    <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center;">Broussard Legal Services · broussardlegalservices.com</p>
  </div>
</div></body></html>`;

        const { error: emailErr } = await resend.emails.send({
          from: 'Broussard Legal Services <noreply@broussardlegalservices.com>',
          to: sub.customer_email,
          subject: `[${daysUntil === 30 ? '30-Day Notice' : 'Reminder'}] Your ${sub.plan_name} Retainer Renews ${daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} Days`}`,
          html,
        });
        if (!emailErr) emailSent = true;

        await supabase.from('retainer_renewal_logs').insert({
          subscription_id: sub.id,
          customer_name: sub.customer_name,
          customer_email: sub.customer_email,
          notification_type: 'auto_renewal_reminder',
          channel: 'email',
          sent_at: new Date().toISOString(),
          status: emailErr ? 'failed' : 'sent',
          days_before_expiry: daysUntil,
        });
      } catch { /* continue */ }

      // Send SMS for urgent reminders (7 days or less)
      if (daysUntil <= 7) {
        try {
          const smsBody = `Broussard Legal Services\n\nUrgent: Hi ${firstName}, your ${sub.plan_name} retainer expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} (${expiryDate}). Confirm renewal: ${renewalLink}\n\nReply STOP to opt out.`;
          // Note: phone not stored in retainer_subscriptions by default; SMS sent if available
          await supabase.from('retainer_renewal_logs').insert({
            subscription_id: sub.id,
            customer_name: sub.customer_name,
            customer_email: sub.customer_email,
            notification_type: 'auto_renewal_reminder',
            channel: 'sms',
            sent_at: new Date().toISOString(),
            status: 'queued',
            days_before_expiry: daysUntil,
          });
          void smsBody; // SMS queued — phone lookup handled by send-renewal-notification endpoint
        } catch { /* continue */ }
      }

      if (emailSent) {
        await supabase.from('retainer_subscriptions').update({
          renewal_email_sent_at: new Date().toISOString(),
          renewal_email_status: `auto_${daysUntil}d_sent`,
        }).eq('id', sub.id);
      }

      results.push({ id: sub.id, name: sub.customer_name, days: daysUntil, action: `${daysUntil}d_reminder`, sent: emailSent });
    }

    const sent = results.filter(r => r.sent).length;
    return NextResponse.json({
      success: true,
      dryRun,
      checked: subscriptions.length,
      processed: results.length,
      sent,
      results,
      message: dryRun ? `Dry run: ${results.length} would be sent` : `30-day check complete: ${sent} notification(s) sent`,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date(); now.setHours(0, 0, 0, 0);

    const { data: subs } = await supabase
      .from('retainer_subscriptions')
      .select('id, customer_name, plan_name, current_period_end, renewal_email_sent_at, status')
      .eq('status', 'active')
      .not('current_period_end', 'is', null)
      .order('current_period_end', { ascending: true });

    const upcoming = (subs || []).map(s => {
      const d = new Date(s.current_period_end); d.setHours(0, 0, 0, 0);
      const days = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { id: s.id, name: s.customer_name, plan: s.plan_name, days, expiry: s.current_period_end, lastNotified: s.renewal_email_sent_at };
    });

    return NextResponse.json({
      total: upcoming.length,
      expiring30: upcoming.filter(s => s.days <= 30 && s.days >= 0).length,
      expiring7: upcoming.filter(s => s.days <= 7 && s.days >= 0).length,
      upcoming: upcoming.slice(0, 20),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
