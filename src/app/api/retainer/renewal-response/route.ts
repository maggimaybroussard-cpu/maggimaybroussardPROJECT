import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-05-28.basil' })
  : null;

// POST /api/retainer/renewal-response
// Body: { subscriptionId, response: 'accept' | 'decline', autoRebill: boolean }

export async function POST(req: Request) {
  try {
    const { subscriptionId, response, autoRebill } = await req.json();

    if (!subscriptionId || !response) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch subscription
    const { data: sub, error: fetchErr } = await supabase
      .from('retainer_subscriptions')
      .select('id, customer_name, customer_email, stripe_subscription_id, stripe_customer_id, plan_name, amount, billing_interval, current_period_end')
      .eq('id', subscriptionId)
      .single();

    if (fetchErr || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (response === 'accept') {
      // Update DB — mark accepted
      await supabase.from('retainer_subscriptions').update({
        renewal_accepted_at: now,
        renewal_declined_at: null,
        auto_renew_enabled: autoRebill,
        renewal_email_status: 'client_accepted',
      }).eq('id', subscriptionId);

      // If auto-rebill enabled and Stripe subscription exists, ensure cancel_at_period_end = false
      if (autoRebill && stripe && sub.stripe_subscription_id) {
        try {
          await stripe.subscriptions.update(sub.stripe_subscription_id, {
            cancel_at_period_end: false,
          });
        } catch {
          // Non-fatal — Stripe update failed but DB is updated
        }
      }

      // Log renewal acceptance
      await supabase.from('retainer_renewal_logs').insert({
        subscription_id: subscriptionId,
        customer_name: sub.customer_name,
        customer_email: sub.customer_email,
        notification_type: 'client_renewal_accepted',
        channel: 'portal',
        sent_at: now,
        status: 'accepted',
        days_before_expiry: sub.current_period_end
          ? Math.round((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0,
      });

      return NextResponse.json({
        success: true,
        action: 'accepted',
        autoRebill,
        message: `Renewal confirmed for ${sub.customer_name}`,
      });
    }

    if (response === 'decline') {
      // Update DB — mark declined
      await supabase.from('retainer_subscriptions').update({
        renewal_declined_at: now,
        renewal_accepted_at: null,
        auto_renew_enabled: false,
        renewal_email_status: 'client_declined',
        cancel_at_period_end: true,
      }).eq('id', subscriptionId);

      // Cancel Stripe subscription at period end
      if (stripe && sub.stripe_subscription_id) {
        try {
          await stripe.subscriptions.update(sub.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
        } catch {
          // Non-fatal
        }
      }

      await supabase.from('retainer_renewal_logs').insert({
        subscription_id: subscriptionId,
        customer_name: sub.customer_name,
        customer_email: sub.customer_email,
        notification_type: 'client_renewal_declined',
        channel: 'portal',
        sent_at: now,
        status: 'declined',
        days_before_expiry: sub.current_period_end
          ? Math.round((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0,
      });

      return NextResponse.json({
        success: true,
        action: 'declined',
        message: `Renewal declined for ${sub.customer_name}. Subscription will cancel at period end.`,
      });
    }

    return NextResponse.json({ error: 'Invalid response value. Use "accept" or "decline".' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
