import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const SITE_URL = "https://broussardlegalservices.com";
const PORTAL_URL = `${SITE_URL}/portal/invoices`;

// ─── Brand ────────────────────────────────────────────────────────────────────
const brand = {
  bg: "#FAF7F2",
  bgCard: "#FFFFFF",
  primary: "#4A3728",
  accent: "#C8965A",
  accentLight: "#F5EDE0",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
  green: "#355E3B",
  greenLight: "#EAF2EB",
  red: "#B91C1C",
  redLight: "#FEF2F2",
  orange: "#C2410C",
  orangeLight: "#FFF7ED",
};

function emailWrapper(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Broussard Legal Services</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Broussard Legal Services</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 32px;">${content}</td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              Questions? <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};text-decoration:none;">Contact us directly</a>
              &nbsp;·&nbsp;
              <a href="${PORTAL_URL}" style="color:${brand.accent};text-decoration:none;">View your portal</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function badge(label: string, bg: string, color = brand.white): string {
  return `<span style="display:inline-block;background-color:${bg};color:${color};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">${label}</span>`;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${text}</p>`;
}

function detailsTable(rows: string): string {
  return `<table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;margin:20px 0;background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:8px;overflow:hidden;"><tbody>${rows}</tbody></table>`;
}

function infoRow(label: string, value: string, valueColor = brand.foreground): string {
  return `<tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;width:42%;vertical-align:top;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${label}</td><td style="padding:10px 16px;color:${valueColor};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${value}</td></tr>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="background-color:${color};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.30);"><a href="${href}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">${label} &rarr;</a></td></tr></table>`;
}

function alertBox(content: string, bgColor: string, borderColor: string): string {
  return `<div style="background-color:${bgColor};border-left:4px solid ${borderColor};padding:18px 22px;border-radius:0 8px 8px 0;margin:22px 0;">${content}</div>`;
}

function signature(): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;"><tr><td><p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p><p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p><p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p><a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a></td></tr></table>`;
}

