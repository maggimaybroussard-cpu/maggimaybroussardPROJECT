import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Default redirect after email confirmation goes to onboarding
  const next = searchParams.get('next') ?? '/portal/onboarding';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Admin confirmation links carry next=/admin/email-confirmed
      if (next.startsWith('/admin')) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // On error — distinguish admin vs portal
  const isAdmin = next.startsWith('/admin');
  if (isAdmin) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth_callback_failed`);
  }
  return NextResponse.redirect(`${origin}/portal/login?error=auth_callback_failed`);
}
