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
      reminderId,
      recipientEmail,
      recipientName,
      eventName,
      startTime,
      meetingLocation,
      reminderType, // '24hr' | '1hr'
      recipientPhone: recipientPhoneFromBody,
    } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve phone: prefer body param, fall back to stored value in appointment_reminders row
    let resolvedPhone: string | null = recipientPhoneFromBody ?? null;
    if (!resolvedPhone && reminderId) {
      const { data: reminderRow } = await supabase
        .from("appointment_reminders")
        .select("recipient_phone")
        .eq("id", reminderId)
        .single();
      resolvedPhone = reminderRow?.recipient_phone ?? null;
    }

    const eventDate = startTime
      ? new Date(startTime).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "America/Chicago",
        })
      : "Your scheduled date";

    const eventTime = startTime
      ? new Date(startTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
          timeZone: "America/Chicago",
        })
      : "";

    const is24hr = reminderType === "24hr";
    const urgencyLabel = is24hr ? "Tomorrow" : "In 1 Hour";
    const urgencyColor = is24hr ? brand.accent : brand.green;
    const subject = is24hr
      ? `Reminder: Your Consultation is Tomorrow — ${eventDate}`
      : `Your Consultation Starts in 1 Hour — ${eventTime}`;

    const previewText = is24hr
      ? `Don't forget — your paralegal consultation with Broussard Legal Services is tomorrow at ${eventTime}.`
      : `Your consultation with Broussard Legal Services starts in about 1 hour. Here's everything you need.`;

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
<body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

        <!-- BRANDED HEADER -->
        <tr>
          <td style="background-color:${brand.primary}; padding: 0;">
            <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right: 2px solid ${brand.accent}; padding-right: 14px; vertical-align: middle;">
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Paralegal</p>
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left: 14px; vertical-align: middle;">
                        <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Broussard Legal Services</h1>
                        <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family: Georgia, serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- URGENCY BADGE + TITLE -->
        <tr>
          <td style="padding: 32px 36px 0;">
            <span style="display:inline-block; background-color:${urgencyColor}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#9200;&nbsp; ${urgencyLabel}</span>
            <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">
              ${is24hr ? "Your Consultation is Tomorrow" : "Your Consultation Starts Soon"}
            </h2>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding: 0 36px 32px;">
            <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">Dear ${recipientName},</p>
            <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
              ${is24hr
                ? "This is a friendly reminder that your consultation with Broussard Legal Services is scheduled for <strong>tomorrow</strong>. I look forward to speaking with you!"
                : "Your consultation with Broussard Legal Services is starting in approximately <strong>1 hour</strong>. Please make sure you're ready to connect at the scheduled time."}
            </p>

            <!-- Appointment Details Card -->
            <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
              <div style="background-color:${brand.primary}; padding:12px 22px;">
                <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">&#128197;&nbsp; Appointment Details</p>
              </div>
              <div style="padding:20px 22px;">
                <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
                  <tr>
                    <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:40%; border-bottom:1px solid rgba(217,208,197,0.5);">Consultation</td>
                    <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${eventName ?? "Paralegal Consultation"}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Date</td>
                    <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${eventDate}</td>
                  </tr>
                  ${eventTime ? `
                  <tr>
                    <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Time</td>
                    <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${eventTime}</td>
                  </tr>` : ""}
                  ${meetingLocation ? `
                  <tr>
                    <td style="padding:8px 0; color:${brand.muted}; font-size:13px;">Location / Link</td>
                    <td style="padding:8px 0; color:${brand.foreground}; font-size:14px;">${meetingLocation}</td>
                  </tr>` : ""}
                </table>
              </div>
            </div>

            ${is24hr ? `
            <!-- Prep tips for 24hr reminder -->
            <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
              <p style="margin:0 0 10px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">To make the most of our time</p>
              <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#8594;&nbsp; Prepare a brief summary of your legal support needs</p>
              <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#8594;&nbsp; Note any deadlines or time-sensitive matters</p>
              <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#8594;&nbsp; Have any relevant documents or case details ready to reference</p>
            </div>` : `
            <!-- Quick checklist for 1hr reminder -->
            <div style="background-color:${brand.greenLight}; border-left:3px solid ${brand.green}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
              <p style="margin:0 0 10px; font-size:12px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Quick checklist before we connect</p>
              <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#10003;&nbsp; Check your meeting link or phone connection</p>
              <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#10003;&nbsp; Find a quiet space with good reception</p>
              <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">&#10003;&nbsp; Have your notes and any documents nearby</p>
            </div>`}

            <p style="margin:0 0 20px; font-size:14px; color:${brand.muted}; line-height:1.8; font-family: Georgia, serif;">
              Need to reschedule? Please use the link in your original Calendly confirmation email as soon as possible.
            </p>

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">See you ${is24hr ? "tomorrow" : "soon"},</p>
                  <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Broussard Legal Services</p>
                  <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Broussard Legal Services</p>
                  <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
            <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
              You are receiving this reminder because you have a scheduled consultation. If you did not book this appointment, please reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [recipientEmail],
        subject,
        html: bodyHtml,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json();
      throw new Error(errBody.message || "Resend API error");
    }

    const data = await res.json();

    // ── SMS via Twilio (non-blocking, best-effort) ──────────────────────────
    if (resolvedPhone) {
      const TWILIO_ACCOUNT_SID = (globalThis as any)?.Deno?.env?.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = (globalThis as any)?.Deno?.env?.get("TWILIO_AUTH_TOKEN");
      const TWILIO_PHONE_NUMBER = (globalThis as any)?.Deno?.env?.get("TWILIO_PHONE_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        let smsSid: string | null = null;
        try {
          const firstName = recipientName?.split(" ")[0] ?? recipientName;
          const consultation = eventName ?? "Paralegal Consultation";
          const msgBody = is24hr
            ? `Broussard Legal Services\n\nHi ${firstName}, reminder: your ${consultation} is TOMORROW at ${eventTime} (${eventDate}).\n\nNeed to reschedule? Use your Calendly confirmation link.`
            : `Broussard Legal Services\n\nHi ${firstName}, your ${consultation} starts in 1 HOUR at ${eventTime}. Please make sure you're ready to connect.`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
          const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

          // Send via WhatsApp (primary) with SMS fallback
          const waFormData = new URLSearchParams({
            To: `whatsapp:${resolvedPhone}`,
            From: `whatsapp:${TWILIO_PHONE_NUMBER}`,
            Body: msgBody,
          });
          const waRes = await fetch(twilioUrl, {
            method: "POST",
            headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: waFormData.toString(),
          });
          const waData = await waRes.json();

          let finalStatus = waRes.ok ? "sent" : "failed";
          let finalError: string | null = waRes.ok ? null : (waData?.message ?? "WhatsApp send error");
          smsSid = waData?.sid ?? null;

          // SMS fallback if WhatsApp fails
          if (!waRes.ok) {
            const smsFallbackBody = msgBody + "\n\nReply STOP to opt out.";
            const smsFormData = new URLSearchParams({ To: resolvedPhone, From: TWILIO_PHONE_NUMBER, Body: smsFallbackBody });
            const smsRes = await fetch(twilioUrl, {
              method: "POST",
              headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: smsFormData.toString(),
            });
            const smsData = await smsRes.json();
            finalStatus = smsRes.ok ? "sent" : "failed";
            finalError = smsRes.ok ? null : (smsData?.message ?? "SMS fallback error");
            smsSid = smsData?.sid ?? null;
          }

          // Log to sms_reminder_logs
          await supabase.from("sms_reminder_logs").insert({
            recipient_name: recipientName ?? "Client",
            recipient_phone: resolvedPhone,
            recipient_type: "client",
            message_type: "appointment_reminder",
            message_body: msgBody,
            status: finalStatus,
            error: finalError,
            trigger_type: "calendly_booking",
          }).catch(() => {});

          // Mark SMS as sent on the reminder row
          if (reminderId && finalStatus === "sent") {
            await supabase
              .from("appointment_reminders")
              .update({ sms_sent: true, sms_sid: smsSid })
              .eq("id", reminderId);
          }
        } catch (smsErr) {
          console.error("[send-appointment-reminder] WhatsApp/SMS send failed (non-blocking):", smsErr);
        }
      }
    }

    // Mark reminder as sent
    if (reminderId) {
      await supabase
        .from("appointment_reminders")
        .update({ send_status: "sent", sent_at: new Date().toISOString() })
        .eq("id", reminderId);
    }

    return new Response(JSON.stringify({ success: true, emailId: data.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    // Mark reminder as failed if we have the ID
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.reminderId) {
        const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("appointment_reminders")
            .update({ send_status: "failed", error_message: error.message })
            .eq("id", body.reminderId);
        }
      }
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
