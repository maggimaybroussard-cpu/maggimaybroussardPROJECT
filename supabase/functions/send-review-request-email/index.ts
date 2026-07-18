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
    const { sequenceId, inquiryId } = await req.json();

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the review_request row linked to this sequence
    const { data: reviewReq, error: rrErr } = await supabase
      .from("review_requests")
      .select("id, token, client_name, client_email, service, submitted")
      .eq("sequence_id", sequenceId)
      .single();

    if (rrErr || !reviewReq) {
      throw new Error(`review_requests not found for sequenceId ${sequenceId}: ${rrErr?.message}`);
    }

    // Skip if already submitted
    if (reviewReq.submitted) {
      await supabase
        .from("email_sequences")
        .update({ send_status: "skipped" })
        .eq("id", sequenceId);

      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Review already submitted" }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const feedbackUrl = `${SITE_URL}/review/${reviewReq.token}`;
    const clientName = reviewReq.client_name;
    const firstName = clientName.split(" ")[0];
    const service = reviewReq.service ?? "legal support";

    const subject = `How did your ${service} consultation go, ${firstName}?`;

    const bodyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Your Experience — Broussard Legal Services</title>
  <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Your feedback means the world — share your experience in just a few clicks.
  </div>
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <!-- HEADER -->
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

        <!-- BADGE + TITLE -->
        <tr>
          <td style="padding:32px 36px 0;">
            <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9733;&nbsp; Share Your Experience</span>
            <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:-0.01em;border-bottom:1px solid ${brand.border};padding-bottom:14px;">How did your consultation go?</h2>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:0 36px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              It was a pleasure working with you on your <strong>${service}</strong> consultation. I hope our time together was valuable and that you feel well-supported moving forward.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              Your feedback helps other attorneys and legal professionals find the right support — and it means a great deal to me personally. If you have a moment, I would love to hear about your experience.
            </p>

            <!-- Star rating prompt -->
            <div style="background-color:${brand.accentLight};border:1px solid rgba(200,150,90,0.3);border-radius:10px;padding:24px 28px;margin:0 0 28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.06em;text-transform:uppercase;">Rate your experience</p>
              <p style="margin:0 0 20px;font-size:28px;letter-spacing:4px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                <tr>
                  <td style="background-color:${brand.accent};border-radius:8px;box-shadow:0 3px 12px rgba(200,150,90,0.35);">
                    <a href="${feedbackUrl}" style="display:inline-block;padding:16px 44px;color:${brand.white};text-decoration:none;font-size:15px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Leave My Review &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">Takes less than 60 seconds &nbsp;&middot;&nbsp; No account required</p>
            </div>

            <p style="margin:0 0 20px;font-size:14px;color:${brand.muted};line-height:1.8;font-family:Georgia,serif;">
              Or copy and paste this link into your browser:<br>
              <a href="${feedbackUrl}" style="color:${brand.accent};word-break:break-all;font-size:13px;">${feedbackUrl}</a>
            </p>

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">With gratitude,</p>
                  <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Broussard Legal Services</p>
                  <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal &middot; Louisiana &amp; Nationwide</p>
                  <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimay.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You are receiving this email because you booked a consultation with Broussard Legal Services. Your feedback is entirely optional. If you prefer not to receive follow-up emails, simply reply to this message.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [reviewReq.client_email],
        subject,
        html: bodyHtml,
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
      JSON.stringify({ success: true, resendId: resendData.id }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    // Mark sequence as failed if we have a sequenceId
    try {
      const { sequenceId } = await (async () => {
        try { return await req.clone().json(); } catch { return {}; }
      })();
      if (sequenceId) {
        const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("email_sequences")
            .update({ send_status: "failed", error_message: error.message })
            .eq("id", sequenceId);
        }
      }
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
