import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Schedules the 3-step post-booking email sequence for a client who has
 * just confirmed a consultation booking.
 *
 * Step 1 — Immediate (0h):  Document checklist
 * Step 2 — Day 1   (24h):  Retainer confirmation & engagement options
 * Step 3 — Day 3   (72h):  Next-step reminders & pre-consultation guide
 *
 * Called by handle-calendly-booking after a booking is confirmed.
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
      eventDate,
    } = await req.json();

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Define the 3-step post-booking sequence
    const schedule = [
      { step_number: 1, delay_hours: 0,  label: "Document Checklist (Immediate)" },
      { step_number: 2, delay_hours: 24, label: "Retainer Confirmation (Day 1)" },
      { step_number: 3, delay_hours: 72, label: "Next-Step Reminders (Day 3)" },
    ];

    const rows = schedule.map(({ step_number, delay_hours }) => {
      const scheduledAt = new Date(now.getTime() + delay_hours * 60 * 60 * 1000);
      return {
        inquiry_id: inquiryId,
        sequence_type: "post_booking_kickoff",
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

    // Fire Step 1 (document checklist) immediately
    const step1Row = inserted?.find((r: any) => r.step_number === 1);
    if (step1Row) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-post-booking-email`, {
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
            service,
            eventDate: eventDate ?? null,
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
