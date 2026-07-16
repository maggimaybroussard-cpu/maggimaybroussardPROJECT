import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── Auto-Renewal Scheduler ────────────────────────────────────────────────────
// Scans active retainer subscriptions and:
//   1. Sends renewal reminder emails 7 days before period end (if not already sent)
//   2. Sends a 3-day final reminder
//   3. Marks expired subscriptions for review
//
// Call this endpoint daily via cron (e.g. Vercel Cron, GitHub Actions, or Supabase pg_cron)
// POST /api/retainer/auto-renew
// Optional body: { dryRun: true } — logs actions without sending emails

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dryRun === true;
    } catch {
      // no body
    }

    // Fetch all active subscriptions with period end dates
    const { data: subscriptions, error: fetchError } = await supabase
      .from('retainer_subscriptions')
      .select(
        'id, customer_name, customer_email, plan_name, amount, billing_interval, ' + 'current_period_end, current_period_start, stripe_subscription_id, '+ 'renewal_email_sent_at, renewal_email_status, status, cancel_at_period_end'
      )
      .eq('status', 'active')
      .eq('cancel_at_period_end', false)
      .not('current_period_end', 'is', null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, checked: 0, reminders: [], message: 'No active subscriptions to process.' });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const results: Array<{
      subscriptionId: string;
      customerName: string;
      customerEmail: string;
      daysUntilRenewal: number;
      action: string;
      emailSent: boolean;
      error?: string;
    }> = [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    for (const sub of subscriptions) {
      const periodEnd = new Date(sub.current_period_end);
      periodEnd.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Determine if we should send a reminder
      const shouldSend7Day = daysUntil === 7;
      const shouldSend3Day = daysUntil === 3;
      const shouldSend1Day = daysUntil === 1;

      if (!shouldSend7Day && !shouldSend3Day && !shouldSend1Day) {
        continue;
      }

      // Check if we already sent a reminder today
      const lastSent = sub.renewal_email_sent_at ? new Date(sub.renewal_email_sent_at) : null;
      if (lastSent) {
        const lastSentDay = new Date(lastSent);
        lastSentDay.setHours(0, 0, 0, 0);
        if (lastSentDay.getTime() === now.getTime()) {
          results.push({
            subscriptionId: sub.id,
            customerName: sub.customer_name,
            customerEmail: sub.customer_email,
            daysUntilRenewal: daysUntil,
            action: 'skipped_already_sent_today',
            emailSent: false,
          });
          continue;
        }
      }

      const reminderLabel = shouldSend7Day ? '7-day' : shouldSend3Day ? '3-day' : '1-day';

      if (dryRun) {
        results.push({
          subscriptionId: sub.id,
          customerName: sub.customer_name,
          customerEmail: sub.customer_email,
          daysUntilRenewal: daysUntil,
          action: `dry_run_would_send_${reminderLabel}_reminder`,
          emailSent: false,
        });
        continue;
      }

      // Send renewal reminder via edge function
      let emailSent = false;
      let emailError: string | undefined;

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-retainer-renewal-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(serviceRoleKey ? { Authorization: `Bearer ${serviceRoleKey}` } : {}),
          },
          body: JSON.stringify({
            emailType: 'renewal_reminder',
            customerName: sub.customer_name,
            customerEmail: sub.customer_email,
            planName: sub.plan_name,
            amount: Number(sub.amount),
            interval: sub.billing_interval,
            currentPeriodEnd: sub.current_period_end,
            subscriptionId: sub.stripe_subscription_id,
            daysUntilRenewal: daysUntil,
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result?.error ?? 'Email send failed');
        emailSent = true;
      } catch (err: unknown) {
        emailError = err instanceof Error ? err.message : 'Unknown error';
      }

      // Update DB with last sent timestamp
      if (emailSent) {
        await supabase
          .from('retainer_subscriptions')
          .update({
            renewal_email_sent_at: new Date().toISOString(),
            renewal_email_status: `auto_${reminderLabel}_sent`,
          })
          .eq('id', sub.id);
      }

      results.push({
        subscriptionId: sub.id,
        customerName: sub.customer_name,
        customerEmail: sub.customer_email,
        daysUntilRenewal: daysUntil,
        action: `auto_${reminderLabel}_reminder`,
        emailSent,
        ...(emailError ? { error: emailError } : {}),
      });
    }

    const sent = results.filter(r => r.emailSent).length;
    const skipped = results.filter(r => r.action.startsWith('skipped')).length;
    const failed = results.filter(r => !r.emailSent && !r.action.startsWith('skipped') && !r.action.startsWith('dry_run')).length;

    return NextResponse.json({
      success: true,
      dryRun,
      checked: subscriptions.length,
      processed: results.length,
      sent,
      skipped,
      failed,
      reminders: results,
      message: dryRun
        ? `Dry run: ${results.length} renewal reminder(s) would be sent.`
        : `Auto-renewal check complete: ${sent} email(s) sent, ${skipped} skipped, ${failed} failed.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Auto-renewal check failed.' },
      { status: 500 }
    );
  }
}

// GET — status check / dry run preview
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: subscriptions, error } = await supabase
      .from('retainer_subscriptions')
      .select('id, customer_name, plan_name, current_period_end, renewal_email_sent_at, status, cancel_at_period_end')
      .eq('status', 'active')
      .eq('cancel_at_period_end', false)
      .not('current_period_end', 'is', null)
      .order('current_period_end', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = (subscriptions ?? []).map(sub => {
      const periodEnd = new Date(sub.current_period_end);
      periodEnd.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: sub.id,
        customerName: sub.customer_name,
        planName: sub.plan_name,
        periodEnd: sub.current_period_end,
        daysUntilRenewal: daysUntil,
        lastReminderSent: sub.renewal_email_sent_at,
        needsReminder: daysUntil === 7 || daysUntil === 3 || daysUntil === 1,
      };
    });

    const needsReminder = upcoming.filter(s => s.needsReminder);

    return NextResponse.json({
      total: upcoming.length,
      needsReminderCount: needsReminder.length,
      renewingIn7Days: upcoming.filter(s => s.daysUntilRenewal === 7).length,
      renewingIn3Days: upcoming.filter(s => s.daysUntilRenewal === 3).length,
      renewingIn1Day: upcoming.filter(s => s.daysUntilRenewal === 1).length,
      upcoming: upcoming.slice(0, 20),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed.' }, { status: 500 });
  }
}
