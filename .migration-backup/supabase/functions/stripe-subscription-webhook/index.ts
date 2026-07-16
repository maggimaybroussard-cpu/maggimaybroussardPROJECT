import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// ── Retainer tier metadata ────────────────────────────────────────────────────
function getRetainerTierDetails(planName: string, amount: number): {
  hours: number;
  tierLabel: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
} {
  let hours = 10;
  let tierLabel = planName || 'Monthly Retainer';

  const nameLower = (planName || '').toLowerCase();
  if (nameLower.includes('essential') || amount <= 750) {
    hours = 5;
    tierLabel = 'Essential Retainer';
  } else if (nameLower.includes('standard') || (amount > 750 && amount <= 1500)) {
    hours = 10;
    tierLabel = 'Standard Retainer';
  } else if (nameLower.includes('premium') || (amount > 1500 && amount <= 2500)) {
    hours = 20;
    tierLabel = 'Premium Retainer';
  } else if (nameLower.includes('enterprise') || amount > 2500) {
    hours = 40;
    tierLabel = 'Enterprise Retainer';
  }

  const hourlyRate = amount / hours;

  const lineItems = [
    {
      description: `${tierLabel} – Monthly Retainer Fee`,
      quantity: 1,
      unitPrice: amount,
      total: amount,
    },
    {
      description: `Included Hours: ${hours} hrs/month @ $${hourlyRate.toFixed(2)}/hr`,
      quantity: hours,
      unitPrice: hourlyRate,
      total: amount,
    },
    {
      description: 'Services: Legal Research, Document Drafting, Case Management, Client Correspondence',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    },
  ];

  return { hours, tierLabel, lineItems };
}

