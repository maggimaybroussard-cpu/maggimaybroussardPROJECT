import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Schedules the 3-step contact/booking follow-up email sequence.
 *
 * Step 1 — Day 0  (immediate): Confirmation + Next Steps
 * Step 2 — Day 2  (48h):       Case Study / Service Deep-Dive
 * Step 3 — Day 7  (168h):      Limited-Time Consultation Offer
 *
 * Called by:
 *   - /api/contact/submit  (source: "contact_form")
 *   - /api/consultations/book (source: "booking")
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
    const {
      inquiryId,
      recipientEmail,
      recipientName,
      service,
      source, // "contact_form" | "booking"
    } = await req.json();

    if (!recipientEmail || !recipientName) {
      return new Response(JSON.stringify({ error: "recipientEmail and recipientName are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Define the 3-step follow-up schedule
    const schedule = [
      { step_number: 1, delay_hours: 0,   label: "Day 0 — Confirmation + Next Steps" },
      { step_number: 2, delay_hours: 48,  label: "Day 2 — Case Study / Service Deep-Dive" },
      { step_number: 3, delay_hours: 168, label: "Day 7 — Limited-Time Consultation Offer" },
    ];

    const rows = schedule.map(({ step_number, delay_hours }) => {
      const scheduledAt = new Date(now.getTime() + delay_hours * 60 * 60 * 1000);
      return {
        inquiry_id: inquiryId || null,
        sequence_type: "contact_followup",
        step_number,
        scheduled_at: scheduledAt.toISOString(),
        send_status: "pending",
        metadata: JSON.stringify({
          recipientEmail,
          recipientName,
          service: service || "Legal Services",
          source: source || "contact_form",
        }),
      };
    });

    const { data: inserted, error } = await supabase
      .from("email_sequences")
      .insert(rows)
      .select();

    if (error) throw new Error(error.message);

    // Fire Step 1 immediately (Day 0)
    const step1Row = inserted?.find((r: any) => r.step_number === 1);
    if (step1Row) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-contact-followup-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: step1Row.id,
            inquiryId: inquiryId || null,
            stepNumber: 1,
            recipientEmail,
            recipientName,
            service: service || "Legal Services",
            source: source || "contact_form",
          }),
        });
      } catch {
        // Non-blocking — step 1 failure shouldn't abort scheduling
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: inserted?.length ?? 0,
        steps: schedule.map((s) => s.label),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
