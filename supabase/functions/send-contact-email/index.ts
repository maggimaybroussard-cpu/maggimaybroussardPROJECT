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
};

serve(async (req) => {
  if (req?.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { name, firm, email, service, message } = await req?.json();

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");

    let inquiryId: string | null = null;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: inserted } = await supabase.from("contact_inquiries").insert({
        name,
        firm,
        email,
        service,
        message,
        status: "new",
      }).select("id").single();

      if (inserted?.id) {
        inquiryId = inserted.id;
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/schedule-nurture-sequence`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              inquiryId,
              recipientEmail: email,
              recipientName: name,
              service,
            }),
          });
        } catch {
          // Non-blocking
        }
      }
    }

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    // ── Shared header block ──
    const headerHtml = `
      <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px; background-color:${brand.primary};">
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
      <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px; background-color:${brand.primary};"></div>
      <div style="height:20px; background-color:${brand.primary};"></div>
    `;

    // ── 1. Internal notification to Maggi ──
    const internalRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: ["maggimaybroussard@gmail.com"],
        reply_to: email,
        subject: `&#128276; New Inquiry — ${name} · ${service}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin:0; padding:0; background-color:#EDE8E0; font-family:Georgia,serif;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding:40px 16px;">
              <tr><td align="center">
                <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">
                  <tr><td style="background-color:${brand.primary}; padding:0;">${headerHtml}</td></tr>
                  <tr>
                    <td style="padding:32px 36px 0;">
                      <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">New Lead</span>
                      <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">New Contact Inquiry</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 36px 32px;">
                      <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 20px;">
                        <div style="background-color:${brand.primary}; padding:10px 22px;">
                          <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Lead Details</p>
                        </div>
                        <div style="padding:20px 22px;">
                          <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                            <tr>
                              <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:38%; border-bottom:1px solid rgba(217,208,197,0.5);">Name</td>
                              <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${name}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Firm</td>
                              <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${firm}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Email</td>
                              <td style="padding:8px 0; border-bottom:1px solid rgba(217,208,197,0.5);"><a href="mailto:${email}" style="color:${brand.accent}; text-decoration:none; font-size:14px; font-family:Georgia,serif;">${email}</a></td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Service</td>
                              <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${service}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; color:${brand.muted}; font-size:13px; vertical-align:top;">Message</td>
                              <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; line-height:1.7;">${message?.replace(/\n/g, "<br/>")}</td>
                            </tr>
                          </table>
                        </div>
                      </div>
                      <!-- Quick Reply CTA -->
                      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
                        <tr>
                          <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
                            <a href="mailto:${email}?subject=Re: Your ${service} Inquiry" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Reply to ${name} &rarr;</a>
                          </td>
                        </tr>
                      </table>
                      ${inquiryId ? `<p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Inquiry ID: ${inquiryId} &nbsp;·&nbsp; Nurture sequence scheduled (Day 0, 1, 3, 7, 14)</p>` : ""}
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                      <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Sent via maggimay.com contact form</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!internalRes?.ok) {
      const errBody = await internalRes?.json();
      throw new Error(errBody.message || "Resend API error");
    }

    // ── 2. Client-facing confirmation email ──
    try {
      // Generate a short reference number from inquiryId or timestamp
      const refNumber = inquiryId
        ? `BLS-${inquiryId.slice(0, 8).toUpperCase()}`
        : `BLS-${Date.now().toString(36).toUpperCase()}`;

      const submittedDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const submittedTime = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "maggimay@broussardlegalservices.com",
          to: [email],
          subject: `Inquiry Confirmed [${refNumber}] — Broussard Legal Services`,
          html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta name="x-apple-disable-message-reformatting">
              <title>Inquiry Confirmed — Broussard Legal Services</title>
              <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
                Thank you for your inquiry. We have received your request and it is being processed. Reference: ${refNumber}
              </div>
            </head>
            <body style="margin:0; padding:0; background-color:#EDE8E0; font-family:Georgia,'Times New Roman',serif; -webkit-text-size-adjust:100%;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding:40px 16px;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

                    <!-- Header -->
                    <tr><td style="background-color:${brand.primary}; padding:0;">${headerHtml}</td></tr>

                    <!-- Badge + Title -->
                    <tr>
                      <td style="padding:32px 36px 0;">
                        <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#10003;&nbsp; Inquiry Confirmed</span>
                        <h2 style="margin:0 0 8px; font-size:21px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:normal;">Thank You, ${name.split(" ")[0]}</h2>
                        <p style="margin:0 0 20px; font-size:14px; color:${brand.muted}; font-family:Georgia,serif; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">
                          Thank you for your inquiry. This message confirms we have received your request and it is being processed.
                        </p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:0 36px 32px;">

                        <!-- Details Card -->
                        <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
                          <div style="background-color:${brand.primary}; padding:10px 22px;">
                            <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Details</p>
                          </div>
                          <div style="padding:20px 22px;">
                            <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                              <tr>
                                <td style="padding:9px 0; color:${brand.muted}; font-size:13px; width:42%; border-bottom:1px solid rgba(217,208,197,0.5);">Reference</td>
                                <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${refNumber}</td>
                              </tr>
                              <tr>
                                <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Service Requested</td>
                                <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${service}</td>
                              </tr>
                              <tr>
                                <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Date &amp; Time</td>
                                <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${submittedDate} at ${submittedTime}</td>
                              </tr>
                              <tr>
                                <td style="padding:9px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Location</td>
                                <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">Remote / Virtual &mdash; Louisiana &amp; Nationwide</td>
                              </tr>
                              <tr>
                                <td style="padding:9px 0; color:${brand.muted}; font-size:13px;">Initial Consultation</td>
                                <td style="padding:9px 0; color:${brand.foreground}; font-size:14px; font-weight:bold;">Complimentary (30 min)</td>
                              </tr>
                            </table>
                          </div>
                        </div>

                        <!-- What Happens Next -->
                        <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:0 0 24px;">
                          <p style="margin:0 0 12px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">What happens next</p>
                          <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">
                            &#8594;&nbsp; We will review your inquiry and follow up within <strong>1 business day</strong> with a personalized response.
                          </p>
                          <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">
                            &#8594;&nbsp; We'll schedule a free 30-minute consultation to discuss your needs in detail.
                          </p>
                          <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">
                            &#8594;&nbsp; We'll propose a tailored engagement plan that fits your workflow and timeline.
                          </p>
                        </div>

                        <!-- Changes / Cancel Notice -->
                        <p style="margin:0 0 20px; font-size:14px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">
                          If you need to make changes or have additional information to share, simply reply to this email or contact us directly at
                          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">maggimaybroussard@gmail.com</a>.
                          We're happy to help.
                        </p>

                        <!-- Book CTA -->
                        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                          <tr>
                            <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
                              <a href="${SITE_URL}/availability" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Book a Free Consultation &rarr;</a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:0 0 28px; font-size:13px; font-family:Georgia,serif;">
                          <a href="${SITE_URL}/services" style="color:${brand.accent}; text-decoration:underline;">Explore our services &rarr;</a>
                        </p>

                        <!-- Signature -->
                        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
                          <tr>
                            <td>
                              <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family:Georgia,serif;">Warm regards,</p>
                              <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Broussard Legal Services</p>
                              <p style="margin:0 0 2px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif; letter-spacing:0.04em;">Broussard Legal Services</p>
                              <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family:Georgia,serif;">Broussard Legal Services</p>
                              <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
                              &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                              <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family:Georgia,serif;">broussardlegalservices.com</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td>
                              <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif; letter-spacing:0.04em;">Broussard Legal Services &nbsp;·&nbsp; Maggi May Broussard</p>
                              <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
                                You received this because you submitted a contact inquiry at broussardlegalservices.com. If this was a mistake, please disregard this message.
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
          `,
        }),
      });
    } catch {
      // Non-fatal
    }

    const data = await internalRes?.json();

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