// ── Build metadata payload from a Stripe Subscription ────────────────────────
function buildMetadata(sub: Stripe.Subscription, extra?: Record<string, unknown>): Record<string, unknown> {
  const item = sub.items?.data?.[0];
  return {
    stripe_status: sub.status,
    stripe_price_id: item?.price?.id ?? null,
    stripe_product_id: item?.price?.product ?? null,
    billing_interval: item?.price?.recurring?.interval ?? null,
    billing_interval_count: item?.price?.recurring?.interval_count ?? null,
    trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    collection_method: sub.collection_method ?? null,
    default_payment_method: sub.default_payment_method ?? null,
    stripe_metadata: sub.metadata ?? {},
    synced_at: new Date().toISOString(),
    ...extra,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') ?? '';

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log(`Processing Stripe event: ${event.type} [${event.id}]`);

    switch (event.type) {

      // ── Subscription created ────────────────────────────────────────────────
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];

        const { error } = await supabase
          .from('retainer_subscriptions')
          .update({
            status: sub.status,
            stripe_price_id: item?.price?.id ?? null,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            metadata: buildMetadata(sub, { event_type: 'subscription.created' }),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('subscription.created update error:', error.message);
        break;
      }

      // ── Subscription updated (plan change, pause, cancel-at-period-end) ────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];

        const { error } = await supabase
          .from('retainer_subscriptions')
          .update({
            status: sub.status,
            stripe_price_id: item?.price?.id ?? null,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
            metadata: buildMetadata(sub, { event_type: 'subscription.updated' }),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('subscription.updated update error:', error.message);
        break;
      }

      // ── Subscription deleted / cancelled ───────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        const { error } = await supabase
          .from('retainer_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: sub.canceled_at
              ? new Date(sub.canceled_at * 1000).toISOString()
              : new Date().toISOString(),
            cancel_at_period_end: false,
            metadata: buildMetadata(sub, {
              event_type: 'subscription.deleted',
              cancellation_reason: (sub as unknown as Record<string, unknown>).cancellation_details ?? null,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('subscription.deleted update error:', error.message);

        // Send cancellation email
        const { data: subRecord } = await supabase
          .from('retainer_subscriptions')
          .select('customer_name, customer_email, plan_name, current_period_end')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (subRecord) {
          await fetch(`${supabaseUrl}/functions/v1/send-retainer-renewal-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              emailType: 'cancellation',
              customerName: subRecord.customer_name,
              customerEmail: subRecord.customer_email,
              planName: subRecord.plan_name,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: subRecord.current_period_end,
            }),
          });
        }
        break;
      }

      // ── Trial ending soon ───────────────────────────────────────────────────
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;

        const { error } = await supabase
          .from('retainer_subscriptions')
          .update({
            metadata: buildMetadata(sub, {
              event_type: 'trial_will_end',
              trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        if (error) console.error('trial_will_end update error:', error.message);
        break;
      }

      // ── Payment succeeded (renewal or first payment) ────────────────────────
      case 'invoice.payment_succeeded': {
        const stripeInvoice = event.data.object as Stripe.Invoice;
        if (!stripeInvoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(stripeInvoice.subscription as string);

        // Update subscription period + clear any past_due / payment failure metadata
        const { error: subUpdateError } = await supabase
          .from('retainer_subscriptions')
          .update({
            status: 'active',
            stripe_price_id: sub.items?.data?.[0]?.price?.id ?? null,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            renewal_email_sent_at: null,
            renewal_email_status: 'pending',
            metadata: buildMetadata(sub, {
              event_type: 'payment_succeeded',
              billing_reason: stripeInvoice.billing_reason,
              stripe_invoice_id: stripeInvoice.id,
              amount_paid: (stripeInvoice.amount_paid ?? 0) / 100,
              last_payment_error: null,
              last_payment_at: new Date().toISOString(),
            }),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);

        if (subUpdateError) console.error('payment_succeeded sub update error:', subUpdateError.message);

        // Fetch our subscription record for client details
        const { data: subRecord } = await supabase
          .from('retainer_subscriptions')
          .select('id, customer_name, customer_email, plan_name, amount, billing_interval, current_period_end, inquiry_id, user_id')
          .eq('stripe_subscription_id', sub.id)
          .single();

        if (subRecord) {
          const amountPaid = (stripeInvoice.amount_paid ?? 0) / 100;
          const resolvedAmount = amountPaid > 0 ? amountPaid : Number(subRecord.amount);
          const { hours, tierLabel, lineItems } = getRetainerTierDetails(subRecord.plan_name, resolvedAmount);

          const periodStart = new Date(sub.current_period_start * 1000);
          const periodEnd = new Date(sub.current_period_end * 1000);
          const periodLabel = `${periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

          const itemizedLineItems = [
            {
              description: `${tierLabel} – ${periodLabel}`,
              quantity: 1,
              unitPrice: resolvedAmount,
              total: resolvedAmount,
            },
            {
              description: `Retainer Hours: ${hours} hrs/month included`,
              quantity: hours,
              unitPrice: resolvedAmount / hours,
              total: resolvedAmount,
            },
            {
              description: 'Scope: Legal Research, Document Drafting, Case Management, Client Correspondence',
              quantity: 1,
              unitPrice: 0,
              total: 0,
            },
          ];

          const invoiceNumber = `RET-${sub.id.slice(-8).toUpperCase()}-${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
          const invoiceDate = new Date().toISOString().split('T')[0];

          // 1. Create / upsert client_invoices record
          const { error: invoiceInsertError } = await supabase
            .from('client_invoices')
            .upsert(
              {
                user_id: subRecord.user_id ?? null,
                inquiry_id: subRecord.inquiry_id ?? null,
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate,
                due_date: invoiceDate,
                amount: resolvedAmount,
                amount_paid: resolvedAmount,
                currency: 'usd',
                status: 'paid',
                line_items: itemizedLineItems,
                notes: `Retainer payment for ${tierLabel}. Billing period: ${periodLabel}. Stripe Invoice ID: ${stripeInvoice.id}. Subscription: ${sub.id}.`,
                stripe_invoice_id: stripeInvoice.id,
                retainer_subscription_id: subRecord.id,
              },
              { onConflict: 'invoice_number' }
            );

          if (invoiceInsertError) {
            console.error('Failed to insert client_invoice record:', invoiceInsertError.message);
          }

          // 2. Send PDF invoice email via generate-invoice
          try {
            await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                clientEmail: subRecord.customer_email,
                clientName: subRecord.customer_name,
                paymentIntentId: stripeInvoice.payment_intent ?? stripeInvoice.id,
                paymentType: 'retainer_agreement',
                amount: resolvedAmount,
                currency: 'usd',
                description: `${tierLabel} – ${periodLabel} (${hours} hrs/month)`,
                items: itemizedLineItems,
                invoiceNumber,
                createdAt: new Date().toISOString(),
              }),
            });
          } catch (invoiceEmailErr) {
            console.error('generate-invoice email error (non-fatal):', invoiceEmailErr);
          }

          // 3. Send renewal success email (only for renewals, not first payment)
          if (stripeInvoice.billing_reason === 'subscription_cycle') {
            await fetch(`${supabaseUrl}/functions/v1/send-retainer-renewal-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
              body: JSON.stringify({
                emailType: 'renewal_success',
                customerName: subRecord.customer_name,
                customerEmail: subRecord.customer_email,
                planName: subRecord.plan_name,
                amount: resolvedAmount,
                interval: subRecord.billing_interval,
                nextPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                subscriptionId: sub.id,
              }),
            });
          }
        }
        break;
      }

      // ── Payment failed ──────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        // Retrieve the latest error details from the invoice charge attempt
        const lastError = (invoice as unknown as Record<string, unknown>).last_finalization_error ?? null;
        const attemptCount = invoice.attempt_count ?? 0;
        const nextAttempt = (invoice as unknown as Record<string, unknown>).next_payment_attempt;

        // Fetch current metadata to merge (preserve existing fields)
        const { data: existing } = await supabase
          .from('retainer_subscriptions')
          .select('metadata')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        const mergedMetadata = {
          ...(existing?.metadata ?? {}),
          event_type: 'payment_failed',
          last_payment_error: lastError,
          payment_attempt_count: attemptCount,
          next_payment_attempt: nextAttempt
            ? new Date((nextAttempt as number) * 1000).toISOString()
            : null,
          stripe_invoice_id: invoice.id,
          failed_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('retainer_subscriptions')
          .update({
            status: 'past_due',
            metadata: mergedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', invoice.subscription as string);

        if (error) console.error('payment_failed update error:', error.message);
        break;
      }

      // ── Invoice upcoming (renewal warning) ─────────────────────────────────
      case 'invoice.upcoming': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        // Fetch current metadata to merge
        const { data: existing } = await supabase
          .from('retainer_subscriptions')
          .select('metadata')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .single();

        const mergedMetadata = {
          ...(existing?.metadata ?? {}),
          event_type: 'invoice_upcoming',
          upcoming_invoice_amount: (invoice.amount_due ?? 0) / 100,
          upcoming_invoice_date: invoice.due_date
            ? new Date(invoice.due_date * 1000).toISOString()
            : null,
          synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('retainer_subscriptions')
          .update({
            metadata: mergedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', invoice.subscription as string);

        if (error) console.error('invoice.upcoming update error:', error.message);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true, event: event.type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Webhook processing failed';
    console.error('stripe-subscription-webhook error:', e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
