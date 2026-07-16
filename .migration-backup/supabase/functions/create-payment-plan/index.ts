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

interface CreatePaymentPlanRequest {
  customerInfo: {
    userId: string | null;
    firstName: string;
    lastName: string;
    email: string;
    stripeCustomerId?: string | null;
  };
  planConfig: {
    totalAmount: number;
    currency: string;
    installmentCount: number;
    frequency: 'monthly' | 'biweekly' | 'weekly';
    description: string;
    invoiceId?: string | null;
    inquiryId?: string | null;
  };
}

function getNextDueDate(frequency: string, fromDate: Date = new Date()): Date {
  const d = new Date(fromDate);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 14);
  else d.setDate(d.getDate() + 7);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { customerInfo, planConfig } = (await req.json()) as CreatePaymentPlanRequest;

    if (!customerInfo?.email || !planConfig?.totalAmount || !planConfig?.installmentCount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const installmentAmount = Math.round((planConfig.totalAmount / planConfig.installmentCount) * 100) / 100;

    // Create or retrieve Stripe customer
    let stripeCustomerId = customerInfo.stripeCustomerId ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
        email: customerInfo.email,
      });
      stripeCustomerId = customer.id;
    }

    // Create SetupIntent for ACH/card on file
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['us_bank_account', 'card'],
      usage: 'off_session',
      metadata: {
        plan_type: 'payment_plan',
        customer_email: customerInfo.email,
        total_amount: planConfig.totalAmount.toString(),
        installment_count: planConfig.installmentCount.toString(),
      },
    });

    // Build installment schedule
    const installments: Array<{ installment_number: number; amount: number; due_date: string }> = [];
    let dueDate = new Date();
    for (let i = 1; i <= planConfig.installmentCount; i++) {
      dueDate = i === 1 ? new Date() : getNextDueDate(planConfig.frequency, dueDate);
      installments.push({
        installment_number: i,
        amount: i === planConfig.installmentCount
          ? Math.round((planConfig.totalAmount - installmentAmount * (planConfig.installmentCount - 1)) * 100) / 100
          : installmentAmount,
        due_date: toDateStr(dueDate),
      });
    }

    // Save plan to DB
    const { data: plan, error: planErr } = await supabase
      .from('payment_plans')
      .insert({
        user_id: customerInfo.userId,
        invoice_id: planConfig.invoiceId ?? null,
        inquiry_id: planConfig.inquiryId ?? null,
        customer_name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
        customer_email: customerInfo.email,
        stripe_customer_id: stripeCustomerId,
        total_amount: planConfig.totalAmount,
        currency: (planConfig.currency || 'usd').toLowerCase(),
        installment_count: planConfig.installmentCount,
        installment_amount: installmentAmount,
        frequency: planConfig.frequency,
        description: planConfig.description,
        status: 'active',
        next_due_date: installments[0]?.due_date ?? null,
      })
      .select()
      .single();

    if (planErr) throw new Error(planErr.message);

    // Save installments
    const installmentRows = installments.map((inst) => ({
      plan_id: plan.id,
      installment_number: inst.installment_number,
      amount: inst.amount,
      currency: (planConfig.currency || 'usd').toLowerCase(),
      due_date: inst.due_date,
      payment_status: 'pending',
    }));

    const { error: instErr } = await supabase
      .from('payment_plan_installments')
      .insert(installmentRows);

    if (instErr) throw new Error(instErr.message);

    // Link invoice if provided
    if (planConfig.invoiceId) {
      await supabase
        .from('client_invoices')
        .update({ payment_plan_id: plan.id, payment_plan_enabled: true })
        .eq('id', planConfig.invoiceId);
    }

    return new Response(
      JSON.stringify({
        planId: plan.id,
        setupIntentClientSecret: setupIntent.client_secret,
        stripeCustomerId,
        installments,
        installmentAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Payment plan creation failed';
    console.error('create-payment-plan error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
