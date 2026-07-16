import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('your-')) return null;
  return new Stripe(key, { apiVersion: '2024-06-20' as Parameters<typeof Stripe>[1]['apiVersion'] });
}

// GET — list saved payment methods for the authenticated client
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ methods: [] });
    }

    // Look up stripe_customer_id from user_profiles or client_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | undefined;

    // Fallback: check client_profiles
    if (!customerId) {
      const { data: clientProfile } = await supabase
        .from('client_profiles')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();
      customerId = clientProfile?.stripe_customer_id as string | undefined;
    }

    if (!customerId) {
      return NextResponse.json({ methods: [] });
    }

    const pmList = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    // Get default payment method
    const customer = await stripe.customers.retrieve(customerId);
    const defaultPmId =
      !customer.deleted && typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : null;

    const methods = pmList.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'card',
      last4: pm.card?.last4 || '****',
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
      is_default: pm.id === defaultPmId,
    }));

    return NextResponse.json({ methods });
  } catch (err: unknown) {
    console.error('[portal/payment-methods GET]', err);
    return NextResponse.json({ methods: [] });
  }
}

// DELETE — detach a payment method
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { paymentMethodId } = body as { paymentMethodId: string };
    if (!paymentMethodId) {
      return NextResponse.json({ error: 'paymentMethodId is required' }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    // Verify the PM belongs to this customer before detaching
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const { data: clientProfile } = await supabase
        .from('client_profiles')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle();
      customerId = clientProfile?.stripe_customer_id as string | undefined;
    }

    if (pm.customer !== customerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[portal/payment-methods DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove payment method' }, { status: 500 });
  }
}
