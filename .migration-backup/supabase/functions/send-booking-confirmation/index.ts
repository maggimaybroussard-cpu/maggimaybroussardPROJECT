import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

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
    const { clientEmail, clientName, eventName, startTime, timezone, meetingLocation } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const eventDate = startTime
      ? new Date(startTime).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: timezone ?? "America/Chicago",
        })
      : "To be confirmed";

    const eventTime = startTime
      ? new Date(startTime).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
          timeZone: timezone ?? "America/Chicago",
        })
      : "";

    const subject = `Consultation Confirmed — ${eventDate}`;

    const bodyHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="x-apple-disable-message-reformatting">
        <title>Consultation Confirmed — Maggi May Broussard</title>
        <!--[if !mso]><!-->
        <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
          Your consultation on ${eventDate} is confirmed. See you then!
        </div>
        <!--<![endif]-->
      </head>
      <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

              <!-- ══ BRANDED HEADER ══ -->
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
                              <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Maggi May Broussard</h1>
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

              <!-- ══ BADGE + TITLE ══ -->
              <tr>
                <td style="padding: 32px 36px 0;">
                  <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#10003;&nbsp; Booking Confirmed</span>
                  <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Your Consultation is Scheduled</h2>
                </td>
              </tr>

              <!-- ══ BODY ══ -->
              <tr>
                <td style="padding: 0 36px 32px;">
                  <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">Dear ${clientName},</p>
                  <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
                    Thank you for booking a consultation with Maggi May Broussard Legal Services. Your appointment is confirmed and I look forward to speaking with you.
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
                          <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${eventName ?? "30-Minute Consultation"}</td>
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
                          <td style="padding:8px 0; color:${brand.muted}; font-size:13px;">Location</td>
                          <td style="padding:8px 0; color:${brand.foreground}; font-size:14px;">${meetingLocation}</td>
                        </tr>` : ""}
                      </table>
                    </div>
                  </div>

                  <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
                    A calendar invite has been sent to your email. If you need to reschedule or cancel, please use the link in your Calendly confirmation email.
                  </p>

                  <!-- Preparation Tips -->
                  <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
                    <p style="margin:0 0 10px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">To make the most of our time</p>
                    <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
                      &#8594;&nbsp; Prepare a brief summary of your legal support needs
                    </p>
                    <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
                      &#8594;&nbsp; Note any deadlines or time-sensitive matters
                    </p>
                    <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
                      &#8594;&nbsp; <a href="${SITE_URL}/services" style="color:${brand.accent}; text-decoration:none;">Review my services</a> to identify areas where I can help most
                    </p>
                  </div>

                  <!-- Payment CTA Box -->
                  <div style="background-color:${brand.greenLight}; border:1px solid rgba(53,94,59,0.20); border-radius:10px; padding:22px 24px; margin:0 0 28px;">
                    <p style="margin:0 0 6px; font-size:11px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; color:${brand.green}; font-family: Georgia, serif;">Optional — Secure Your Slot</p>
                    <p style="margin:0 0 16px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
                      Pay a <strong>$150 consultation deposit</strong> to formally hold your appointment, or set up a <strong>$1,500/month retainer</strong> for ongoing legal support. Both amounts are applied toward your first invoice.
                    </p>
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background-color:${brand.green}; border-radius:7px; box-shadow: 0 2px 8px rgba(53,94,59,0.25);">
                          <a href="${SITE_URL}/availability" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">Pay Deposit or Set Up Retainer &rarr;</a>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Primary CTA -->
                  <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                    <tr>
                      <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
                        <a href="${SITE_URL}/services" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">Explore My Services &rarr;</a>
                      </td>
                    </tr>
                  </table>

                  <!-- Signature -->
                  <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
                    <tr>
                      <td>
                        <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">Warm regards,</p>
                        <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
                        <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                        <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
                        &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                        <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ══ FOOTER ══ -->
              <tr>
                <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td>
                        <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
                        <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
                          You are receiving this email because you booked a consultation via Calendly. If this was a mistake, please reply to this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [clientEmail],
        subject,
        html: bodyHtml,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json();
      throw new Error(errBody.message || "Resend API error");
    }

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
