import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/twilio/smsClient';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? 'mailto:broussardlegalservices@gmail.com';

const brand = {
  bg: '#FAF7F2',
  bgCard: '#FFFFFF',
  primary: '#4A3728',
  accent: '#C8965A',
  accentLight: '#F5EDE0',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
};

interface TriggerEventPayload {
  eventKey: string;
  clientEmail: string;
  clientName: string;
  clientPhone?: string;
  variables?: Record<string, string>;
  clientUserId?: string;
}

function resolveTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
  }
  result = result.replace(/\{\{siteUrl\}\}/g, SITE_URL);
  return result;
}

function buildEventEmailHtml(params: {
  subject: string;
  badge: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const { subject, badge, bodyText, ctaLabel, ctaUrl } = params;

  const bodyHtml = bodyText
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      return `<p style="margin:0 0 14px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,'Times New Roman',serif;">${trimmed}</p>`;
    })
    .join('');

  const badgeHtml = badge
    ? `<span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:18px; font-family:Georgia,serif;">${badge}</span>`
    : '';

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:22px 0;">
          <tr>
            <td style="background-color:${brand.accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.25);">
              <a href="${ctaUrl}" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">${ctaLabel} &rarr;</a>
            </td>
          </tr>
        </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:${brand.secondary}; font-family:Georgia,'Times New Roman',serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary}; padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr>
          <td style="background-color:${brand.primary}; padding:0;">
            <div style="height:4px; background:linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent}; padding-right:14px; vertical-align:middle;">
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Paralegal</p>
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family:Georgia,serif; line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px; vertical-align:middle;">
                        <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family:Georgia,'Times New Roman',serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family:Georgia,serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px; background:linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 0;">
            ${badgeHtml}
            <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${subject}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            ${bodyHtml}
            ${ctaHtml}
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px; border-top:1px solid ${brand.border}; padding-top:18px; width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family:Georgia,serif;">Warm regards,</p>
                  <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                  <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">broussardlegalservices@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7; font-family:Georgia,serif;">
              You received this because you have an active matter with Broussard Legal Services.
              <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Push helper ────────────────────────────────────────────────────────────────
interface PushSubRecord {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

async function sendPushToSubscriptions(
  subs: PushSubRecord[],
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || subs.length === 0) return;
  try {
    const webpush = await import('web-push');
    webpush.default.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    await Promise.allSettled(
      subs.map((sub) =>
        webpush.default.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' } },
          JSON.stringify(payload)
        )
      )
    );
  } catch {
    // non-fatal
  }
}

// ── Push event → notification mapping ─────────────────────────────────────────
const PUSH_EVENT_MAP: Record<string, { title: string; urlPath: string; tag: string }> = {
  case_status_updated: { title: 'Case Update', urlPath: '/portal/cases', tag: 'case-update' },
  case_note_added: { title: 'Case Note Added', urlPath: '/portal/cases', tag: 'case-note' },
  case_closed: { title: 'Case Closed', urlPath: '/portal/cases', tag: 'case-closed' },
  invoice_issued: { title: 'New Invoice', urlPath: '/portal/invoices', tag: 'invoice-issued' },
  invoice_overdue: { title: 'Invoice Overdue', urlPath: '/portal/invoices', tag: 'invoice-overdue' },
  invoice_paid: { title: 'Payment Confirmed', urlPath: '/portal/invoices', tag: 'invoice-paid' },
  appointment_confirmed: { title: 'Consultation Booked', urlPath: '/portal/dashboard', tag: 'appointment' },
  appointment_reminder: { title: 'Consultation Reminder', urlPath: '/portal/dashboard', tag: 'appointment-reminder' },
  document_sent: { title: 'Document Ready for Review', urlPath: '/portal/documents', tag: 'document-sent' },
  document_approved: { title: 'Document Approved', urlPath: '/portal/documents', tag: 'document-approved' },
  document_signature_requested: { title: 'Signature Required', urlPath: '/portal/signatures', tag: 'signature-request' },
};

