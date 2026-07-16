import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BRAND = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  accentLight: '#F5EDE0',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
};

// ─── Default templates (fallback when no DB override exists) ──────────────────
const DEFAULT_TEMPLATES: Record<string, {
  subject: string; preheader: string; badge: string;
  heading: string; body: string; ctaLabel: string; ctaUrl: string;
}> = {
  // Case updates
  case_status_update: {
    subject: 'Case update — {{caseName}} status changed to {{newStatus}}',
    preheader: 'Your case {{caseName}} has been updated. Log in to see the latest.',
    badge: 'Case Update',
    heading: 'Update on Your Case, {{firstName}}',
    body: 'Hi {{firstName}},\n\nI wanted to let you know that there has been an update on your {{caseName}} matter.\n\nCase: {{caseName}}\nNew Status: {{newStatus}}\nUpdated: {{updateDate}}\n\nPlease log in to your client portal to view the full details.',
    ctaLabel: 'View Case in Portal',
    ctaUrl: '{{siteUrl}}/portal/cases',
  },
  case_document_uploaded: {
    subject: 'New document added to your case — {{caseName}}',
    preheader: 'A new document has been added to your {{caseName}} case file.',
    badge: 'Document Added',
    heading: 'New Document Added to Your Case',
    body: 'Hi {{firstName}},\n\nA new document has been added to your {{caseName}} case file.\n\nDocument: {{documentName}}\nCase: {{caseName}}\nAdded: {{uploadDate}}\n\nYou can view and download this document by logging in to your client portal.',
    ctaLabel: 'View Document',
    ctaUrl: '{{siteUrl}}/portal/cases',
  },
  case_timeline_event: {
    subject: 'Case timeline update — {{caseName}}',
    preheader: 'A new event has been added to your {{caseName}} case timeline.',
    badge: 'Timeline Update',
    heading: 'New Event on Your Case Timeline',
    body: 'Hi {{firstName}},\n\nA new event has been recorded on the timeline for your {{caseName}} matter.\n\nEvent: {{eventTitle}}\nDate: {{eventDate}}\nCase: {{caseName}}\n\nLog in to your client portal to view the full timeline.',
    ctaLabel: 'View Case Timeline',
    ctaUrl: '{{siteUrl}}/portal/cases',
  },
  // Appointment reminders
  reminder_appointment_24h: {
    subject: 'Reminder: Your appointment tomorrow at {{eventTime}}',
    preheader: 'Your appointment with Maggi May Broussard is tomorrow.',
    badge: 'Appointment Reminder',
    heading: 'Your Appointment Is Tomorrow, {{firstName}}',
    body: 'Hi {{firstName}},\n\nThis is a friendly reminder that you have an appointment scheduled for tomorrow.\n\nDate: {{eventDate}}\nTime: {{eventTime}}\nFormat: {{meetingFormat}}\n\nIf you need to reschedule, please contact me as soon as possible.',
    ctaLabel: 'View or Reschedule',
    ctaUrl: '{{siteUrl}}/availability',
  },
  reminder_appointment_1h: {
    subject: 'Your appointment starts in 1 hour — {{eventTime}}',
    preheader: 'Your appointment with Maggi May Broussard starts in 1 hour.',
    badge: 'Starting Soon',
    heading: 'Your Appointment Starts in 1 Hour',
    body: 'Hi {{firstName}},\n\nYour appointment with Maggi May Broussard starts in approximately 1 hour.\n\nTime: {{eventTime}}\nFormat: {{meetingFormat}}\n\nPlease make sure you are prepared and have any relevant documents ready.',
    ctaLabel: 'View Appointment Details',
    ctaUrl: '{{siteUrl}}/portal/dashboard',
  },
  // Invoice notifications
  invoice_issued: {
    subject: 'Invoice #{{invoiceNumber}} — {{amount}} due {{dueDate}}',
    preheader: 'Your invoice for {{serviceName}} is ready. Payment due {{dueDate}}.',
    badge: 'Invoice Ready',
    heading: 'Invoice #{{invoiceNumber}} — {{amount}} Due',
    body: 'Hi {{firstName}},\n\nPlease find your invoice for {{serviceName}} attached to this email.\n\nInvoice #{{invoiceNumber}}\nAmount Due: {{amount}}\nDue Date: {{dueDate}}\n\nYou can pay securely online using the button below.',
    ctaLabel: 'Pay Invoice Now',
    ctaUrl: '{{paymentLink}}',
  },
  invoice_paid: {
    subject: 'Payment received — Invoice #{{invoiceNumber}} ✓',
    preheader: 'Your payment of {{amount}} has been received. Thank you.',
    badge: 'Payment Confirmed',
    heading: 'Payment Received — Thank You, {{firstName}}',
    body: 'Hi {{firstName}},\n\nWe have received your payment of {{amount}} for Invoice #{{invoiceNumber}}. Your account is now up to date.\n\nPayment Date: {{paymentDate}}\nAmount Paid: {{amount}}\nReference: {{invoiceNumber}}\n\nA receipt has been attached to this email for your records.',
    ctaLabel: 'View Your Portal',
    ctaUrl: '{{siteUrl}}/portal/invoices',
  },
  invoice_overdue: {
    subject: 'Overdue: Invoice #{{invoiceNumber}} — {{amount}} past due',
    preheader: 'Invoice #{{invoiceNumber}} is now past due. Please arrange payment.',
    badge: 'Payment Overdue',
    heading: 'Invoice #{{invoiceNumber}} Is Past Due',
    body: 'Hi {{firstName}},\n\nThis is a notice that Invoice #{{invoiceNumber}} for {{amount}} was due on {{dueDate}} and remains unpaid.\n\nAmount Due: {{amount}}\nOriginal Due Date: {{dueDate}}\n\nPlease arrange payment at your earliest convenience.',
    ctaLabel: 'Pay Now',
    ctaUrl: '{{paymentLink}}',
  },
};

