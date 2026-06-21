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
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[Twilio] API error:", data);
      return { success: false, error: data?.message ?? "Twilio API error" };
    }
    console.log("[Twilio] SMS sent:", data.sid);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error("[Twilio] sendSMS error:", err.message);
    return { success: false, error: err.message };
  }
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
      bookingTime,
      durationMinutes,
      meetingLink,
    } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");
    if (!clientEmail || !bookingDate || !bookingTime) {
      return new Response(
        JSON.stringify({ error: "clientEmail, bookingDate, and bookingTime are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [y, m, d] = bookingDate.split("-").map(Number);
    const formattedDate = new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const [h, min] = bookingTime.split(":").map(Number);
    const timeDate = new Date();
    timeDate.setHours(h, min, 0, 0);
    const formattedTime =
      timeDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " CST";

    const duration = durationMinutes ?? 30;
    const firstName = (clientName ?? "there").split(" ")[0];
    const meetUrl = meetingLink || `${SITE_URL}/book-consultation`;

    // ─── Send Twilio SMS (24hr reminder with date, time, and Google Meet link) ──
    let smsResult: { success: boolean; sid?: string; error?: string } = { success: false };
    if (clientPhone) {
      const smsBody =
        `Maggi May Broussard Legal Services\n\n` +
        `Hi ${firstName}, reminder: your consultation is TOMORROW — ${formattedDate} at ${formattedTime} (${duration} min).\n\n` +
        `Join via Google Meet: ${meetUrl}\n\n` +
        `Questions? Reply or visit ${SITE_URL}\n\nReply STOP to opt out.`;
      smsResult = await sendTwilioSMS(clientPhone, smsBody);
    }

    // ─── Send Email via Resend ────────────────────────────────────────────────
    const subject = `Reminder: Your Consultation is Tomorrow — ${formattedDate}`;
    const previewText = `Don't forget — your ${duration}-minute consultation with Maggi May Broussard is tomorrow at ${formattedTime}.`;

    const bodyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <tr><td style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></td></tr>

        <tr>
          <td style="background-color:${brand.primary};padding:28px 36px 24px;">
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

        <tr>
          <td style="padding:32px 36px 0;">
            <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9200;&nbsp; Tomorrow</span>
            <h2 style="margin:0 0 8px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;">Your Consultation is Tomorrow, ${firstName}.</h2>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">This is your 24-hour reminder. Here are your booking details and everything you need to be prepared.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.accentLight};border-radius:10px;border:1px solid ${brand.border};overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding-bottom:14px;border-bottom:1px solid ${brand.border};">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Date</p>
                        <p style="margin:0;font-size:16px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${formattedDate}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 0;border-bottom:1px solid ${brand.border};">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Time</p>
                        <p style="margin:0;font-size:16px;color:${brand.foreground};font-family:Georgia,serif;font-weight:bold;">${formattedTime} &nbsp;&middot;&nbsp; ${duration} minutes</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top:14px;">
                        <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.1em;">Google Meet Link</p>
                        <a href="${meetUrl}" style="font-size:15px;color:${brand.accent};font-family:Georgia,serif;text-decoration:none;font-weight:bold;">${meetUrl}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px 28px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                  <a href="${meetUrl}" style="display:inline-block;padding:13px 28px;color:${brand.white};text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Join Meeting Tomorrow &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.accentLight};border-left:3px solid ${brand.accent};padding:20px 22px;border-radius:0 8px 8px 0;">
              <p style="margin:0 0 12px;font-size:12px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">How to Prepare for Tomorrow</p>
              <p style="margin:0 0 10px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; Prepare a brief summary of your legal support needs or current matter</p>
              <p style="margin:0 0 10px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; Note any deadlines, court dates, or time-sensitive matters</p>
              <p style="margin:0 0 10px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; Have any relevant documents, contracts, or correspondence ready to reference</p>
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; Write down your questions and goals for the consultation</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px 28px;">
            <div style="background-color:${brand.greenLight};border-left:3px solid ${brand.green};padding:18px 22px;border-radius:0 8px 8px 0;">
              <p style="margin:0 0 10px;font-size:12px;color:${brand.green};font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">Day-of Checklist</p>
              <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#10003;&nbsp; Test your Google Meet link before the session</p>
              <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#10003;&nbsp; Find a quiet space with a stable internet connection</p>
              <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#10003;&nbsp; Have your notes and documents nearby and ready to share</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px 28px;">
            <p style="margin:0;font-size:14px;color:${brand.muted};line-height:1.8;font-family:Georgia,serif;">
              Need to reschedule or cancel? Please <a href="${SITE_URL}/book-consultation" style="color:${brand.accent};text-decoration:none;">visit the booking page</a> or reply to your original confirmation email as soon as possible so we can offer the slot to another client.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 36px 32px;">
            <table cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">See you tomorrow,</p>
                  <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
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
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You are receiving this reminder because you have a scheduled consultation. If you did not book this appointment, please reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [clientEmail],
        subject,
        html: bodyHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      throw new Error((errBody as any).message || `Resend error ${resendRes.status}`);
    }

    const resendData = await resendRes.json();

    // Log the sent reminder (email + SMS status)
    if (bookingId) {
      await supabase
        .from("consultation_reminder_logs")
        .insert({
          booking_id: bookingId,
          reminder_type: "24hr",
          recipient_email: clientEmail,
          recipient_name: clientName ?? "there",
          recipient_phone: clientPhone ?? null,
          sent_at: new Date().toISOString(),
          resend_id: resendData.id ?? null,
          sms_sent: smsResult.success,
          sms_sid: smsResult.sid ?? null,
          send_status: "sent",
        })
        .then(() => {});

      await supabase
        .from("consultation_bookings")
        .update({
          reminder_24hr_sent: true,
          reminder_24hr_sent_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .then(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendData.id,
        smsSent: smsResult.success,
        smsSid: smsResult.sid ?? null,
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
