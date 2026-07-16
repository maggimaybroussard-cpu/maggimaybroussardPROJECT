import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE_URL = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://broussardlegalservices.com";
const PORTAL_URL = `${SITE_URL}/portal/login`;

// ─── Brand Styles ─────────────────────────────────────────────────────────────
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
};

// ─── Email Layout Helpers ─────────────────────────────────────────────────────

function emailWrapper(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maggi May Broussard Legal Services</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Maggi May Broussard</h1>
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
          <td style="padding:36px 36px 32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You received this because your matter has been opened with our office.
              <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">Visit our site</a>
              &nbsp;·&nbsp;
              <a href="mailto:maggimaybroussard@gmail.com?subject=Unsubscribe" style="color:${brand.muted};text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function badge(label: string, color = brand.accent): string {
  return `<span style="display:inline-block;background-color:${color};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">${label}</span>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">${text}</h2>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;"><tr><td style="background-color:${color};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.30);"><a href="${href}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">${label} &rarr;</a></td></tr></table>`;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${text}</p>`;
}

function highlightBox(content: string): string {
  return `<div style="background-color:${brand.accentLight};border-left:3px solid ${brand.accent};padding:18px 22px;border-radius:0 8px 8px 0;margin:22px 0;">${content}</div>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${brand.border};font-size:13px;color:${brand.muted};font-family:Georgia,serif;width:40%;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${brand.border};font-size:13px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;vertical-align:top;">${value}</td>
  </tr>`;
}

function nextStepRow(num: string, title: string, desc: string): string {
  return `<tr>
    <td style="padding:14px 0;border-bottom:1px solid ${brand.border};vertical-align:top;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr>
          <td style="width:36px;vertical-align:top;padding-top:2px;">
            <div style="width:28px;height:28px;background-color:${brand.accent};border-radius:50%;text-align:center;line-height:28px;font-size:13px;color:${brand.white};font-family:Georgia,serif;font-weight:bold;">${num}</div>
          </td>
          <td style="padding-left:12px;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${title}</p>
            <p style="margin:0;font-size:13px;color:${brand.muted};font-family:Georgia,serif;line-height:1.6;">${desc}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function signature(): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;"><tr><td><p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p><p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p><p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p><a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>&nbsp;<span style="color:${brand.border};">|</span>&nbsp;<a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimay.com</a></td></tr></table>`;
}

// ─── Welcome Email Template ───────────────────────────────────────────────────

function buildMatterWelcomeEmail(params: {
  clientName: string;
  matterName: string;
  caseType: string;
  matterStatus: string;
  generatedAt: string;
  retainerAmount: number | null;
  portalUrl: string;
}): { subject: string; html: string } {
  const { clientName, matterName, caseType, matterStatus, generatedAt, retainerAmount, portalUrl } = params;
  const firstName = clientName.split(" ")[0];

  const formattedDate = new Date(generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });

  const retainerDisplay = retainerAmount
    ? `$${Number(retainerAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : "To be determined — we will discuss during our next meeting";

  const content = `
    ${badge("Your Matter Has Been Opened", brand.green)}
    ${sectionTitle(`Welcome, ${firstName} — your matter is now active`)}
    ${bodyText(`I'm pleased to confirm that your matter file has been officially opened. Your intake has been reviewed and I'm ready to begin working on your case. Below you'll find your matter details and everything you need to get started.`)}

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;padding:24px;margin:24px 0;">
      <p style="margin:0 0 16px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">Matter Details</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${detailRow("Matter Name", matterName)}
        ${detailRow("Case Type", caseType)}
        ${detailRow("Status", matterStatus.charAt(0).toUpperCase() + matterStatus.slice(1))}
        ${detailRow("Opened On", formattedDate)}
        ${detailRow("Retainer", retainerDisplay)}
      </table>
    </div>

    ${highlightBox(`
      <p style="margin:0 0 10px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Your Client Portal</p>
      <p style="margin:0 0 10px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.7;">Access your secure client portal to view case updates, upload documents, send messages, and manage invoices — all in one place.</p>
      <a href="${portalUrl}" style="color:${brand.accent};font-size:14px;font-family:Georgia,serif;font-weight:bold;text-decoration:underline;">${portalUrl}</a>
    `)}

    ${ctaButton(portalUrl, "Access Your Client Portal", brand.green)}

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;padding:24px;margin:24px 0;">
      <p style="margin:0 0 16px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">Your Next Steps</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        ${nextStepRow("1", "Log in to your portal", "Use the link above to access your secure client portal. If you haven't registered yet, click \"Register\" on the login page.")}
        ${nextStepRow("2", "Review your matter details", "Confirm your case information is accurate and upload any supporting documents relevant to your matter.")}
        ${nextStepRow("3", "Complete your retainer agreement", "Once your retainer is confirmed, I'll begin active work on your case immediately.")}
        ${nextStepRow("4", "Stay in touch", "Use the portal messaging system to send questions or updates at any time — I typically respond within one business day.")}
      </table>
    </div>

    ${bodyText(`If you have any questions or need assistance accessing your portal, please don't hesitate to reply to this email or reach out directly. I'm here to make this process as smooth as possible for you.`)}
    ${signature()}
  `;

  return {
    subject: `Your matter is now open, ${firstName} — welcome to Maggi May Broussard Legal Services`,
    html: emailWrapper(
      content,
      `Your ${caseType} matter has been opened. Log in to your client portal to get started.`
    ),
  };
}

// ─── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Maggi May Broussard <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: body };
  }
  return { ok: true };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const {
      client_name,
      client_email,
      matter_name,
      case_type,
      matter_status = "open",
      retainer_amount = null,
      generated_at,
    } = body;

    if (!client_email || !client_name || !matter_name) {
      return new Response(
        JSON.stringify({ error: "client_email, client_name, and matter_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = buildMatterWelcomeEmail({
      clientName: client_name,
      matterName: matter_name,
      caseType: case_type || "Legal Matter",
      matterStatus: matter_status,
      generatedAt: generated_at || new Date().toISOString(),
      retainerAmount: retainer_amount,
      portalUrl: PORTAL_URL,
    });

    const result = await sendEmail(client_email, subject, html);

    return new Response(
      JSON.stringify({
        success: result.ok,
        message: result.ok ? "Welcome email sent successfully" : "Failed to send welcome email",
        ...(result.error ? { error: result.error } : {}),
      }),
      {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