// ─── Variable substitution ────────────────────────────────────────────────────
function substituteVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value ?? '');
  }
  return result;
}

// ─── Build HTML email ─────────────────────────────────────────────────────────
function buildEmailHtml(opts: {
  subject: string; preheader: string; badge: string;
  heading: string; body: string; ctaLabel: string; ctaUrl: string;
}): string {
  const bodyLines = opts.body
    .split('\n')
    .filter((l) => l.trim())
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:13px;color:${BRAND.foreground};line-height:1.8;font-family:Georgia,serif;">${line}</p>`
    )
    .join('');

  const badge = opts.badge
    ? `<span style="display:inline-block;background:${BRAND.accent};color:${BRAND.white};font-size:9px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:3px 12px;border-radius:20px;margin-bottom:16px;font-family:Georgia,serif;">${opts.badge}</span>`
    : '';

  const heading = opts.heading
    ? `<h2 style="margin:0 0 16px;font-size:17px;color:${BRAND.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${BRAND.border};padding-bottom:12px;">${opts.heading}</h2>`
    : '';

  const cta = opts.ctaLabel
    ? `<div style="margin:20px 0;"><a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND.accent};border-radius:7px;padding:10px 24px;color:${BRAND.white};font-size:12px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;text-decoration:none;">${opts.ctaLabel} →</a></div>`
    : '';

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${opts.subject}</title></head>
<body style="margin:0;padding:0;background:${BRAND.secondary};">
${preheader}
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.secondary};padding:24px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);max-width:520px;">
      <tr><td style="background:${BRAND.primary};">
        <div style="height:4px;background:linear-gradient(to right,${BRAND.accent},#E8B87A,${BRAND.accent});"></div>
        <div style="padding:20px 28px 16px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="border-right:2px solid ${BRAND.accent};padding-right:12px;">
              <p style="margin:0;font-size:9px;color:${BRAND.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
              <p style="margin:0;font-size:9px;color:${BRAND.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
            </td>
            <td style="padding-left:12px;">
              <h1 style="margin:0;font-size:18px;color:${BRAND.white};font-family:Georgia,serif;font-weight:normal;">Maggi May Broussard</h1>
              <p style="margin:3px 0 0;font-size:10px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;">Louisiana &amp; Nationwide</p>
            </td>
          </tr></table>
        </div>
        <div style="height:1px;background:linear-gradient(to right,${BRAND.accent},rgba(200,150,90,0.2),transparent);margin:0 28px;"></div>
        <div style="height:16px;"></div>
      </td></tr>
      <tr><td style="padding:28px 28px 24px;">
        ${badge}
        ${heading}
        ${bodyLines}
        ${cta}
        <div style="margin-top:20px;border-top:1px solid ${BRAND.border};padding-top:16px;">
          <p style="margin:0 0 3px;font-size:13px;color:${BRAND.foreground};font-family:Georgia,serif;">Warm regards,</p>
          <p style="margin:0 0 2px;font-size:14px;color:${BRAND.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
          <p style="margin:0 0 5px;font-size:10px;color:${BRAND.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${BRAND.accent};font-size:11px;font-family:Georgia,serif;text-decoration:none;">maggimaybroussard@gmail.com</a>
        </div>
      </td></tr>
      <tr><td style="background:${BRAND.secondary};padding:14px 28px;border-top:1px solid ${BRAND.border};">
        <p style="margin:0 0 4px;font-size:10px;color:${BRAND.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard Legal Services</p>
        <p style="margin:0;font-size:9px;color:${BRAND.muted};line-height:1.7;font-family:Georgia,serif;">You received this email from maggimay.com · <span style="color:${BRAND.muted};">Unsubscribe</span></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── POST — auto-send a template email ───────────────────────────────────────
