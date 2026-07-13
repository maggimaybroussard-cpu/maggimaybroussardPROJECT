import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/admin?tab=integrations&clio_error=${error || 'no_code'}`
    );
  }

  const clientId = process.env.CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/clio/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/admin?tab=integrations&clio_error=missing_credentials`
    );
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://app.clio.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Clio token exchange failed:', errText);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/admin?tab=integrations&clio_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, token_type, expires_in } = tokenData;

    // Fetch Clio user info
    let clioUserId: number | null = null;
    let clioUserName: string | null = null;
    let clioAccountId: number | null = null;

    try {
      const whoAmI = await fetch(
        'https://app.clio.com/api/v4/users/who_am_i?fields=id,name,account{id}',
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      if (whoAmI.ok) {
        const userData = await whoAmI.json();
        clioUserId = userData.data?.id ?? null;
        clioUserName = userData.data?.name ?? null;
        clioAccountId = userData.data?.account?.id ?? null;
      }
    } catch (_) {
      // non-fatal
    }

    const expiresAt = new Date(Date.now() + (expires_in ?? 2592000) * 1000).toISOString();

    const supabase = await createClient();

    // Upsert token (only one token row — delete old and insert new)
    await supabase.from('clio_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('clio_tokens').insert({
      access_token,
      refresh_token,
      token_type: token_type ?? 'bearer',
      expires_at: expiresAt,
      clio_user_id: clioUserId,
      clio_user_name: clioUserName,
      clio_account_id: clioAccountId,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/admin?tab=integrations&clio_connected=true`
    );
  } catch (err) {
    console.error('Clio callback error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/admin?tab=integrations&clio_error=server_error`
    );
  }
}
