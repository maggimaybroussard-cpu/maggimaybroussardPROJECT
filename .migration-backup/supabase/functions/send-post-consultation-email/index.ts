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

function emailHeader(): string {
  return `
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
    </tr>`;
}

function emailFooter(): string {
  return `
    <tr>
      <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
        <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
        <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
          You are receiving this email because you completed a consultation with Maggi May Broussard.
          If you prefer not to receive follow-up emails, simply reply to this message.
        </p>
      </td>
    </tr>`;
}

function wrapEmail(previewText: string, bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${previewText}</div>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        ${emailHeader()}
        ${bodyRows}
        ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Step 1: Thank-You Email ────────────────────────────────────────────────
function buildThankYouEmail(firstName: string, service: string): { subject: string; html: string } {
  const subject = `Thank you for your consultation, ${firstName}`;
  const portalLink = `${SITE_URL}/portal/dashboard`;

  const bodyRows = `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#10003;&nbsp; Consultation Complete</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Thank you for meeting with me today</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          It was truly a pleasure speaking with you today about your <strong>${service}</strong> needs. I appreciate you taking the time to share your situation with me, and I want you to know that I am fully committed to providing you with the highest level of paralegal support.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          I will be reviewing everything we discussed and preparing a clear summary of your next steps. You can expect that in your inbox within 24 hours.
        </p>

        <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:24px 28px;margin:0 0 28px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.04em;text-transform:uppercase;">What happens next</p>
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            ${[
              ["Within 24 hours", "You'll receive a detailed next-steps summary tailored to your case"],
              ["Within 3 days", "I'll follow up to gather your feedback and answer any remaining questions"],
              ["Ongoing", "Your client portal is available 24/7 for documents, messages, and case updates"],
            ].map(([time, desc]) => `
            <tr>
              <td style="padding:6px 0;vertical-align:top;">
                <table cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding-right:12px;vertical-align:top;padding-top:2px;">
                      <div style="width:8px;height:8px;border-radius:50%;background-color:${brand.accent};margin-top:4px;"></div>
                    </td>
                    <td>
                      <p style="margin:0;font-size:14px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;">
                        <strong>${time}</strong> — ${desc}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`).join("")}
          </table>
        </div>

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
              <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
              <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
              &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
              <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">${SITE_URL.replace("https://", "")}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return { subject, html: wrapEmail(`Thank you for your consultation — here's what comes next.`, bodyRows) };
}

// ── Step 2: Next-Steps Summary ─────────────────────────────────────────────
function buildNextStepsEmail(firstName: string, service: string): { subject: string; html: string } {
  const subject = `Your next steps — ${service} support`;
  const portalLink = `${SITE_URL}/portal/dashboard`;
  const bookLink = `${SITE_URL}/book-consultation`;

  const bodyRows = `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:#355E3B;color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9654;&nbsp; Your Action Plan</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Your personalized next-steps summary</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 24px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          Following our consultation on your <strong>${service}</strong> matter, I have outlined the key action items and resources to help you move forward with confidence.
        </p>

        <!-- Action Steps -->
        <div style="margin:0 0 28px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.06em;text-transform:uppercase;">Recommended Action Steps</p>
          ${[
            { num: "1", title: "Organize your documents", desc: "Gather all relevant contracts, correspondence, and legal documents related to your matter. Upload them to your secure client portal for easy access." },
            { num: "2", title: "Review your portal", desc: "Log in to your client portal to view your case status, access shared documents, and send secure messages directly to our team." },
            { num: "3", title: "Schedule a follow-up if needed", desc: "If new developments arise or you have additional questions, book a follow-up consultation at your convenience." },
            { num: "4", title: "Stay informed", desc: "We will keep you updated on any important deadlines or milestones. Enable notifications in your portal to receive real-time alerts." },
          ].map(({ num, title, desc }) => `
          <div style="display:flex;margin-bottom:16px;background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;padding:16px 20px;align-items:flex-start;">
            <div style="width:28px;height:28px;border-radius:50%;background-color:${brand.accent};color:${brand.white};font-size:13px;font-weight:bold;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:14px;text-align:center;line-height:28px;">${num}</div>
            <div>
              <p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:${brand.foreground};font-family:Georgia,serif;">${title}</p>
              <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">${desc}</p>
            </div>
          </div>`).join("")}
        </div>

        <!-- Resources -->
        <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:20px 24px;margin:0 0 28px;">
          <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;letter-spacing:0.04em;text-transform:uppercase;">Quick Links</p>
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            ${[
              { label: "Client Portal", url: portalLink, icon: "&#9632;" },
              { label: "Book a Follow-Up", url: bookLink, icon: "&#9632;" },
              { label: "Contact Us", url: `mailto:maggimaybroussard@gmail.com`, icon: "&#9632;" },
            ].map(({ label, url, icon }) => `
            <tr>
              <td style="padding:5px 0;">
                <a href="${url}" style="color:${brand.accent};font-size:14px;text-decoration:none;font-family:Georgia,serif;">
                  <span style="font-size:8px;margin-right:8px;vertical-align:middle;">${icon}</span>${label} &rarr;
                </a>
              </td>
            </tr>`).join("")}
          </table>
        </div>

        <p style="margin:0 0 24px;font-size:14px;color:${brand.muted};line-height:1.8;font-family:Georgia,serif;">
          Please do not hesitate to reach out if you have any questions. I am here to support you every step of the way.
        </p>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">With dedication,</p>
              <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
              <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
              <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return { subject, html: wrapEmail(`Your personalized next-steps summary for ${service} support.`, bodyRows) };
}

// ── Step 3: Feedback Request ───────────────────────────────────────────────
function buildFeedbackEmail(firstName: string, service: string, feedbackUrl: string): { subject: string; html: string } {
  const subject = `How was your experience, ${firstName}? We'd love your feedback`;

  const bodyRows = `
    <tr>
      <td style="padding:32px 36px 0;">
        <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9733;&nbsp; Share Your Experience</span>
        <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Your feedback helps us serve you better</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 36px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
        <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          I hope you have found our work together on your <strong>${service}</strong> matter valuable. Your experience matters deeply to me, and I would be grateful if you could take a moment to share your thoughts.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
          Your feedback helps me continue improving my services and helps other attorneys and legal professionals find the right paralegal support for their needs.
        </p>

        <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:28px;margin:0 0 28px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.06em;text-transform:uppercase;">Rate your experience</p>
          <p style="margin:0 0 20px;font-size:30px;letter-spacing:6px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 16px;">
            <tr>
              <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
                <a href="${feedbackUrl}" style="display:inline-block;padding:16px 44px;color:${brand.white};text-decoration:none;font-size:15px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Leave My Review &rarr;</a>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">Takes less than 60 seconds &nbsp;&middot;&nbsp; No account required</p>
        </div>

        <p style="margin:0 0 8px;font-size:14px;color:${brand.muted};line-height:1.8;font-family:Georgia,serif;">
          Or copy and paste this link into your browser:
        </p>
        <p style="margin:0 0 24px;">
          <a href="${feedbackUrl}" style="color:${brand.accent};word-break:break-all;font-size:13px;font-family:Georgia,serif;">${feedbackUrl}</a>
        </p>

        <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;padding:18px 22px;margin:0 0 24px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;">Still have questions?</p>
          <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">
            If there is anything unresolved or you would like to continue working together, I am just an email away at
            <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};text-decoration:none;">maggimaybroussard@gmail.com</a>
            or you can
            <a href="${SITE_URL}/book-consultation" style="color:${brand.accent};text-decoration:none;">book a follow-up consultation</a>.
          </p>
        </div>

        <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">With gratitude,</p>
              <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
              <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
              <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
              &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
              <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">${SITE_URL.replace("https://", "")}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return { subject, html: wrapEmail(`Share your experience — your feedback helps us serve you better.`, bodyRows) };
}

// ── Main handler ───────────────────────────────────────────────────────────
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
    const { sequenceId, inquiryId, stepNumber, recipientEmail, recipientName, service } = await req.json();

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const firstName = (recipientName ?? "").split(" ")[0] || recipientName;
    const serviceName = service ?? "legal support";

    let emailData: { subject: string; html: string };

    if (stepNumber === 1) {
      // Thank-you email
      emailData = buildThankYouEmail(firstName, serviceName);
    } else if (stepNumber === 2) {
      // Next-steps summary
      emailData = buildNextStepsEmail(firstName, serviceName);
    } else if (stepNumber === 3) {
      // Feedback request — look up or create a review_request token
      let feedbackUrl = `${SITE_URL}/review/feedback`;

      const { data: existingReview } = await supabase
        .from("review_requests")
        .select("token")
        .eq("inquiry_id", inquiryId)
        .limit(1)
        .maybeSingle();

      if (existingReview?.token) {
        feedbackUrl = `${SITE_URL}/review/${existingReview.token}`;
      } else {
        // Create a new review_request row
        const token = crypto.randomUUID();
        const { error: insertErr } = await supabase.from("review_requests").insert({
          inquiry_id: inquiryId,
          sequence_id: sequenceId,
          token,
          client_name: recipientName,
          client_email: recipientEmail,
          service: serviceName,
          submitted: false,
        });
        if (!insertErr) {
          feedbackUrl = `${SITE_URL}/review/${token}`;
        }
      }

      emailData = buildFeedbackEmail(firstName, serviceName, feedbackUrl);
    } else {
      throw new Error(`Unknown step number: ${stepNumber}`);
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
        subject: emailData.subject,
        html: emailData.html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json();
      throw new Error(errBody.message || "Resend API error");
    }

    const resendData = await res.json();

    // Mark sequence as sent
    await supabase
      .from("email_sequences")
      .update({
        send_status: "sent",
        sent_at: new Date().toISOString(),
        resend_email_id: resendData.id ?? null,
      })
      .eq("id", sequenceId);

    return new Response(
      JSON.stringify({ success: true, step: stepNumber, resendId: resendData.id }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    // Mark sequence as failed
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.sequenceId) {
        const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("email_sequences")
            .update({ send_status: "failed", error_message: error.message })
            .eq("id", body.sequenceId);
        }
      }
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
