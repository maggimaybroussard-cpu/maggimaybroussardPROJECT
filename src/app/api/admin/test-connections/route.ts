import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const results: {
    supabase: { ok: boolean; message: string; detail?: string };
    resend: { ok: boolean; message: string; detail?: string };
    stripe: { ok: boolean; message: string; detail?: string };
    twilio: { ok: boolean; message: string; detail?: string };
    google: { ok: boolean; message: string; detail?: string };
  } = {
    supabase: { ok: false, message: '' },
    resend: { ok: false, message: '' },
    stripe: { ok: false, message: '' },
    twilio: { ok: false, message: '' },
    google: { ok: false, message: '' },
  };

  // ── Test Supabase ──────────────────────────────────────────────────────────
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || url.includes('your-') || !key || key.includes('your-')) {
      results.supabase = {
        ok: false,
        message: 'Supabase credentials are missing or still set to placeholder values.',
      };
    } else {
      const supabase = await createClient();
      const { error } = await supabase
        .from('contact_inquiries')
        .select('id')
        .limit(1);

      if (error) {
        results.supabase = {
          ok: false,
          message: `Connected to Supabase but query failed: ${error.message}`,
          detail: JSON.stringify(error, null, 2),
        };
      } else {
        results.supabase = {
          ok: true,
          message: `Connected successfully to ${url.replace('https://', '').split('.')[0]}.supabase.co`,
        };
      }
    }
  } catch (err) {
    results.supabase = {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error connecting to Supabase',
    };
  }

  // ── Test Resend ────────────────────────────────────────────────────────────
  try {
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey || resendKey.includes('your-')) {
      results.resend = {
        ok: false,
        message: 'RESEND_API_KEY is missing or still set to a placeholder value.',
      };
    } else {
      const res = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        results.resend = {
          ok: false,
          message: `Resend API rejected the key: ${data?.message || `HTTP ${res.status}`}`,
          detail: JSON.stringify(data, null, 2),
        };
      } else {
        const domainCount = Array.isArray(data?.data) ? data.data.length : 0;
        results.resend = {
          ok: true,
          message: `API key is valid. ${domainCount} domain${domainCount !== 1 ? 's' : ''} registered in Resend.`,
        };
      }
    }
  } catch (err) {
    results.resend = {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error connecting to Resend',
    };
  }

  // ── Test Stripe ────────────────────────────────────────────────────────────
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const stripePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!stripeSecret || stripeSecret.includes('your-')) {
      results.stripe = {
        ok: false,
        message: 'STRIPE_SECRET_KEY is missing or still set to a placeholder value.',
        detail: stripePublic && !stripePublic.includes('your-')
          ? 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set. Only STRIPE_SECRET_KEY is missing.'
          : undefined,
      };
    } else {
      const res = await fetch('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        results.stripe = {
          ok: false,
          message: `Stripe API error: ${data?.error?.message || `HTTP ${res.status}`}`,
          detail: JSON.stringify(data, null, 2),
        };
      } else {
        const isLive = stripeSecret.startsWith('sk_live_');
        const available = data?.available?.[0];
        const balanceStr = available
          ? `Balance: ${(available.amount / 100).toFixed(2)} ${available.currency?.toUpperCase()}`
          : 'Balance retrieved';
        results.stripe = {
          ok: true,
          message: `${isLive ? '🟢 Live' : '🟡 Test'} mode connected. ${balanceStr}.`,
        };
      }
    }
  } catch (err) {
    results.stripe = {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error connecting to Stripe',
    };
  }

  // ── Test Twilio ────────────────────────────────────────────────────────────
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (
      !accountSid || accountSid.includes('your-') ||
      !authToken || authToken.includes('your-') ||
      !phoneNumber || phoneNumber.includes('your-')
    ) {
      const missing = [
        (!accountSid || accountSid.includes('your-')) ? 'TWILIO_ACCOUNT_SID' : null,
        (!authToken || authToken.includes('your-')) ? 'TWILIO_AUTH_TOKEN' : null,
        (!phoneNumber || phoneNumber.includes('your-')) ? 'TWILIO_PHONE_NUMBER' : null,
      ].filter(Boolean);
      results.twilio = {
        ok: false,
        message: `Missing Twilio credentials: ${missing.join(', ')}`,
      };
    } else {
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        results.twilio = {
          ok: false,
          message: `Twilio API error: ${data?.message || `HTTP ${res.status}`}`,
          detail: JSON.stringify(data, null, 2),
        };
      } else {
        const friendlyName = data?.friendly_name || accountSid;
        const status = data?.status || 'active';
        results.twilio = {
          ok: true,
          message: `Connected — Account: "${friendlyName}" (${status}). SMS number: ${phoneNumber}`,
        };
      }
    }
  } catch (err) {
    results.twilio = {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error connecting to Twilio',
    };
  }

  // ── Test Google / Gmail ────────────────────────────────────────────────────
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (
      !clientId || clientId.includes('your-') ||
      !clientSecret || clientSecret.includes('your-')
    ) {
      const missing = [
        (!clientId || clientId.includes('your-')) ? 'GOOGLE_CLIENT_ID' : null,
        (!clientSecret || clientSecret.includes('your-')) ? 'GOOGLE_CLIENT_SECRET' : null,
      ].filter(Boolean);
      results.google = {
        ok: false,
        message: `Missing Google credentials: ${missing.join(', ')}`,
      };
    } else {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: tokenRow } = await supabase
        .from('google_calendar_tokens')
        .select('email, account_email, refresh_token, created_at')
        .limit(1)
        .single();

      if (!tokenRow?.refresh_token) {
        results.google = {
          ok: false,
          message: 'Google credentials are set but no OAuth token found. Complete the Google OAuth flow at /api/google-calendar/callback to authorize Gmail sending.',
          detail: `Client ID is configured. Visit /admin to connect your Google account.`,
        };
      } else {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokenRow.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
          results.google = {
            ok: false,
            message: `Google OAuth token refresh failed: ${tokenData.error_description || tokenData.error || 'Unknown error'}`,
            detail: JSON.stringify(tokenData, null, 2),
          };
        } else {
          const accountEmail =
            tokenRow.email || tokenRow.account_email || process.env.GMAIL_SENDER_EMAIL || 'configured';
          results.google = {
            ok: true,
            message: `Gmail connected — sending as ${accountEmail}. OAuth token is valid.`,
          };
        }
      }
    }
  } catch (err) {
    results.google = {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error connecting to Google',
    };
  }

  const allOk =
    results.supabase.ok &&
    results.resend.ok &&
    results.stripe.ok &&
    results.twilio.ok &&
    results.google.ok;

  return NextResponse.json({ ok: allOk, results }, { status: 200 });
}
