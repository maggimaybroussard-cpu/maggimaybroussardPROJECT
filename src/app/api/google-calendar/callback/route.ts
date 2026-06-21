import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/google-calendar/callback
 *
 * Handles the OAuth2 redirect from Google after the admin grants Calendar access.
 * Exchanges the authorization code for access + refresh tokens and stores them
 * in the google_calendar_tokens table (service-role write).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
  const redirectUri = `${siteUrl}/api/google-calendar/callback`;

  if (error || !code) {
    return NextResponse.redirect(
      `${siteUrl}/admin?gcal=error&reason=${encodeURIComponent(error ?? 'no_code')}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${siteUrl}/admin?gcal=error&reason=missing_credentials`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.refresh_token) {
      return NextResponse.redirect(
        `${siteUrl}/admin?gcal=error&reason=no_refresh_token`
      );
    }

    // Get the authorized account email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const accountEmail: string = userInfo.email ?? 'admin';

    // Store in Supabase (upsert by email)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const expiry = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    await supabase.from('google_calendar_tokens').upsert(
      {
        account_email: accountEmail,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expiry: expiry,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_email' }
    );

    return NextResponse.redirect(`${siteUrl}/admin?gcal=connected&email=${encodeURIComponent(accountEmail)}`);
  } catch (err) {
    console.error('Google Calendar OAuth callback error:', err);
    return NextResponse.redirect(`${siteUrl}/admin?gcal=error&reason=server_error`);
  }
}
