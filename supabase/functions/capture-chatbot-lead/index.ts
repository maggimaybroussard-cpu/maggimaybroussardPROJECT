import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Receives pre-qualified leads from the chatbot widget.
 * Saves to contact_inquiries with source='chatbot' and
 * triggers the full welcome + nurture sequence.
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
    const { name, email, firm, service, message } = await req.json();

    if (!name || !email || !service) {
      return new Response(JSON.stringify({ error: "name, email, and service are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Save chatbot lead to contact_inquiries with source tracking
    const { data: inserted, error: insertError } = await supabase
      .from("contact_inquiries")
      .insert({
        name,
        email,
        firm: firm || "Not provided",
        service,
        message: message || `Lead captured via chatbot pre-qualification. Service interest: ${service}`,
        status: "new",
        source: "chatbot",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    const inquiryId = inserted?.id;

    // Schedule full nurture sequence (welcome fires immediately)
    if (inquiryId) {
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
            source: "chatbot",
          }),
        });
      } catch {
        // Non-blocking
      }
    }

    // Notify Maggi of the chatbot lead
    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: ["maggimaybroussard@gmail.com"],
            reply_to: email,
            subject: `🤖 Chatbot Lead: ${name} — ${service}`,
            html: `
              <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #fafaf8; border: 1px solid #e5e0d8; border-radius: 8px;">
                <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px; border-bottom: 1px solid #e5e0d8; padding-bottom: 16px;">
                  New Chatbot Pre-Qualified Lead
                </h2>
                <p style="font-size: 12px; color: #888; margin-bottom: 20px;">Captured via website chatbot · Nurture sequence started</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #666; font-size: 13px; width: 120px;">Name</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #1a1a1a; font-size: 14px;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #666; font-size: 13px;">Email</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #1a1a1a; font-size: 14px;"><a href="mailto:${email}" style="color: #8b6f47;">${email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #666; font-size: 13px;">Firm</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #1a1a1a; font-size: 14px;">${firm || "Not provided"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #666; font-size: 13px;">Service</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e5e0d8; color: #1a1a1a; font-size: 14px;">${service}</td>
                  </tr>
                  ${message ? `<tr>
                    <td style="padding: 10px 0; color: #666; font-size: 13px; vertical-align: top;">Notes</td>
                    <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; line-height: 1.6;">${message}</td>
                  </tr>` : ""}
                </table>
                <p style="margin-top: 24px; font-size: 12px; color: #888;">Inquiry ID: ${inquiryId} · Welcome email sent · Follow-up sequence: Day 1, 3, 7, 14</p>
              </div>
            `,
          }),
        });
      } catch {
        // Non-blocking
      }
    }

    return new Response(
      JSON.stringify({ success: true, inquiryId }),
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
