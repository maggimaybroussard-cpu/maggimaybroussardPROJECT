import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ── Simple in-memory rate limiter for AI chat route ───────────────────────────
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX = 60;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const aiRateLimitMap = new Map<string, RateLimitEntry>();

function checkAIRateLimit(ip: string): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const entry = aiRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // Prune stale entries every ~100 new IPs to prevent unbounded memory growth
    if (aiRateLimitMap.size > 500) {
      for (const [key, val] of aiRateLimitMap) {
        if (now > val.resetAt) aiRateLimitMap.delete(key);
      }
    }
    aiRateLimitMap.set(ip, { count: 1, resetAt: now + AI_RATE_LIMIT_WINDOW_MS });
    return { allowed: true, resetAt: now + AI_RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= AI_RATE_LIMIT_MAX) {
    return { allowed: false, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, resetAt: entry.resetAt };
}

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  const ref = getProjectRef();
  if (ref) {
    request.cookies.set(`sb-${ref}-auth-token`, token);
  }
}

/** Check if a user has the admin role via auth metadata */
function isAdminUser(user: any): boolean {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};
  return meta.role === 'admin' || appMeta.role === 'admin';
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);

  const { pathname } = request.nextUrl;

  // ─── AI chat rate limiting ────────────────────────────────────────────────
  if (pathname === '/api/ai/chat-completion') {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const { allowed, resetAt } = checkAIRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before sending more messages.', details: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(AI_RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
            'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        }
      );
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── Admin route protection ───────────────────────────────────────────────
  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminPublic =
    pathname === '/admin/login' ||
    pathname === '/admin/setup-totp' ||
    pathname === '/admin/verify-totp';

  if (isAdminRoute && !isAdminPublic) {
    // Must be authenticated first
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }

    // Must have admin role
    if (!isAdminUser(user)) {
      // Authenticated but not admin — redirect to portal or home
      const forbiddenUrl = request.nextUrl.clone();
      forbiddenUrl.pathname = '/portal/dashboard';
      return NextResponse.redirect(forbiddenUrl);
    }

    // Check MFA assurance level — if TOTP enrolled, require aal2
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const currentLevel = aalData?.currentLevel;
    const nextLevel = aalData?.nextLevel;

    // If TOTP is enrolled (nextLevel is aal2) but not yet verified (currentLevel is aal1)
    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = '/admin/verify-totp';
      return NextResponse.redirect(verifyUrl);
    }
  }

  // Redirect authenticated admin away from login/setup/verify once fully verified
  if (isAdminPublic && user && isAdminUser(user) && pathname === '/admin/login') {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const currentLevel = aalData?.currentLevel;
    const nextLevel = aalData?.nextLevel;

    if (nextLevel === 'aal2' && currentLevel !== 'aal2') {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = '/admin/verify-totp';
      return NextResponse.redirect(verifyUrl);
    }
    if (currentLevel === 'aal2') {
      const adminUrl = request.nextUrl.clone();
      adminUrl.pathname = '/admin';
      return NextResponse.redirect(adminUrl);
    }
  }

  // ─── Portal protection ────────────────────────────────────────────────────
  const isPortalRoute = pathname.startsWith('/portal');
  const isPortalPublic =
    pathname === '/portal/login' ||
    pathname === '/portal/register' ||
    pathname === '/portal/forgot-password' ||
    pathname === '/portal/reset-password' ||
    pathname === '/portal/onboarding';

  if (isPortalRoute && !isPortalPublic && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/portal/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isPortalPublic &&
    pathname !== '/portal/reset-password' &&
    pathname !== '/portal/onboarding' &&
    user
  ) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/portal/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  // ─── /client/* protection ─────────────────────────────────────────────────
  const isClientRoute = pathname.startsWith('/client');
  if (isClientRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/portal/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
