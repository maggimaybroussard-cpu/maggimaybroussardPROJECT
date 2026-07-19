import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

async function sendWebPush(endpoint: string, p256dh: string, auth: string, payload: PushPayload): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || VAPID_PUBLIC_KEY.startsWith('your-')) return false;
  try {
    const webpush = await import('web-push');
    webpush.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    await webpush.default.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

// POST /api/push/case-update — send push notification for case status update or document ready
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_type, client_id, client_email, case_name, message, url } = body;

    if (!event_type || !message) {
      return NextResponse.json({ error: 'event_type and message are required' }, { status: 400 });
    }

    // Build notification payload
    const payloadMap: Record<string, PushPayload> = {
      case_update: {
        title: '📋 Case Update — Broussard Legal',
        body: message || `Your case "${case_name}" has been updated.`,
        url: url || '/portal/case-status',
        tag: 'case-update',
        icon: '/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784425220426.png',
      },
      document_ready: {
        title: '📄 Document Ready — Broussard Legal',
        body: message || `A document is ready for your review.`,
        url: url || '/portal/documents',
        tag: 'document-ready',
        icon: '/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784425220426.png',
      },
      invoice_issued: {
        title: '🧾 New Invoice — Broussard Legal',
        body: message || 'A new invoice has been issued for your account.',
        url: url || '/portal/invoices',
        tag: 'invoice',
        icon: '/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784425220426.png',
      },
      appointment_reminder: {
        title: '📅 Appointment Reminder — Broussard Legal',
        body: message || 'You have an upcoming consultation.',
        url: url || '/portal/dashboard',
        tag: 'appointment',
        icon: '/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784425220426.png',
      },
    };

    const payload = payloadMap[event_type] || {
      title: 'Broussard Legal Services',
      body: message,
      url: url || '/portal/dashboard',
      tag: event_type,
      icon: '/assets/images/Gemini_Generated_Image_c0brnc0brnc0brnc-1784425220426.png',
    };

    // Find push subscriptions for this client
    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id');
    if (client_id) {
      query = query.eq('user_id', client_id);
    } else if (client_email) {
      // Try to find by email via profiles
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('id')
        .eq('email', client_email)
        .maybeSingle();
      if (profile?.id) {
        query = query.eq('user_id', profile.id);
      }
    }

    const { data: subscriptions } = await query;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No push subscriptions found for this client' });
    }

    let sent = 0;
    for (const sub of subscriptions) {
      if (sub.endpoint && sub.p256dh && sub.auth) {
        const ok = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, payload);
        if (ok) sent++;
      }
    }

    // Log the notification event
    await supabase.from('notification_events').insert({
      event_type,
      client_id: client_id || null,
      client_email: client_email || null,
      message,
      channel: 'push',
      sent_count: sent,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ success: true, sent, total_subscriptions: subscriptions.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
