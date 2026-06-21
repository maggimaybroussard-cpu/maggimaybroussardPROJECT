import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
};

// ─── Layout Helpers ───────────────────────────────────────────────────────────

function emailWrapper(content: string, preheader = ""): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Broussard Legal Services</title>
      ${preheader ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div><!--<![endif]-->` : ""}
    </head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

            <!-- HEADER -->
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

            <!-- BODY -->
            <tr>
              <td style="padding: 36px 36px 32px;">
                ${content}
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
                <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Broussard Legal Services</p>
                <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7; font-family: Georgia, serif;">
                  You received this because you submitted an inquiry at maggimay.com.
                  <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:maggimaybroussard@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function badge(label: string, color = brand.accent): string {
  return `<span style="display:inline-block; background-color:${color}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">${label}</span>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${text}</h2>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td style="background-color:${color}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.30);">
          <a href="${href}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>
  `;
}

function secondaryLink(href: string, label: string): string {
  return `<p style="margin:0 0 24px; font-size:13px; font-family: Georgia, serif;"><a href="${href}" style="color:${brand.accent}; text-decoration:underline;">${label}</a></p>`;
}

function highlightBox(content: string): string {
  return `
    <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
      ${content}
    </div>
  `;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">${text}</p>`;
}

function signature(closing = "Warm regards"): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">${closing},</p>
          <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Broussard Legal Services</p>
          <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Step 1 (Day 1 — 24h): Case summary + availability offer
 * Sent to prospects who contacted but haven't booked a consultation yet.
 */
function caseSummaryAndAvailabilityEmail(
  name: string,
  firm: string,
  service: string,
  message: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];
  // Truncate message to a readable summary (first 300 chars)
  const messageSummary = message && message.length > 300
    ? message.substring(0, 300).trim() + "…" : message ||"";

  const content = `
    ${badge("Your Case Summary — Next Steps")}
    ${sectionTitle(`${firstName}, here's a summary of your inquiry`)}
    ${bodyText(`Thank you again for reaching out about <strong>${service}</strong>. I've reviewed your inquiry and wanted to share a quick summary along with some immediate next steps.`)}

    <!-- Case Summary Card -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:10px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Case Summary</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
          <tr>
            <td style="padding:8px 0; color:${brand.muted}; font-size:13px; width:38%; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">Name</td>
            <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${name}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">Firm</td>
            <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${firm}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">Service Needed</td>
            <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${service}</td>
          </tr>
          ${messageSummary ? `
          <tr>
            <td style="padding:8px 0; color:${brand.muted}; font-size:13px; vertical-align:top;">Your Message</td>
            <td style="padding:8px 0; color:${brand.foreground}; font-size:14px; line-height:1.7;">${messageSummary}</td>
          </tr>
          ` : ""}
        </table>
      </div>
    </div>

    ${highlightBox(`
      <p style="margin:0 0 10px; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">My availability this week</p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#10003;&nbsp; <strong>Free 30-minute consultation</strong> — no commitment required
      </p>
      <p style="margin:0 0 8px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#10003;&nbsp; <strong>Mon–Fri, 8am–6pm CT</strong> — flexible scheduling available
      </p>
      <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">
        &#10003;&nbsp; <strong>Remote &amp; nationwide</strong> — no travel required
      </p>
    `)}

    ${bodyText(`Based on your inquiry, I believe I can provide meaningful support for your <strong>${service}</strong> needs. The fastest way to get started is to book a free 30-minute consultation — we'll discuss your specific situation and I'll outline exactly how I can help.`)}

    ${ctaButton(`${SITE_URL}/availability`, "Book Your Free 30-Min Consultation")}
    ${secondaryLink(`${SITE_URL}/services`, "Learn more about my ${service} services &rarr;")}
    ${signature()}
  `;

  return {
    subject: `Your ${service} case summary + my availability, ${firstName}`,
    html: emailWrapper(
      content,
      `Here's a summary of your ${service} inquiry and how to book a free consultation.`
    ),
  };
}

