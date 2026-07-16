import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Called immediately after a contact inquiry is submitted.
 * Schedules the full nurture sequence for the lead:
 *
 * Immediate → welcome email (sent right away)
 * Day 1  (24h)  → booking_reminder step 1
 * Day 3  (72h)  → booking_reminder step 2
 * Day 7  (168h) → lead_nurture step 1 (value-add / case studies)
 * Day 14 (336h) → reengagement (final check-in)
 *
 * Post-service follow-ups are scheduled separately via DB trigger
 * when booking_stage is updated to 'completed'.
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
    const { inquiryId, recipientEmail, recipientName, service, source } = await req.json();

    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Schedule all steps including immediate welcome
    const schedule = [
      { sequence_type: "welcome",           step_number: 1, delay_hours: 0   },
      { sequence_type: "booking_reminder",  step_number: 1, delay_hours: 24  },
      { sequence_type: "booking_reminder",  step_number: 2, delay_hours: 72  },
      { sequence_type: "lead_nurture",      step_number: 1, delay_hours: 168 },
      { sequence_type: "reengagement",      step_number: 1, delay_hours: 336 },
      // Prospect follow-up: case summary + availability offer at Day 1, reminder at Day 3
      { sequence_type: "prospect_followup", step_number: 1, delay_hours: 24  },
      { sequence_type: "prospect_followup", step_number: 2, delay_hours: 72  },
    ];

    const rows = schedule.map(({ sequence_type, step_number, delay_hours }) => {
      const scheduledAt = new Date(now.getTime() + delay_hours * 60 * 60 * 1000);
      return {
        inquiry_id: inquiryId,
        sequence_type,
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

    // Fire the welcome email immediately (delay_hours = 0)
    const welcomeRow = inserted?.find((r: any) => r.sequence_type === "welcome");
    if (welcomeRow) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-nurture-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            sequenceId: welcomeRow.id,
            inquiryId,
            sequenceType: "welcome",
            stepNumber: 1,
            recipientEmail,
            recipientName,
            service,
            source: source || "contact_form",
          }),
        });
      } catch {
        // Non-blocking — welcome email failure shouldn't abort sequence scheduling
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
