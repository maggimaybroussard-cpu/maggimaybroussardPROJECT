import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";

const brand = {
  bg: "#FAF7F2",
  primary: "#4A3728",
  accent: "#C8965A",
  accentLight: "#F5EDE0",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
};

/**
 * Builds and sends the lead magnet delivery email (Paralegal Readiness Checklist — 8 tips).
 * Called immediately after subscriber confirms their email via double opt-in.
 */
async function sendLeadMagnetEmail(toEmail: string, resendApiKey: string, unsubscribeToken?: string): Promise<void> {
  const checklistItems = [
    { title: "Pre-Litigation Document Checklist", desc: "Ensure every document is gathered, organized, and Bates-stamped before filing." },
    { title: "Contract Review Red-Flag Triggers", desc: "The key clauses that most often expose clients to unnecessary risk." },
    { title: "Deposition Preparation Timeline", desc: "A week-by-week prep schedule from notice to day-of logistics." },
    { title: "Discovery Request & Response Templates", desc: "Never miss a deadline — track requests, responses, and objections in one place." },
    { title: "Court Filing Deadline Tracker", desc: "A systematic approach to monitoring every critical filing date across active matters." },
    { title: "Client Communication Log Best Practices", desc: "Maintain a defensible record of every client interaction from intake through resolution." },
    { title: "Settlement Demand Letter Framework", desc: "Structure persuasive demand letters with the key elements that move negotiations forward." },
    { title: "Witness Interview Preparation Guide", desc: "Prepare witnesses thoroughly with a structured approach to pre-trial interviews." },
  ];

  const itemsHtml = checklistItems.map((item, i) => `
    <tr>
      <td style="padding:14px 18px;border-bottom:${i < checklistItems.length - 1 ? `1px solid ${brand.border}` : "none"};background-color:${i % 2 === 0 ? brand.bg : brand.white};">
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;">
              <div style="width:22px;height:22px;border-radius:50%;background-color:${brand.accentLight};border:1px solid ${brand.accent};text-align:center;line-height:22px;">
                <span style="font-size:11px;color:${brand.accent};font-weight:bold;font-family:Georgia,serif;">${i + 1}</span>
              </div>
            </td>
            <td style="padding-left:12px;vertical-align:top;">
              <p style="margin:0 0 3px;font-size:14px;color:${brand.foreground};font-weight:bold;font-family:Georgia,serif;">${item.title}</p>
              <p style="margin:0;font-size:13px;color:${brand.muted};line-height:1.6;font-family:Georgia,serif;">${item.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your 8-Tip Paralegal Readiness Checklist</title>
  <div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your free 8-tip Paralegal Readiness Checklist is here — attorney-tested areas where paralegal support makes the biggest difference.</div>
</head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr><td>
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
              </td></tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 32px;">
            <span style="display:inline-block;background-color:${brand.accent};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">Your Free Resource</span>
            <h2 style="margin:0 0 16px;font-size:26px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;line-height:1.3;">The 8-Tip Paralegal Readiness Checklist</h2>
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              Thank you for confirming your subscription. As promised, here are your <strong>8 attorney-tested areas</strong> where paralegal support makes the biggest difference in case outcomes and firm efficiency.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 28px;">
              <tr>
                <td style="background-color:${brand.primary};padding:14px 18px;">
                  <p style="margin:0;font-size:12px;color:${brand.accent};font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;font-family:Georgia,serif;">8-Point Paralegal Readiness Checklist</p>
                </td>
              </tr>
              ${itemsHtml}
            </table>
            <p style="margin:0 0 12px;font-size:14px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">
              Over the next two weeks I'll be sending you a short series diving deeper into three of these areas:
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:0 0 24px;background-color:${brand.accentLight};border-left:3px solid ${brand.accent};border-radius:0 8px 8px 0;padding:0;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Day 3</strong> — Litigation preparation: a step-by-step approach</p>
                <p style="margin:0 0 8px;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Day 7</strong> — Contract review: the clauses that matter most</p>
                <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">&#8594;&nbsp; <strong>Day 14</strong> — The engagement process: from first call to signed agreement</p>
              </td></tr>
            </table>
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
              If any of these areas feel like a gap in your current practice, I'd love to talk. A free 30-minute consultation is the fastest way to find out where I can add the most value.
            </p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
              <tr>
                <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.30);">
                  <a href="${SITE_URL}/availability" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Book a Free Consultation &rarr;</a>
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
                  <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimay.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You received this because you confirmed your subscription at <a href="${SITE_URL}" style="color:${brand.accent};text-decoration:none;">maggimay.com</a>.
              &nbsp;&middot;&nbsp;
              <a href="${unsubscribeToken ? `${SITE_URL}/api/unsubscribe?token=${unsubscribeToken}` : `mailto:maggimaybroussard@gmail.com?subject=Unsubscribe`}" style="color:${brand.muted};text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Maggi May Broussard <onboarding@resend.dev>",
      to: [toEmail],
      subject: "Your 8-Tip Paralegal Readiness Checklist — from Maggi May Broussard",
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error("Resend lead magnet email error:", err);
  }
}

/**
 * Schedules the confirmed-subscriber drip sequence.
 *
 * Sequence:
 *   Immediate (0h)   → subscriber_welcome          step 1  (warm intro + what to expect)
 *   Day 3  (72h)     → subscriber_drip_litigation   step 1  (litigation prep deep-dive)
 *   Day 7  (168h)    → subscriber_drip_contract     step 1  (contract review deep-dive)
 *   Day 14 (336h)    → subscriber_drip_engagement   step 1  (engagement process deep-dive)
 *   Day 21 (504h)    → subscriber_consultation_prompt step 1 (final soft CTA)
 */
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
    const { subscriberId, subscriberEmail } = await req.json();

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    const schedule = [
      { sequence_type: "subscriber_welcome",              step_number: 1, delay_hours: 0   },
      { sequence_type: "subscriber_drip_litigation",      step_number: 1, delay_hours: 72  },
      { sequence_type: "subscriber_drip_contract",        step_number: 1, delay_hours: 168 },
      { sequence_type: "subscriber_drip_engagement",      step_number: 1, delay_hours: 336 },
      { sequence_type: "subscriber_consultation_prompt",  step_number: 1, delay_hours: 504 },
    ];

    const rows = schedule.map(({ sequence_type, step_number, delay_hours }) => ({
      subscriber_id: subscriberId,
      subscriber_email: subscriberEmail,
      sequence_type,
      step_number,
      scheduled_at: new Date(now.getTime() + delay_hours * 60 * 60 * 1000).toISOString(),
      send_status: "pending",
    }));

    const { data: inserted, error } = await supabase
      .from("subscriber_email_sequences")
      .insert(rows)
      .select();

    if (error) throw new Error(error.message);

    // Mark subscriber as enrolled in nurture and ensure unsubscribe token exists
    const { data: subData } = await supabase
      .from("email_subscribers")
      .select("unsubscribe_token")
      .eq("id", subscriberId)
      .maybeSingle();

    const updatePayload: Record<string, string> = { nurture_enrolled_at: now.toISOString() };
    if (!subData?.unsubscribe_token) {
      // Generate a random hex token (32 bytes = 64 hex chars)
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      updatePayload.unsubscribe_token = token;
    }

    await supabase
      .from("email_subscribers")
      .update(updatePayload)
      .eq("id", subscriberId);

    // Send the lead magnet (8-tip checklist) delivery email immediately
    if (RESEND_API_KEY && RESEND_API_KEY !== "your-resend-api-key-here") {
      try {
        // Fetch the latest unsubscribe token (may have just been set above)
        const { data: freshSub } = await supabase
          .from("email_subscribers")
          .select("unsubscribe_token")
          .eq("id", subscriberId)
          .maybeSingle();
        await sendLeadMagnetEmail(subscriberEmail, RESEND_API_KEY, freshSub?.unsubscribe_token ?? undefined);
      } catch {
        // Non-blocking
      }
    }

    // Fire the welcome nurture email immediately
    const welcomeRow = inserted?.find((r: any) => r.sequence_type === "subscriber_welcome");
    if (welcomeRow) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-subscriber-nurture-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: welcomeRow.id,
            subscriberId,
            subscriberEmail,
            sequenceType: "subscriber_welcome",
            stepNumber: 1,
          }),
        });
      } catch {
        // Non-blocking
      }
    }

    return new Response(
      JSON.stringify({ success: true, scheduled: inserted?.length ?? 0 }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
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
