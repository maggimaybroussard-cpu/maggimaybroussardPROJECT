import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token || typeof token !== 'string' || token.length < 32) {
    return NextResponse.redirect(`${SITE_URL}/confirm-email?status=invalid`);
  }

  // Use service role key so we can update the row (anon key has limited UPDATE access)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallback to anon key if service key not available (RLS policy allows token-based update)
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey && supabaseServiceKey !== 'your-supabase-service-role-key-here'
      ? supabaseServiceKey
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Look up subscriber by token
  const { data: subscriber, error: lookupError } = await supabase
    .from('email_subscribers')
    .select('id, email, confirmed, nurture_enrolled_at')
    .eq('confirmation_token', token)
    .single();

  if (lookupError || !subscriber) {
    return NextResponse.redirect(`${SITE_URL}/confirm-email?status=invalid`);
  }

  // Already confirmed — redirect to success without re-processing
  if (subscriber.confirmed) {
    return NextResponse.redirect(`${SITE_URL}/confirm-email?status=already_confirmed`);
  }

  // Mark as confirmed and clear the token
  const { error: updateError } = await supabase
    .from('email_subscribers')
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      confirmation_token: null,
    })
    .eq('id', subscriber.id);

  if (updateError) {
    console.error('Confirmation update error:', updateError);
    return NextResponse.redirect(`${SITE_URL}/confirm-email?status=error`);
  }

  // Enroll in nurture sequence now that subscriber is confirmed
  if (!subscriber.nurture_enrolled_at) {
    try {
      if (
        supabaseServiceKey &&
        supabaseServiceKey !== 'your-supabase-service-role-key-here'
      ) {
        await fetch(`${supabaseUrl}/functions/v1/schedule-subscriber-nurture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            subscriberId: subscriber.id,
            subscriberEmail: subscriber.email,
          }),
        });
      }
    } catch (nurtureErr) {
      // Non-blocking — confirmation is still valid even if nurture scheduling fails
      console.error('Nurture scheduling after confirmation failed:', nurtureErr);
    }
  }

  return NextResponse.redirect(`${SITE_URL}/confirm-email?status=confirmed`);
}
