import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";

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

// ─── Twilio SMS Helper ────────────────────────────────────────────────────────
async function sendTwilioSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const TWILIO_ACCOUNT_SID = (globalThis as any)?.Deno?.env?.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = (globalThis as any)?.Deno?.env?.get("TWILIO_AUTH_TOKEN");
  const TWILIO_PHONE_NUMBER = (globalThis as any)?.Deno?.env?.get("TWILIO_PHONE_NUMBER");

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("[Twilio] Missing credentials — SMS skipped");
    return { success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const formData = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.message ?? "Twilio API error" };
    return { success: true, sid: data.sid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Email Helper (Resend) ────────────────────────────────────────────────────
async function sendResendEmail(opts: { to: string; subject: string; html: string; from?: string }): Promise<{ success: boolean; error?: string }> {
  const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not set" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: opts.from ?? "Broussard Legal Services <noreply@broussardlegalservices.com>",
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data?.message ?? "Resend error" };
  return { success: true };
}

function buildFollowUpEmail(firstName: string, service: string, bookingDate: string): string {
  const portalLink = `${SITE_URL}/portal/dashboard`;
  const bookLink = `${SITE_URL}/availability`;
  const reviewLink = `${SITE_URL}/portal/dashboard`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Following up on your consultation — we'd love your feedback and to share your next steps.</div>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        
        <tr><td style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></td></tr>
        
        <tr>
          <td style="background-color:${brand.primary};padding:28px 36px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                  <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;">Paralegal</p>
                  <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;">Services</p>
                </td>
                <td style="padding-left:14px;vertical-align:middle;">
                  <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,serif;font-weight:normal;">Broussard Legal Services</h1>
                  <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;">Louisiana &amp; Nationwide</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 36px 0;">
            <span style="display:inline-block;background-color:${brand.green};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#128172;&nbsp; 48-Hour Follow-Up</span>
            <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">How did your consultation go, ${firstName}?</h2>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              It's been 48 hours since your <strong>${service}</strong> consultation on ${bookingDate}. I wanted to personally follow up to see how things are going and make sure you have everything you need to move forward.
            </p>

            <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:24px 28px;margin:0 0 28px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.04em;text-transform:uppercase;">Your Next Steps</p>
              ${[
                ["Review Your Portal", "Log in to access your case documents, invoices, and messages", portalLink, "Access Portal →"],
                ["Share Your Feedback", "Your experience helps us serve you better — takes 2 minutes", reviewLink, "Leave Feedback →"],
                ["Book a Follow-Up", "Ready to move forward? Schedule your next consultation", bookLink, "Book Now →"],
              ].map(([title, desc, link, cta]) => `
              <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin-bottom:14px;">
                <tr>
                  <td style="padding:12px 16px;background-color:${brand.white};border-radius:8px;border:1px solid ${brand.border};">
                    <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;">${title}</p>
                          <p style="margin:0;font-size:13px;color:${brand.muted};font-family:Georgia,serif;">${desc}</p>
                        </td>
                        <td style="text-align:right;white-space:nowrap;padding-left:12px;">
                          <a href="${link}" style="font-size:12px;color:${brand.accent};text-decoration:none;font-family:Georgia,serif;font-weight:bold;">${cta}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`).join("")}
            </div>

            <p style="margin:0 0 24px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              If you have any questions or need clarification on anything we discussed, please don't hesitate to reach out. I'm here to help you navigate your legal matter with confidence.
            </p>

            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
              <tr>
                <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
                  <a href="${portalLink}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Access Your Client Portal &rarr;</a>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p>
                  <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
                  <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">broussardlegalservices.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You are receiving this email because you completed a consultation with Broussard Legal Services.
              If you prefer not to receive follow-up emails, simply reply to this message.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const {
      bookingId,
      clientEmail,
      clientName,
      clientPhone,
      bookingDate,
      service,
    } = await req.json();

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");
    if (!clientEmail || !bookingDate) {
      return new Response(
        JSON.stringify({ error: "clientEmail and bookingDate are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [y, m, d] = bookingDate.split("-").map(Number);
    const formattedDate = new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const firstName = (clientName ?? "there").split(" ")[0];
    const serviceName = service ?? "Paralegal Consultation";

    // ─── Send SMS follow-up ───────────────────────────────────────────────────
    let smsResult: { success: boolean; sid?: string; error?: string } = { success: false };
    if (clientPhone) {
      const smsBody =
        `Maggi May Broussard Legal Services\n\n` +
        `Hi ${firstName}, it's been 48 hours since your consultation on ${formattedDate}.\n\n` +
        `We'd love your feedback and want to make sure you have your next steps.\n\n` +
        `Access your portal: ${SITE_URL}/portal/dashboard\n\n` +
        `Ready to move forward? Book your next session: ${SITE_URL}/availability\n\n` +
        `Reply STOP to opt out.`;
      smsResult = await sendTwilioSMS(clientPhone, smsBody);
    }

    // ─── Send email follow-up ─────────────────────────────────────────────────
    const emailHtml = buildFollowUpEmail(firstName, serviceName, formattedDate);
    const emailResult = await sendResendEmail({
      to: clientEmail,
      subject: `Following up on your ${serviceName} consultation — ${formattedDate}`,
      html: emailHtml,
    });

    // ─── Update reminder log status ───────────────────────────────────────────
    if (bookingId) {
      await supabase
        .from("consultation_reminder_logs")
        .update({
          send_status: emailResult.success ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          sms_status: smsResult.success ? "sent" : (clientPhone ? "failed" : "skipped"),
        })
        .eq("booking_id", bookingId)
        .eq("reminder_type", "48hr_followup");
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: emailResult,
        sms: smsResult,
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
