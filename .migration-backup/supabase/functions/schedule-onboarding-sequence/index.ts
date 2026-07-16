import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Schedules the consultation client onboarding email sequence.
 *
 * Triggered by booking status changes:
 *   "confirmed"  → payment_confirmation (immediate) + pre_consultation_checklist (immediate)
 *                  + prep_documents (24h before booking)
 *   "completed"  → post_consultation_followup (immediate, attended)
 *   "no_show"    → post_consultation_followup (immediate, no_show)
 *
 * Can also be called manually with a specific emailType to send on-demand.
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
    const body = await req.json();
    const {
      trigger,          // "confirmed" | "completed" | "no_show" | "manual"
      emailType,        // for manual: specific email type to send
      inquiryId,
      clientEmail,
      clientName,
      service,
      bookingDate,
      bookingTime,
      meetingLocation,
      amount,
      paymentDate,
      invoiceId,
      prepLink,
      documents,
      customMessage,
      nextSteps,
    } = body;

    if (!inquiryId || !clientEmail || !clientName) {
      throw new Error("Missing required fields: inquiryId, clientEmail, clientName");
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Helper to call send-onboarding-email
    async function sendEmail(type: string, extra: Record<string, unknown> = {}) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-onboarding-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          emailType: type,
          inquiryId,
          clientEmail,
          clientName,
          service,
          bookingDate,
          bookingTime,
          meetingLocation,
          ...extra,
        }),
      });
      const data = await res.json();
      return { type, success: res.ok, data };
    }

    const results: Array<{ type: string; success: boolean; data: unknown }> = [];

    if (trigger === "manual" && emailType) {
      // Send a specific email on demand
      const extra: Record<string, unknown> = {};
      if (emailType === "payment_confirmation") {
        Object.assign(extra, { amount, paymentDate, invoiceId });
      }
      if (emailType === "prep_documents") {
        Object.assign(extra, { prepLink, documents });
      }
      if (emailType === "post_consultation_followup") {
        Object.assign(extra, { outcome: "attended", customMessage, nextSteps });
      }
      const result = await sendEmail(emailType, extra);
      results.push(result);

    } else if (trigger === "confirmed") {
      // 1. Payment confirmation (if amount provided)
      if (amount) {
        const r = await sendEmail("payment_confirmation", { amount, paymentDate, invoiceId });
        results.push(r);
      }

      // 2. Pre-consultation checklist (immediate)
      const r2 = await sendEmail("pre_consultation_checklist");
      results.push(r2);

      // 3. Schedule prep_documents row for 24h before booking (or immediate if no booking date)
      let prepScheduledAt = new Date().toISOString();
      if (bookingDate && bookingTime) {
        try {
          const bookingMs = new Date(`${bookingDate} ${bookingTime}`).getTime();
          const prepMs = bookingMs - 24 * 60 * 60 * 1000;
          if (prepMs > Date.now()) {
            prepScheduledAt = new Date(prepMs).toISOString();
          }
        } catch {
          // fallback to immediate
        }
      }

      // Insert scheduled prep_documents into email_sequences for process-sequences to pick up
      await supabase.from("email_sequences").insert({
        inquiry_id: inquiryId,
        sequence_type: "onboarding_prep_documents",
        step_number: 1,
        scheduled_at: prepScheduledAt,
        send_status: "pending",
        metadata: {
          emailType: "prep_documents",
          clientEmail,
          clientName,
          service,
          bookingDate,
          bookingTime,
          meetingLocation,
          prepLink: prepLink ?? null,
        },
      });

      // If scheduled time is now (or past), send immediately
      if (new Date(prepScheduledAt) <= new Date()) {
        const r3 = await sendEmail("prep_documents", { prepLink, documents });
        results.push(r3);
      } else {
        results.push({ type: "prep_documents", success: true, data: { scheduled: true, scheduledAt: prepScheduledAt } });
      }

    } else if (trigger === "completed") {
      const r = await sendEmail("post_consultation_followup", {
        outcome: "attended",
        customMessage,
        nextSteps,
      });
      results.push(r);

    } else if (trigger === "no_show") {
      const r = await sendEmail("post_consultation_followup", {
        outcome: "no_show",
        customMessage,
      });
      results.push(r);

    } else {
      throw new Error(`Unknown trigger: ${trigger}. Valid: confirmed, completed, no_show, manual`);
    }

    // Log the sequence trigger
    await supabase.from("consultation_onboarding_email_logs").insert({
      inquiry_id: inquiryId,
      email_type: `sequence_trigger:${trigger}`,
      recipient_email: clientEmail,
      recipient_name: clientName,
      subject: `Onboarding sequence triggered: ${trigger}`,
      status: "triggered",
      sent_at: new Date().toISOString(),
      metadata: { trigger, results: results.map(r => ({ type: r.type, success: r.success })) },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, trigger, results }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
