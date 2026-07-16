import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Default retainer fee — can be overridden by query param or future DB config
const DEFAULT_RETAINER_AMOUNT = 500; // USD

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Require authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      amount = DEFAULT_RETAINER_AMOUNT,
      planName = 'Initial Retainer Fee',
    } = body as {
      firstName: string;
      lastName: string;
      amount?: number;
      planName?: string;
    };

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    const customerName = `${firstName} ${lastName}`.trim();
    const customerEmail = user.email!;

    // Check if we already have a Stripe customer for this user
    const { data: onboarding } = await supabase
      .from('client_onboarding')
      .select('stripe_customer_id, retainer_payment_intent_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let stripeCustomerId: string = onboarding?.stripe_customer_id ?? '';

    if (!stripeCustomerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        name: customerName,
        email: customerEmail,
        metadata: {
          user_id: user.id,
          source: 'onboarding',
        },
      });
      stripeCustomerId = customer.id;

      // Persist stripe_customer_id on onboarding record
      await supabase
        .from('client_onboarding')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('user_id', user.id);
    }

    // If a payment intent already exists and is still pending, reuse it
    if (onboarding?.retainer_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(
          onboarding.retainer_payment_intent_id
        );
        if (
          existing.status === 'requires_payment_method' ||
          existing.status === 'requires_confirmation' ||
          existing.status === 'requires_action'
        ) {
          return NextResponse.json({
            clientSecret: existing.client_secret,
            paymentIntentId: existing.id,
            amount: existing.amount / 100,
          });
        }
      } catch {
        // Stale intent — create a new one below
      }
    }

    // Create PaymentIntent for the retainer fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: stripeCustomerId,
      description: planName,
      setup_future_usage: 'off_session', // save card for recurring billing
      metadata: {
        payment_type: 'onboarding_retainer',
        user_id: user.id,
        customer_email: customerEmail,
        plan_name: planName,
      },
    });

    // Save pending payment record
    await supabase.from('payments').upsert(
      {
        user_id: user.id,
        payment_intent_id: paymentIntent.id,
        stripe_customer_id: stripeCustomerId,
        amount,
        currency: 'usd',
        payment_status: 'pending',
        payment_type: 'onboarding_retainer',
        description: planName,
        customer_name: customerName,
        customer_email: customerEmail,
      },
      { onConflict: 'payment_intent_id' }
    );

    // Store payment intent id on onboarding record for resumability
    await supabase
      .from('client_onboarding')
      .update({
        stripe_customer_id: stripeCustomerId,
        retainer_payment_intent_id: paymentIntent.id,
      })
      .eq('user_id', user.id);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment setup failed';
    console.error('[onboarding/retainer-payment] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