function fmtCurrency(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 0 }).format(amount);
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function subscriptionCreatedEmail(opts: {
  customerName: string;
  planName: string;
  amount: number;
  interval: string;
  currentPeriodEnd: string;
  subscriptionId: string;
}): { subject: string; html: string } {
  const firstName = opts.customerName.split(' ')[0];
  const intervalLabel = opts.interval === 'year' ? 'annually' : 'monthly';
  const content = `
    ${badge('Retainer Activated', brand.green)}
    <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Your Retainer Is Now Active</h2>
    ${bodyText(`Hi ${firstName}, your retainer agreement is confirmed and active. You will be billed ${intervalLabel} and your services will automatically renew each billing period.`)}
    ${detailsTable(`
      ${infoRow('Plan', opts.planName)}
      ${infoRow('Billing Amount', fmtCurrency(opts.amount), brand.accent)}
      ${infoRow('Billing Cycle', opts.interval === 'year' ? 'Annual' : 'Monthly')}
      ${infoRow('Next Renewal', fmtDate(opts.currentPeriodEnd), brand.green)}
      ${infoRow('Subscription ID', opts.subscriptionId.slice(-12).toUpperCase())}
    `)}
    ${alertBox(`<p style="margin:0;font-size:13px;color:${brand.green};font-weight:bold;font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">&#10003;&nbsp; Auto-Renewal Enabled</p><p style="margin:6px 0 0;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;">Your retainer will automatically renew on <strong>${fmtDate(opts.currentPeriodEnd)}</strong>. You will receive a reminder email 7 days before each renewal date.</p>`, brand.greenLight, brand.green)}
    ${ctaButton(PORTAL_URL, 'View Your Client Portal', brand.green)}
    ${bodyText('If you have any questions about your retainer or need to make changes, please contact us directly.')}
    ${signature()}
  `;
  return {
    subject: `Your Retainer Is Active — ${opts.planName}`,
    html: emailWrapper(content, `Your ${opts.planName} retainer is now active. Next renewal: ${fmtDate(opts.currentPeriodEnd)}.`),
  };
}

function renewalReminderEmail(opts: {
  customerName: string;
  planName: string;
  amount: number;
  interval: string;
  currentPeriodEnd: string;
  subscriptionId: string;
  daysUntilRenewal: number;
}): { subject: string; html: string } {
  const firstName = opts.customerName.split(' ')[0];
  const content = `
    ${badge('Renewal Reminder', brand.accent)}
    <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Your Retainer Renews in ${opts.daysUntilRenewal} Days</h2>
    ${bodyText(`Hi ${firstName}, this is a friendly reminder that your retainer agreement will automatically renew in <strong>${opts.daysUntilRenewal} days</strong> on <strong>${fmtDate(opts.currentPeriodEnd)}</strong>.`)}
    ${detailsTable(`
      ${infoRow('Plan', opts.planName)}
      ${infoRow('Renewal Amount', fmtCurrency(opts.amount), brand.accent)}
      ${infoRow('Renewal Date', fmtDate(opts.currentPeriodEnd), brand.orange)}
      ${infoRow('Billing Cycle', opts.interval === 'year' ? 'Annual' : 'Monthly')}
    `)}
    ${alertBox(`<p style="margin:0 0 6px;font-size:13px;color:${brand.orange};font-weight:bold;font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">&#9888;&nbsp; Upcoming Auto-Renewal</p><p style="margin:0;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;">Your payment method on file will be charged <strong>${fmtCurrency(opts.amount)}</strong> on <strong>${fmtDate(opts.currentPeriodEnd)}</strong>. If you wish to cancel or make changes, please contact us before the renewal date.</p>`, brand.orangeLight, brand.orange)}
    ${ctaButton(PORTAL_URL, 'Manage Your Retainer', brand.accent)}
    ${bodyText('If you have any questions or would like to discuss your retainer terms, please do not hesitate to reach out.')}
    ${signature()}
  `;
  return {
    subject: `Retainer Renewal in ${opts.daysUntilRenewal} Days — ${fmtDate(opts.currentPeriodEnd)}`,
    html: emailWrapper(content, `Your ${opts.planName} retainer renews in ${opts.daysUntilRenewal} days — ${fmtCurrency(opts.amount)} on ${fmtDate(opts.currentPeriodEnd)}.`),
  };
}

function renewalSuccessEmail(opts: {
  customerName: string;
  planName: string;
  amount: number;
  interval: string;
  nextPeriodEnd: string;
  subscriptionId: string;
}): { subject: string; html: string } {
  const firstName = opts.customerName.split(' ')[0];
  const content = `
    ${badge('Renewal Confirmed', brand.green)}
    <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Retainer Successfully Renewed</h2>
    ${bodyText(`Hi ${firstName}, your retainer has been successfully renewed. Your services continue uninterrupted and your next billing date is <strong>${fmtDate(opts.nextPeriodEnd)}</strong>.`)}
    ${detailsTable(`
      ${infoRow('Plan', opts.planName)}
      ${infoRow('Amount Charged', fmtCurrency(opts.amount), brand.green)}
      ${infoRow('Next Renewal', fmtDate(opts.nextPeriodEnd), brand.accent)}
    `)}
    ${alertBox(`<p style="margin:0;font-size:13px;color:${brand.green};font-weight:bold;font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">&#10003;&nbsp; Services Continue Uninterrupted</p><p style="margin:6px 0 0;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;">Thank you for your continued trust. Your retainer services are active through <strong>${fmtDate(opts.nextPeriodEnd)}</strong>.</p>`, brand.greenLight, brand.green)}
    ${ctaButton(PORTAL_URL, 'View Your Portal', brand.green)}
    ${signature()}
  `;
  return {
    subject: `Retainer Renewed — ${opts.planName}`,
    html: emailWrapper(content, `Your ${opts.planName} retainer has been renewed. Next billing: ${fmtDate(opts.nextPeriodEnd)}.`),
  };
}

function cancellationEmail(opts: {
  customerName: string;
  planName: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
}): { subject: string; html: string } {
  const firstName = opts.customerName.split(' ')[0];
  const content = `
    ${badge('Subscription Update', brand.muted, brand.white)}
    <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Retainer Cancellation Confirmed</h2>
    ${opts.cancelAtPeriodEnd
      ? bodyText(`Hi ${firstName}, your retainer cancellation has been scheduled. Your services will remain active until <strong>${fmtDate(opts.currentPeriodEnd)}</strong>, after which your subscription will not renew.`)
      : bodyText(`Hi ${firstName}, your retainer has been cancelled immediately. We are sorry to see you go and hope to work with you again in the future.`)
    }
    ${detailsTable(`
      ${infoRow('Plan', opts.planName)}
      ${opts.cancelAtPeriodEnd ? infoRow('Active Until', fmtDate(opts.currentPeriodEnd), brand.orange) : infoRow('Cancelled', 'Immediately', brand.red)}
    `)}
    ${bodyText('If you have any questions or would like to discuss reinstating your retainer, please contact us directly.')}
    ${ctaButton(`mailto:maggimaybroussard@gmail.com`, 'Contact Us', brand.accent)}
    ${signature()}
  `;
  return {
    subject: `Retainer Cancellation — ${opts.planName}`,
    html: emailWrapper(content, `Your ${opts.planName} retainer cancellation has been processed.`),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const body = await req.json();
    const { emailType, customerName, customerEmail, planName, amount, interval, currentPeriodEnd, nextPeriodEnd, subscriptionId, daysUntilRenewal, cancelAtPeriodEnd } = body;

    if (!customerEmail || !emailType) {
      return new Response(JSON.stringify({ error: 'Missing customerEmail or emailType' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let emailContent: { subject: string; html: string };

    switch (emailType) {
      case 'subscription_created':
        emailContent = subscriptionCreatedEmail({ customerName, planName, amount, interval, currentPeriodEnd, subscriptionId });
        break;
      case 'renewal_reminder':
        emailContent = renewalReminderEmail({ customerName, planName, amount, interval, currentPeriodEnd, subscriptionId, daysUntilRenewal: daysUntilRenewal ?? 7 });
        break;
      case 'renewal_success':
        emailContent = renewalSuccessEmail({ customerName, planName, amount, interval, nextPeriodEnd: nextPeriodEnd ?? currentPeriodEnd, subscriptionId });
        break;
      case 'cancellation':
        emailContent = cancellationEmail({ customerName, planName, cancelAtPeriodEnd: cancelAtPeriodEnd ?? true, currentPeriodEnd });
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown emailType: ${emailType}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    const resendApiKey = (globalThis as Record<string, unknown>).Deno
      ? (globalThis as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno.env.get('RESEND_API_KEY')
      : undefined;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Maggi May Broussard <maggimay@broussardlegalservices.com>',
        to: [customerEmail],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.message ?? `Resend API error: ${response.status}`);
    }

    const resendData = await response.json();

    return new Response(JSON.stringify({ success: true, emailId: resendData.id, emailType }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
