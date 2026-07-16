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

function buildEmailHtml(opts: {
  subject: string;
  preheader: string;
  badge: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
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
      <!-- Header -->
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
      <!-- Body -->
      <tr><td style="padding:28px 28px 24px;">
        ${badge}
        ${heading}
        ${bodyLines}
        ${cta}
        <!-- Signature -->
        <div style="margin-top:20px;border-top:1px solid ${BRAND.border};padding-top:16px;">
          <p style="margin:0 0 3px;font-size:13px;color:${BRAND.foreground};font-family:Georgia,serif;">Warm regards,</p>
          <p style="margin:0 0 2px;font-size:14px;color:${BRAND.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
          <p style="margin:0 0 5px;font-size:10px;color:${BRAND.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${BRAND.accent};font-size:11px;font-family:Georgia,serif;text-decoration:none;">maggimaybroussard@gmail.com</a>
        </div>
      </td></tr>
      <!-- Footer -->
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

// ─── GET — load all saved templates ──────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('category');

    if (error) throw error;
    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    console.error('[email-templates GET]', err);
    return NextResponse.json({ templates: [] });
  }
}

// ─── POST — save template OR send test email ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── Save template ──────────────────────────────────────────────────────
    if (action === 'save') {
      const { templateId, category, subject, preheader, badge, heading, body: emailBody, ctaLabel, ctaUrl } = body;
      if (!templateId || !category || !subject) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const supabase = await createClient();
      const { error } = await supabase.from('email_templates').upsert(
        {
          template_id: templateId,
          category,
          subject,
          preheader: preheader ?? '',
          badge: badge ?? '',
          heading: heading ?? '',
          body: emailBody ?? '',
          cta_label: ctaLabel ?? '',
          cta_url: ctaUrl ?? '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'template_id' }
      );

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── Send test email ────────────────────────────────────────────────────
    if (action === 'test_send') {
      const { toEmail, subject, preheader, badge, heading, body: emailBody, ctaLabel, ctaUrl } = body;
      if (!toEmail || !subject) {
        return NextResponse.json({ error: 'Missing toEmail or subject' }, { status: 400 });
      }

      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey || resendKey === 'your-resend-api-key-here') {
        return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
      }

      const html = buildEmailHtml({ subject, preheader, badge, heading, body: emailBody, ctaLabel, ctaUrl });

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Maggi May Broussard <onboarding@resend.dev>',
          to: [toEmail],
          subject: `[TEST] ${subject}`,
          html,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        return NextResponse.json({ error: resendData?.message ?? 'Resend error' }, { status: 502 });
      }

      return NextResponse.json({ success: true, emailId: resendData.id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[email-templates POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
