import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface BillingAddress {
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface CustomerInfo {
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  stripeCustomerId: string | null;
  billing: BillingAddress;
}

interface PaymentData {
  amount: number;
  currency: string;
  tableName: string;
  description: string;
  paymentType: string;
  additionalFields?: Record<string, unknown>;
}

interface CreatePaymentIntentRequest {
  paymentData: PaymentData;
  customerInfo: CustomerInfo;
}

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { paymentData, customerInfo } = (await req.json()) as CreatePaymentIntentRequest;

    if (!paymentData?.amount || !customerInfo?.email) {
      return new Response(
        JSON.stringify({ error: 'Missing required payment or customer information' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerData: Stripe.CustomerCreateParams = {
      name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
      email: customerInfo.email,
      address: {
        line1: customerInfo.billing.address_line_1,
        city: customerInfo.billing.city,
        state: customerInfo.billing.state,
        postal_code: customerInfo.billing.postal_code,
        country: customerInfo.billing.country,
      },
    };

    // Create or update Stripe customer
    const stripeCustomer = customerInfo.stripeCustomerId
      ? await stripe.customers.update(customerInfo.stripeCustomerId, customerData)
      : await stripe.customers.create(customerData);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentData.amount * 100),
      currency: (paymentData.currency || 'usd').toLowerCase(),
      customer: stripeCustomer.id,
      description: paymentData.description,
      // Support ACH bank payments alongside card
      payment_method_types: paymentData.paymentType === 'ach'
        ? ['us_bank_account']
        : paymentData.paymentType === 'ach_or_card'
        ? ['us_bank_account', 'card']
        : undefined,
      payment_method_options: paymentData.paymentType === 'ach' || paymentData.paymentType === 'ach_or_card'
        ? {
            us_bank_account: {
              financial_connections: { permissions: ['payment_method'] },
              verification_method: 'automatic',
            },
          }
        : undefined,
      metadata: {
        payment_type: paymentData.paymentType,
        customer_email: customerInfo.email,
        user_id: customerInfo.userId ?? 'guest',
      },
    });

    // Save to database
    const { data, error: dbError } = await supabase
      .from(paymentData.tableName)
      .insert({
        user_id: customerInfo.userId,
        payment_intent_id: paymentIntent.id,
        stripe_customer_id: stripeCustomer.id,
        amount: paymentData.amount,
        currency: (paymentData.currency || 'usd').toLowerCase(),
        payment_status: 'pending',
        payment_type: paymentData.paymentType,
        description: paymentData.description,
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
        customer_email: customerInfo.email,
        ...paymentData.additionalFields,
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError);
      throw new Error(dbError.message);
    }

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, recordId: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Payment setup failed';
    console.error('create-payment-intent error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
