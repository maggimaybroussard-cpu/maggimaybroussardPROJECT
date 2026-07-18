import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const results: {
    supabase: { ok: boolean; message: string; detail?: string };
    resend: { ok: boolean; message: string; detail?: string };
  } = {
    supabase: { ok: false, message: '' },
    resend: { ok: false, message: '' },
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
      // Lightweight query — just check if we can reach the DB
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
      // Validate the key by hitting the Resend /domains endpoint (read-only, no email sent)
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

  const allOk = results.supabase.ok && results.resend.ok;
  return NextResponse.json({ ok: allOk, results }, { status: 200 });
}
