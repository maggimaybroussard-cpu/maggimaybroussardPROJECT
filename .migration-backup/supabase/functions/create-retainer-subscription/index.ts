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

interface CreateSubscriptionBody {
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    firmName?: string;
    stripeCustomerId?: string | null;
    billing: {
      address_line_1: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  planName?: string;
  amount: number; // in dollars
  interval?: 'month' | 'year';
  inquiryId?: string | null;
  userId?: string | null;
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

    const body = (await req.json()) as CreateSubscriptionBody;
    const { customerInfo, planName = 'Monthly Retainer', amount, interval = 'month', inquiryId, userId } = body;

    if (!customerInfo?.email || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: customerInfo.email, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fullName = `${customerInfo.firstName} ${customerInfo.lastName}`.trim();
    const amountInCents = Math.round(amount * 100);

    // 1. Create or retrieve Stripe customer
    let stripeCustomerId = customerInfo.stripeCustomerId ?? null;
    if (stripeCustomerId) {
      await stripe.customers.update(stripeCustomerId, {
        name: fullName,
        email: customerInfo.email,
        address: {
          line1: customerInfo.billing.address_line_1,
          city: customerInfo.billing.city,
          state: customerInfo.billing.state,
          postal_code: customerInfo.billing.postal_code,
          country: customerInfo.billing.country,
        },
      });
    } else {
      // Check if customer exists by email
      const existing = await stripe.customers.list({ email: customerInfo.email, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          name: fullName,
          email: customerInfo.email,
          address: {
            line1: customerInfo.billing.address_line_1,
            city: customerInfo.billing.city,
            state: customerInfo.billing.state,
            postal_code: customerInfo.billing.postal_code,
            country: customerInfo.billing.country,
          },
          metadata: { firm: customerInfo.firmName ?? '' },
        });
        stripeCustomerId = customer.id;
      }
    }

    // 2. Create a price for this subscription
    const price = await stripe.prices.create({
      unit_amount: amountInCents,
      currency: 'usd',
      recurring: { interval },
      product_data: {
        name: planName,
        metadata: { type: 'retainer' },
      },
    });

    // 3. Create a SetupIntent to collect payment method before creating subscription
    // We return a SetupIntent client_secret so the frontend can collect card details
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: {
        plan_name: planName,
        amount: String(amount),
        interval,
        price_id: price.id,
        inquiry_id: inquiryId ?? '',
        user_id: userId ?? '',
        customer_name: fullName,
        customer_email: customerInfo.email,
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        stripeCustomerId,
        priceId: price.id,
        planName,
        amount,
        interval,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Subscription setup failed';
    console.error('create-retainer-subscription error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
