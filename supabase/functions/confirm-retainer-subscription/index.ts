import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmSubscriptionBody {
  setupIntentId: string;
  stripeCustomerId: string;
  priceId: string;
  planName: string;
  amount: number;
  interval: string;
  customerName: string;
  customerEmail: string;
  inquiryId?: string | null;
  userId?: string | null;
}

// ── Retainer tier helper ──────────────────────────────────────────────────────
function getRetainerTierDetails(planName: string, amount: number): { hours: number; tierLabel: string } {
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

  return { hours, tierLabel };
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

    const body = (await req.json()) as ConfirmSubscriptionBody;
    const { setupIntentId, stripeCustomerId, priceId, planName, amount, interval, customerName, customerEmail, inquiryId, userId } = body;

    if (!setupIntentId || !stripeCustomerId || !priceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Retrieve the SetupIntent to get the payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (setupIntent.status !== 'succeeded') {
      return new Response(
        JSON.stringify({ error: `SetupIntent status is ${setupIntent.status}, expected succeeded` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentMethodId = setupIntent.payment_method as string;

    // 2. Attach payment method to customer as default
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 3. Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: {
        plan_name: planName,
        customer_name: customerName,
        customer_email: customerEmail,
        inquiry_id: inquiryId ?? '',
        user_id: userId ?? '',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // 4. Save subscription to database
    const { data: subRecord, error: insertError } = await supabase
      .from('retainer_subscriptions')
      .insert({
        customer_name: customerName,
        customer_email: customerEmail,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        plan_name: planName,
        amount,
        currency: 'usd',
        billing_interval: interval,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        inquiry_id: inquiryId ?? null,
        user_id: userId ?? null,
        metadata: { setup_intent_id: setupIntentId },
      })
      .select()
      .single();

    if (insertError) {
      console.error('DB insert error:', insertError);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 5. Create itemized invoice record in client_invoices + send PDF invoice email
    try {
      const { hours, tierLabel } = getRetainerTierDetails(planName, amount);

      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);
      const periodLabel = `${periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

      const itemizedLineItems = [
        {
          description: `${tierLabel} – ${periodLabel}`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
        {
          description: `Retainer Hours: ${hours} hrs/month included`,
          quantity: hours,
          unitPrice: amount / hours,
          total: amount,
        },
        {
          description: 'Scope: Legal Research, Document Drafting, Case Management, Client Correspondence',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ];

      const invoiceNumber = `RET-${subscription.id.slice(-8).toUpperCase()}-${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`;
      const invoiceDate = new Date().toISOString().split('T')[0];

      // Derive Stripe invoice ID from the expanded latest_invoice
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
      const stripeInvoiceId = latestInvoice?.id ?? null;
      const paymentIntentId = (latestInvoice?.payment_intent as Stripe.PaymentIntent | null)?.id ?? stripeInvoiceId ?? subscription.id;

      // Insert into client_invoices
      const { error: invoiceInsertError } = await supabase
        .from('client_invoices')
        .upsert(
          {
            user_id: userId ?? null,
            inquiry_id: inquiryId ?? null,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: invoiceDate,
            amount,
            amount_paid: amount,
            currency: 'usd',
            status: 'paid',
            line_items: itemizedLineItems,
            notes: `Initial retainer payment for ${tierLabel}. Billing period: ${periodLabel}. Subscription: ${subscription.id}.`,
            stripe_invoice_id: stripeInvoiceId,
            retainer_subscription_id: subRecord?.id ?? null,
          },
          { onConflict: 'invoice_number' }
        );

      if (invoiceInsertError) {
        console.error('Failed to insert client_invoice record:', invoiceInsertError.message);
      }

      // Send PDF invoice email
      await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          clientEmail: customerEmail,
          clientName: customerName,
          paymentIntentId,
          paymentType: 'retainer_agreement',
          amount,
          currency: 'usd',
          description: `${tierLabel} – ${periodLabel} (${hours} hrs/month)`,
          items: itemizedLineItems,
          invoiceNumber,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (invoiceErr) {
      console.error('Invoice creation/email error (non-fatal):', invoiceErr);
    }

    // 6. Send welcome/confirmation email via Resend
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-retainer-renewal-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          emailType: 'subscription_created',
          customerName,
          customerEmail,
          planName,
          amount,
          interval,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          subscriptionId: subscription.id,
        }),
      });
    } catch (emailErr) {
      console.error('Subscription welcome email error:', emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        record: subRecord,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Subscription confirmation failed';
    console.error('confirm-retainer-subscription error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
