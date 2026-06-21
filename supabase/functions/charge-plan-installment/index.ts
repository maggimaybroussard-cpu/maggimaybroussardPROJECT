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

interface ChargeInstallmentRequest {
  installmentId: string;
  paymentMethodId: string;
  stripeCustomerId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { installmentId, paymentMethodId, stripeCustomerId } = (await req.json()) as ChargeInstallmentRequest;

    if (!installmentId || !paymentMethodId || !stripeCustomerId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch installment
    const { data: installment, error: instErr } = await supabase
      .from('payment_plan_installments')
      .select('*, payment_plans(*)')
      .eq('id', installmentId)
      .single();

    if (instErr || !installment) throw new Error('Installment not found');
    if (installment.payment_status === 'succeeded') {
      return new Response(
        JSON.stringify({ error: 'Installment already paid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Attach payment method to customer if needed
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
    } catch {
      // Already attached — ignore
    }

    // Create payment intent (off-session)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(installment.amount * 100),
      currency: installment.currency || 'usd',
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      payment_method_types: ['us_bank_account', 'card'],
      confirm: true,
      off_session: true,
      description: `Payment Plan Installment #${installment.installment_number} — ${installment.payment_plans?.description ?? ''}`,
      metadata: {
        plan_id: installment.plan_id,
        installment_id: installmentId,
        installment_number: installment.installment_number.toString(),
      },
    });

    // Update installment
    await supabase
      .from('payment_plan_installments')
      .update({
        payment_intent_id: paymentIntent.id,
        payment_method_id: paymentMethodId,
        payment_status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing',
        paid_at: paymentIntent.status === 'succeeded' ? new Date().toISOString() : null,
      })
      .eq('id', installmentId);

    // Check if all installments are paid
    const { data: remaining } = await supabase
      .from('payment_plan_installments')
      .select('id')
      .eq('plan_id', installment.plan_id)
      .neq('payment_status', 'succeeded');

    if (!remaining || remaining.length === 0) {
      await supabase
        .from('payment_plans')
        .update({ status: 'completed' })
        .eq('id', installment.plan_id);
    } else {
      // Update next_due_date on plan
      const { data: nextInst } = await supabase
        .from('payment_plan_installments')
        .select('due_date')
        .eq('plan_id', installment.plan_id)
        .eq('payment_status', 'pending')
        .order('installment_number', { ascending: true })
        .limit(1)
        .single();
      if (nextInst) {
        await supabase
          .from('payment_plans')
          .update({ next_due_date: nextInst.due_date })
          .eq('id', installment.plan_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, paymentIntentId: paymentIntent.id, status: paymentIntent.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Charge failed';
    console.error('charge-plan-installment error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
