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

interface CancelSubscriptionBody {
  subscriptionId: string;
  cancelImmediately?: boolean;
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

    const { subscriptionId, cancelImmediately = false } = (await req.json()) as CancelSubscriptionBody;

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: 'Missing subscriptionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedSub: Stripe.Subscription;

    if (cancelImmediately) {
      updatedSub = await stripe.subscriptions.cancel(subscriptionId);
    } else {
      updatedSub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    // Update DB record
    const { error: updateError } = await supabase
      .from('retainer_subscriptions')
      .update({
        status: updatedSub.status,
        cancel_at_period_end: updatedSub.cancel_at_period_end,
        canceled_at: cancelImmediately ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);

    if (updateError) {
      console.error('DB update error:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId,
        status: updatedSub.status,
        cancelAtPeriodEnd: updatedSub.cancel_at_period_end,
        message: cancelImmediately
          ? 'Subscription cancelled immediately.' :'Subscription will cancel at end of current billing period.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Cancellation failed';
    console.error('cancel-retainer-subscription error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