/**
 * Body:
 * {
 *   templateId: string,          // e.g. 'case_status_update'
 *   toEmail: string,             // client email
 *   toName?: string,             // client name (for {{firstName}})
 *   ccInternal?: boolean,        // whether to CC internal admin email
 *   vars?: Record<string,string> // variable substitutions
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, toEmail, toName, ccInternal = false, vars = {} } = body;

    if (!templateId || !toEmail) {
      return NextResponse.json({ error: 'Missing templateId or toEmail' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey || resendKey === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

    // ── Load saved template from DB (or fall back to defaults) ────────────────
    const supabase = await createClient();
    const { data: dbTemplate } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_id', templateId)
      .maybeSingle();

    const defaults = DEFAULT_TEMPLATES[templateId];
    const tpl = dbTemplate
      ? {
          subject: dbTemplate.subject,
          preheader: dbTemplate.preheader,
          badge: dbTemplate.badge,
          heading: dbTemplate.heading,
          body: dbTemplate.body,
          ctaLabel: dbTemplate.cta_label,
          ctaUrl: dbTemplate.cta_url,
        }
      : defaults;

    if (!tpl) {
      return NextResponse.json({ error: `Unknown templateId: ${templateId}` }, { status: 400 });
    }

    // ── Load auto-send settings (internal CC email) ───────────────────────────
    const { data: settingsRow } = await supabase
      .from('email_template_settings')
      .select('internal_cc_email, auto_send_enabled')
      .maybeSingle();

    const internalEmail = settingsRow?.internal_cc_email ?? null;
    const autoSendEnabled = settingsRow?.auto_send_enabled ?? true;

    if (!autoSendEnabled) {
      return NextResponse.json({ skipped: true, reason: 'Auto-send is disabled in settings' });
    }

    // ── Substitute variables ──────────────────────────────────────────────────
    const firstName = toName ? toName.split(' ')[0] : '';
    const allVars: Record<string, string> = {
      firstName,
      siteUrl,
      updateDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      ...vars,
    };

    const subject = substituteVars(tpl.subject, allVars);
    const preheader = substituteVars(tpl.preheader, allVars);
    const badge = substituteVars(tpl.badge, allVars);
    const heading = substituteVars(tpl.heading, allVars);
    const emailBody = substituteVars(tpl.body, allVars);
    const ctaLabel = substituteVars(tpl.ctaLabel, allVars);
    const ctaUrl = substituteVars(tpl.ctaUrl, allVars);

    const html = buildEmailHtml({ subject, preheader, badge, heading, body: emailBody, ctaLabel, ctaUrl });

    // ── Build recipient list ──────────────────────────────────────────────────
    const toList = [toEmail];
    const ccList: string[] = [];
    if (ccInternal && internalEmail) {
      ccList.push(internalEmail);
    }

    // ── Send via Resend ───────────────────────────────────────────────────────
    const resendPayload: Record<string, unknown> = {
      from: 'Maggi May Broussard <onboarding@resend.dev>',
      to: toList,
      subject,
      html,
    };
    if (ccList.length > 0) resendPayload.cc = ccList;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      return NextResponse.json({ error: resendData?.message ?? 'Resend error' }, { status: 502 });
    }

    // ── Log the send ──────────────────────────────────────────────────────────
    await supabase.from('email_send_log').insert({
      template_id: templateId,
      to_email: toEmail,
      to_name: toName ?? null,
      subject,
      resend_email_id: resendData.id ?? null,
      cc_internal: ccInternal && !!internalEmail,
      vars_used: allVars,
      sent_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

    return NextResponse.json({ success: true, emailId: resendData.id, subject });
  } catch (err) {
    console.error('[auto-send]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET — fetch auto-send settings ──────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('email_template_settings')
      .select('*')
      .maybeSingle();

    return NextResponse.json({ settings: data ?? { internal_cc_email: '', auto_send_enabled: true, cc_on_case_updates: true, cc_on_appointments: true, cc_on_invoices: true } });
  } catch {
    return NextResponse.json({ settings: { internal_cc_email: '', auto_send_enabled: true, cc_on_case_updates: true, cc_on_appointments: true, cc_on_invoices: true } });
  }
}

// ─── PATCH — update auto-send settings ───────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    const { error } = await supabase.from('email_template_settings').upsert(
      {
        id: 1,
        internal_cc_email: body.internal_cc_email ?? '',
        auto_send_enabled: body.auto_send_enabled ?? true,
        cc_on_case_updates: body.cc_on_case_updates ?? true,
        cc_on_appointments: body.cc_on_appointments ?? true,
        cc_on_invoices: body.cc_on_invoices ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[auto-send PATCH]', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