/**
 * Step 2 (Day 3 — 72h): 3-day reminder
 * Gentle follow-up for prospects who still haven't booked.
 */
function threeDayReminderEmail(
  name: string,
  service: string
): { subject: string; html: string } {
  const firstName = name.split(" ")[0];

  const content = `
    ${badge("3-Day Follow-Up")}
    ${sectionTitle(`${firstName}, I'm still here to help`)}
    ${bodyText(`A few days have passed since you reached out about <strong>${service}</strong>. I know your schedule is demanding — I just want to make sure my earlier note didn't get buried.`)}
    ${bodyText(`I specialize in <strong>${service}</strong> and work with attorneys and law firms across the country on a remote, flexible basis. Whether you need ongoing support or help with a single project, I can adapt to your workflow with minimal onboarding.`)}

    <!-- Why book now -->
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:0 0 24px;">
      <div style="background-color:${brand.primary}; padding:10px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Why attorneys book a call</p>
      </div>
      <div style="padding:20px 22px;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5);">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; No obligation, no pressure</p>
              <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">It's a conversation — not a sales pitch</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5);">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Immediate availability</p>
              <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">I can typically start within a week of our first call</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5);">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Flexible engagement</p>
              <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Hourly, project-based, or monthly retainer — your choice</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Specialized in ${service}</p>
              <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Not a generalist — I know this area well</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    ${bodyText(`A free 15-minute call is the easiest way to see if we're a good fit. You can book directly on my calendar — no back-and-forth required.`)}

    ${ctaButton(`${SITE_URL}/availability`, "Schedule a Free 15-Min Call")}
    ${secondaryLink(`${SITE_URL}/contact`, "Or reply to this email with questions &rarr;")}

    <p style="margin:24px 0 0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif; line-height:1.7;">
      If the timing isn't right, no worries at all — feel free to reach out whenever you're ready. I'll be here.
    </p>

    ${signature("Best")}
  `;

  return {
    subject: `Still thinking about ${service} support, ${firstName}? (3-day follow-up)`,
    html: emailWrapper(
      content,
      `Quick 3-day follow-up on your ${service} inquiry — I'd love to help.`
    ),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

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
      sequenceId,
      inquiryId,
      stepNumber,
      recipientEmail,
      recipientName,
      recipientFirm,
      service,
      message,
    } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    // If firm/message not passed directly, fetch from DB
    let firm = recipientFirm || "";
    let inquiryMessage = message || "";

    if ((!firm || !inquiryMessage) && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && inquiryId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase
          .from("contact_inquiries")
          .select("firm, message")
          .eq("id", inquiryId)
          .single();
        if (data) {
          firm = firm || data.firm || "";
          inquiryMessage = inquiryMessage || data.message || "";
        }
      } catch {
        // Non-blocking — proceed without enrichment
      }
    }

    // Pick template based on step number
    let template: { subject: string; html: string };
    if (stepNumber === 1) {
      template = caseSummaryAndAvailabilityEmail(recipientName, firm, service, inquiryMessage);
    } else {
      template = threeDayReminderEmail(recipientName, service);
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [recipientEmail],
        subject: template.subject,
        html: template.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Resend API error");
    }

    // Update sequence status in Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && sequenceId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("email_sequences")
          .update({
            send_status: "sent",
            sent_at: new Date().toISOString(),
            resend_email_id: data.id ?? null,
          })
          .eq("id", sequenceId);
      } catch {
        // Non-blocking
      }
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    // Mark sequence as failed if we have the ID
    try {
      const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
      const body = await (async () => {
        try { return await (req as any).json?.(); } catch { return {}; }
      })();
      if (body?.sequenceId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("email_sequences")
          .update({ send_status: "failed", error_message: error.message })
          .eq("id", body.sequenceId);
      }
    } catch {
      // Non-blocking
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
