import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:broussardlegalservices@gmail.com';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  user_id: string | null;
  user_type: string;
}

async function sendWebPush(
  sub: PushSubscriptionRecord,
  payload: PushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured');
    return false;
  }

  try {
    // Dynamically import web-push (server-side only)
    const webpush = await import('web-push');
    webpush.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    await webpush.default.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh ?? '',
          auth: sub.auth ?? '',
        },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    // 410 Gone = subscription expired, should be removed
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
      return false; // caller will clean up
    }
    console.error('[Push] sendWebPush error:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, userType, payload } = body as {
      userId?: string;
      userType?: 'client' | 'admin' | 'all';
      payload: PushPayload;
    };

    if (!payload?.title) {
      return NextResponse.json({ error: 'Missing payload.title' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Build query
    let query = supabase.from('push_subscriptions').select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (userType && userType !== 'all') {
      query = query.eq('user_type', userType);
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, skipped: true });
    }

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(
      (subs as PushSubscriptionRecord[]).map(async (sub) => {
        const ok = await sendWebPush(sub, payload);
        if (ok) {
          sent++;
        } else {
          failed++;
          expiredEndpoints.push(sub.endpoint);
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return NextResponse.json({ sent, failed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send push' },
      { status: 500 }
    );
  }
}
