import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Schedules the 3-step post-consultation email sequence triggered when
 * a consultation is marked as "completed".
 *
 * Step 1 — Immediate (0h):   Thank-you email
 * Step 2 — Day 1   (24h):   Next-steps summary
 * Step 3 — Day 3   (72h):   Feedback / review request
 *
 * Called by the admin consultations PATCH route when status → "completed".
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
    } = await req.json();

    if (!inquiryId || !recipientEmail || !recipientName) {
      throw new Error("Missing required fields: inquiryId, recipientEmail, recipientName");
    }

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Check if a post-consultation sequence already exists for this inquiry
    const { data: existing } = await supabase
      .from("email_sequences")
      .select("id")
      .eq("inquiry_id", inquiryId)
      .eq("sequence_type", "post_consultation")
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Post-consultation sequence already scheduled" }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Define the 3-step post-consultation sequence
    const schedule = [
      { step_number: 1, delay_hours: 0,  label: "Thank-You Email (Immediate)" },
      { step_number: 2, delay_hours: 24, label: "Next-Steps Summary (Day 1)" },
      { step_number: 3, delay_hours: 72, label: "Feedback Request (Day 3)" },
    ];

    const rows = schedule.map(({ step_number, delay_hours }) => {
      const scheduledAt = new Date(now.getTime() + delay_hours * 60 * 60 * 1000);
      return {
        inquiry_id: inquiryId,
        sequence_type: "post_consultation",
        step_number,
        scheduled_at: scheduledAt.toISOString(),
        send_status: "pending",
      };
    });

    const { data: inserted, error } = await supabase
      .from("email_sequences")
      .insert(rows)
      .select();

    if (error) throw new Error(error.message);

    // Fire Step 1 (thank-you) immediately
    const step1Row = inserted?.find((r: any) => r.step_number === 1);
    if (step1Row) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-post-consultation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: step1Row.id,
            inquiryId,
            stepNumber: 1,
            recipientEmail,
            recipientName,
            service: service ?? "legal support",
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
