import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE_URL = "https://broussardlegalservices.com";

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
              You received this because you have a pending consultation intake.
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

function signature(): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;"><tr><td><p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p><p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p><p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p><a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>&nbsp;<span style="color:${brand.border};">|</span>&nbsp;<a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimay.com</a></td></tr></table>`;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

function buildIntakeReminderEmail(
  name: string,
  caseType: string,
  reminderCount: number,
  intakeUrl: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];
  const isUrgent = reminderCount >= 2;

  const urgencyBadge = isUrgent
    ? badge("Action Required", "#DC2626")
    : badge("Friendly Reminder", brand.accent);

  const content = `
    ${urgencyBadge}
    ${sectionTitle(isUrgent
      ? `${firstName}, your intake form is still pending`
      : `Just a reminder, ${firstName} — your intake form is waiting`
    )}
    ${bodyText(`I noticed your intake questionnaire for your <strong>${caseType}</strong> matter hasn't been completed yet. To move forward with your case, I'll need this information before we can proceed.`)}
    ${highlightBox(`
      <p style="margin:0 0 10px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Why This Matters</p>
      <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;">&#10003;&nbsp; Your answers help me prepare a targeted strategy for your case</p>
      <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;">&#10003;&nbsp; It takes only 5–10 minutes to complete</p>
      <p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;">&#10003;&nbsp; Without it, I cannot open your matter file or begin work</p>
    `)}
    ${ctaButton(intakeUrl, "Complete Your Intake Form Now", brand.green)}
    ${bodyText(`If you have any questions or need help with the form, simply reply to this email and I'll assist you personally.`)}
    ${isUrgent ? bodyText(`<strong>Please note:</strong> If I don't hear from you within the next 48 hours, I may need to release your consultation slot to another client.`) : ""}
    ${signature()}
  `;

  const subjects = [
    `Action needed: Complete your ${caseType} intake form, ${firstName}`,
    `Reminder: Your ${caseType} intake form is still pending, ${firstName}`,
    `Final reminder: ${caseType} intake form required, ${firstName}`,
  ];

  return {
    subject: subjects[Math.min(reminderCount, subjects.length - 1)],
    html: emailWrapper(content, `Your intake form for your ${caseType} matter is still pending.`),
  };
}

// ─── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Maggi May Broussard <noreply@broussardlegalservices.com>",
      to: [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { schedule_id, booking_id, client_name, client_email, case_type, reminder_count = 0 } = body;

    if (!client_email || !client_name) {
      return new Response(
        JSON.stringify({ error: "client_email and client_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const intakeUrl = `${SITE_URL}/intake`;
    const { subject, html } = buildIntakeReminderEmail(
      client_name,
      case_type || "legal",
      reminder_count,
      intakeUrl
    );

    const sent = await sendEmail(client_email, subject, html);

    if (sent && schedule_id) {
      const newCount = reminder_count + 1;
      await supabase
        .from("intake_reminder_schedules")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          reminder_count: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", schedule_id);

      // If booking_id provided, update intake_sent_at on consultation_bookings
      if (booking_id) {
        await supabase
          .from("consultation_bookings")
          .update({
            intake_form_status: "sent",
            intake_sent_at: new Date().toISOString(),
          })
          .eq("id", booking_id)
          .eq("intake_form_status", "pending");
      }
    }

    return new Response(
      JSON.stringify({ success: sent, message: sent ? "Reminder sent" : "Failed to send" }),
      { status: sent ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
