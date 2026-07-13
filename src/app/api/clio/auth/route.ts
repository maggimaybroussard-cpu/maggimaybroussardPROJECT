import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.CLIO_CLIENT_ID;
  if (!clientId) {
    return NextResponse?.json({ error: 'CLIO_CLIENT_ID not configured' }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/clio/callback`;
  const state = Math.random()?.toString(36)?.substring(2, 18);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    redirect_on_decline: 'true',
  });

  const authUrl = `https://app.clio.com/oauth/authorize?${params?.toString()}`;
  return NextResponse?.redirect(authUrl);
}
