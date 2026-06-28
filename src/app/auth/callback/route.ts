import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/portal/onboarding';

  const supabase = await createClient();

  // ── PKCE flow: token_hash + type (used by Supabase SSR/Next.js) ──────────
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const isAdmin = next.startsWith('/admin');
      if (isAdmin) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    // On error
    const isAdmin = next.startsWith('/admin');
    return NextResponse.redirect(
      `${origin}${isAdmin ? '/admin/login' : '/portal/login'}?error=auth_callback_failed`
    );
  }

  // ── Implicit flow: authorization code exchange ────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isAdmin = next.startsWith('/admin');
      if (isAdmin) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // On error — distinguish admin vs portal
  const isAdmin = next.startsWith('/admin');
  return NextResponse.redirect(
    `${origin}${isAdmin ? '/admin/login' : '/portal/login'}?error=auth_callback_failed`
  );
}
