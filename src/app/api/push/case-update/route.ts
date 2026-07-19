/**
 * Case Update Push Notification Trigger
 * Sends PWA push notifications for case updates and document-ready alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:broussardlegalservices@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';

type NotificationType = 'case_update' | 'document_ready' | 'invoice_ready' | 'message' | 'deadline';

interface NotificationPayload {
  type: NotificationType;
  clientId?: string;
  clientEmail?: string;
  title?: string;
  body?: string;
  url?: string;
  caseId?: string;
  documentName?: string;
}

function buildPayload(type: NotificationType, data: NotificationPayload): { title: string; body: string; url: string; tag: string; icon: string } {
  const icon = `${SITE_URL}/assets/images/app_logo.png`;
  switch (type) {
    case 'case_update':
      return {
        title: data.title ?? 'Case Update — Broussard Legal Services',
        body: data.body ?? 'There has been an update to your case. Tap to view details.',
        url: data.url ?? `${SITE_URL}/portal/case-status`,
        tag: `case_update_${data.caseId ?? Date.now()}`,
        icon,
      };
    case 'document_ready':
      return {
        title: data.title ?? '📄 Document Ready',
        body: data.body ?? `${data.documentName ?? 'Your document'} is ready to review and sign.`,
        url: data.url ?? `${SITE_URL}/portal/documents`,
        tag: `doc_ready_${Date.now()}`,
        icon,
      };
    case 'invoice_ready':
      return {
        title: data.title ?? '💳 Invoice Ready',
        body: data.body ?? 'A new invoice is ready for your review.',
        url: data.url ?? `${SITE_URL}/portal/invoices`,
        tag: `invoice_${Date.now()}`,
        icon,
      };
    case 'message':
      return {
        title: data.title ?? '💬 New Message',
        body: data.body ?? 'You have a new message from Broussard Legal Services.',
        url: data.url ?? `${SITE_URL}/portal/messages`,
        tag: `message_${Date.now()}`,
        icon,
      };
    case 'deadline':
      return {
        title: data.title ?? '⏰ Deadline Reminder',
        body: data.body ?? 'You have an upcoming deadline. Tap to view.',
        url: data.url ?? `${SITE_URL}/portal/case-status`,
        tag: `deadline_${Date.now()}`,
        icon,
      };
    default:
      return {
        title: data.title ?? 'Broussard Legal Services',
        body: data.body ?? 'You have a new notification.',
        url: data.url ?? SITE_URL,
        tag: `notification_${Date.now()}`,
        icon,
      };
  }
}

async function sendWebPush(sub: { endpoint: string; p256dh: string | null; auth: string | null }, payload: object): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    const webpush = await import('web-push');
    webpush.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    await webpush.default.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' } },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
      return false;
    }
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json() as NotificationPayload;
    const { type, clientId, clientEmail } = data;

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    const payload = buildPayload(type, data);

    // Find subscriptions
    let query = supabaseAdmin.from('push_subscriptions').select('endpoint, p256dh, auth, user_id, user_type');

    if (clientId) {
      query = query.eq('user_id', clientId);
    } else if (clientEmail) {
      // Look up user by email
      const { data: profile } = await supabaseAdmin
        .from('client_profiles')
        .select('user_id')
        .eq('email', clientEmail)
        .maybeSingle();
      if (profile?.user_id) {
        query = query.eq('user_id', profile.user_id);
      } else {
        return NextResponse.json({ sent: 0, message: 'No subscriptions found for client' });
      }
    } else {
      // Send to all clients
      query = query.eq('user_type', 'client');
    }

    const { data: subscriptions } = await query;
    if (!subscriptions?.length) {
      return NextResponse.json({ sent: 0, message: 'No push subscriptions found' });
    }

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subscriptions) {
      const ok = await sendWebPush(sub, payload);
      if (ok) {
        sent++;
      } else {
        expired.push(sub.endpoint);
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expired);
    }

    return NextResponse.json({ sent, total: subscriptions.length, expired: expired.length });
  } catch (err) {
    console.error('[push/case-update]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
