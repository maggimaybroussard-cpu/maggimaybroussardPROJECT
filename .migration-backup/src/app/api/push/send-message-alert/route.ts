import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:broussardlegalservices@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

async function sendWebPush(sub: PushSubscriptionRecord, payload: object): Promise<'ok' | 'expired' | 'error'> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 'error';
  try {
    const webpush = await import('web-push');
    webpush.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    await webpush.default.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' } },
      JSON.stringify(payload)
    );
    return 'ok';
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      const status = (err as { statusCode: number }).statusCode;
      if (status === 410 || status === 404) return 'expired';
    }
    console.error('[push/send-message-alert] sendWebPush error:', err);
    return 'error';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      matterId,
      senderRole,
      senderName,
      messageBody,
      caseName,
    }: {
      matterId: string;
      senderRole: 'client' | 'admin';
      senderName?: string;
      messageBody?: string;
      caseName?: string;
    } = body;

    if (!matterId || !senderRole) {
      return NextResponse.json({ error: 'Missing matterId or senderRole' }, { status: 400 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' });
    }

    const supabase = await createServerClient();

    // Determine push payload and target subscriptions
    const recipientRole = senderRole === 'admin' ? 'client' : 'admin';
    const displaySender = senderName ?? (senderRole === 'admin' ? 'Your Legal Team' : 'Client');
    const preview = messageBody
      ? messageBody.length > 80
        ? messageBody.slice(0, 77) + '…'
        : messageBody
      : 'Sent an attachment';

    const notifTitle = senderRole === 'admin'
      ? `New message from your legal team`
      : `New client message${caseName ? ` — ${caseName}` : ''}`;

    const notifBody = `${displaySender}: ${preview}`;
    const notifUrl = senderRole === 'admin'
      ? `${SITE_URL}/portal/cases/${matterId}`
      : `${SITE_URL}/admin/cases/${matterId}`;
    const notifTag = `matter-message-${matterId}`;

    const pushPayload = {
      title: notifTitle,
      body: notifBody,
      url: notifUrl,
      tag: notifTag,
      icon: '/assets/images/app_logo.png',
    };

    let subs: PushSubscriptionRecord[] = [];

    if (recipientRole === 'client') {
      // Look up the client's user_id from the matter (inquiry)
      const { data: matter } = await supabase
        .from('contact_inquiries')
        .select('user_id')
        .eq('id', matterId)
        .maybeSingle();

      const clientUserId = matter?.user_id;

      if (clientUserId) {
        const { data } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', clientUserId);
        subs = (data as PushSubscriptionRecord[]) ?? [];
      }
    } else {
      // Send to all admin subscriptions
      const { data } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_type', 'admin');
      subs = (data as PushSubscriptionRecord[]) ?? [];
    }

    if (subs.length === 0) {
      return NextResponse.json({ sent: 0, skipped: true, reason: 'No push subscriptions found for recipient' });
    }

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        const result = await sendWebPush(sub, pushPayload);
        if (result === 'ok') {
          sent++;
        } else if (result === 'expired') {
          expiredEndpoints.push(sub.endpoint);
          failed++;
        } else {
          failed++;
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
    console.error('[push/send-message-alert]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send push alert' },
      { status: 500 }
    );
  }
}