export async function POST(req: NextRequest) {
  try {
    const body: TriggerEventPayload = await req.json();
    const { eventKey, clientEmail, clientName, clientPhone, variables = {}, clientUserId } = body;

    if (!eventKey || !clientEmail || !clientName) {
      return NextResponse.json(
        { error: 'Missing required fields: eventKey, clientEmail, clientName' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Fetch event config
    const { data: config, error: configError } = await supabase
      .from('notification_event_config')
      .select('*')
      .eq('event_key', eventKey)
      .maybeSingle();

    if (configError || !config) {
      return NextResponse.json(
        { error: `Event config not found for key: ${eventKey}` },
        { status: 404 }
      );
    }

    if (!config.is_enabled && !config.sms_enabled) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Event "${eventKey}" is disabled by admin configuration`,
      });
    }

    // Merge variables with defaults
    const allVars: Record<string, string> = {
      clientName,
      siteUrl: SITE_URL,
      ...variables,
    };

    // ── Email ──────────────────────────────────────────────────────────────────
    let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
    let emailId: string | null = null;
    let emailError: string | null = null;

    if (config.is_enabled) {
      if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
        emailStatus = 'failed';
        emailError = 'RESEND_API_KEY is not configured';
      } else {
        const resolvedSubject = resolveTemplate(config.email_subject_template, allVars);
        const resolvedBody = resolveTemplate(config.email_body_template, allVars);
        const resolvedCtaUrl = resolveTemplate(config.email_cta_url_template, allVars);
        const resolvedBadge = resolveTemplate(config.email_badge, allVars);
        const resolvedCtaLabel = config.email_cta_label;

        const html = buildEventEmailHtml({
          subject: resolvedSubject,
          badge: resolvedBadge,
          bodyText: resolvedBody,
          ctaLabel: resolvedCtaLabel,
          ctaUrl: resolvedCtaUrl,
        });

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Maggi May Broussard <broussardlegalservices@gmail.com>',
            to: [clientEmail],
            subject: resolvedSubject,
            html,
          }),
        });

        const resendData = await resendRes.json();
        if (resendRes.ok) {
          emailStatus = 'sent';
          emailId = resendData?.id ?? null;
        } else {
          emailStatus = 'failed';
          emailError = resendData?.message ?? 'Resend API error';
        }
      }
    }

    // ── SMS ────────────────────────────────────────────────────────────────────
    let smsStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
    let smsSid: string | null = null;

    if (config.sms_enabled && clientPhone && config.sms_body_template) {
      const resolvedSmsBody = resolveTemplate(config.sms_body_template, allVars);
      const smsResult = await sendSMS(clientPhone, resolvedSmsBody);
      if (smsResult.success) {
        smsStatus = 'sent';
        smsSid = smsResult.messageSid ?? null;
      } else {
        smsStatus = 'failed';
      }
    }

    // ── Push Notifications ─────────────────────────────────────────────────────
    const pushMeta = PUSH_EVENT_MAP[eventKey];
    if (pushMeta && (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)) {
      try {
        const supabaseForPush = await createServerClient();
        const resolvedSubject = config.is_enabled
          ? resolveTemplate(config.email_subject_template, allVars)
          : pushMeta.title;

        // Build push query — target client by userId if available, else by user_type
        let pushQuery = supabaseForPush.from('push_subscriptions').select('endpoint, p256dh, auth');
        if (clientUserId) {
          pushQuery = pushQuery.eq('user_id', clientUserId);
        } else {
          pushQuery = pushQuery.eq('user_type', 'client');
        }
        const { data: clientSubs } = await pushQuery;

        // Also notify admin subscribers for key events
        const adminEvents = ['invoice_issued', 'appointment_confirmed', 'document_sent', 'document_signature_requested'];
        let adminSubs: PushSubRecord[] = [];
        if (adminEvents.includes(eventKey)) {
          const { data: aSubs } = await supabaseForPush
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('user_type', 'admin');
          adminSubs = (aSubs as PushSubRecord[]) ?? [];
        }

        const pushPayload = {
          title: pushMeta.title,
          body: resolvedSubject,
          url: `${SITE_URL}${pushMeta.urlPath}`,
          tag: pushMeta.tag,
          icon: '/assets/images/app_logo.png',
        };

        await Promise.all([
          sendPushToSubscriptions((clientSubs as PushSubRecord[]) ?? [], pushPayload),
          adminSubs.length > 0
            ? sendPushToSubscriptions(adminSubs, {
                ...pushPayload,
                url: `${SITE_URL}/admin`,
                title: `[Client] ${pushMeta.title}`,
              })
            : Promise.resolve(),
        ]);
      } catch {
        // push is non-fatal
      }
    }

    // ── Log ────────────────────────────────────────────────────────────────────
    const resolvedSubjectForLog = config.is_enabled
      ? resolveTemplate(config.email_subject_template, allVars)
      : `[SMS only] ${config.event_label}`;

    const overallStatus = emailStatus === 'sent' || smsStatus === 'sent' ? 'sent' : 'failed';

    await supabase.from('notification_event_log').insert({
      event_key: eventKey,
      client_email: clientEmail,
      client_name: clientName,
      client_phone: clientPhone ?? null,
      subject: resolvedSubjectForLog,
      resend_email_id: emailId,
      sms_message_sid: smsSid,
      sms_status: smsStatus,
      status: overallStatus,
      error_message: emailError,
      metadata: { variables: allVars, emailStatus, smsStatus },
    });

    if (emailStatus === 'failed' && smsStatus !== 'sent') {
      return NextResponse.json(
        { error: emailError ?? 'Failed to send notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      emailId,
      emailStatus,
      smsStatus,
      smsSid,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: fetch all event configs (for admin UI)
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('notification_event_config')
      .select('*')
      .order('event_category', { ascending: true })
      .order('event_label', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ configs: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch configs' },
      { status: 500 }
    );
  }
}

// PATCH: update a single event config
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('notification_event_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ config: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update config' },
      { status: 500 }
    );
  }
}
